// === Los Tipines — El Juego ===
// Etapa 1: inicio + selección.  Etapa 2: nivel jugable (canvas).

// ---- Datos de personajes (única fuente de verdad). stats 1..5 ----
const CHARS = [
  // jump: fotos (1-based) de despegue → aire (sostenida) → aterrizaje
  { id:'peppi', nombre:'PEPPI', color:'var(--verde)',
    stats:{ velocidad:2, salto:3, daño:5 }, frames:{ correr:6, saltar:7 },
    jump:{ despegue:[], aire:7, aterriza:[3,4,6] },
    desc:'El más fuerte. Lento y de salto normal, pero su pisotón es demoledor.' },
  { id:'matti', nombre:'MATTI', color:'var(--naranja)',
    stats:{ velocidad:5, salto:4, daño:2 }, frames:{ correr:6, saltar:6 },
    jump:{ despegue:[], aire:2, aterriza:[5] },
    desc:'El más ágil y veloz. Buen salto, aunque su pisotón es flojito.' },
  { id:'gatti', nombre:'GATTI', color:'var(--azul)',
    stats:{ velocidad:2, salto:5, daño:3 }, frames:{ correr:6, saltar:5 },
    jump:{ despegue:[], aire:3, aterriza:[4,5] },
    desc:'El saltarín: llega altísimo. Se mueve tranquilo y pega parejo.' },
];

console.assert(CHARS.length === 3, 'deben ser 3 personajes');
for (const c of CHARS)
  for (const v of Object.values(c.stats))
    console.assert(v >= 1 && v <= 5, `stat fuera de rango en ${c.id}`);

const STAT_LABELS = { velocidad:'VELOCIDAD', salto:'SALTO', daño:'DAÑO' };
const MAX_PIPS = 5;

const $ = sel => document.querySelector(sel);
const screens = { title: $('#title'), select: $('#select') };
const canvas = $('#game'), ctx = canvas.getContext('2d');
const CW = canvas.width, CH = canvas.height;

function showScreen(name){
  for (const s of Object.values(screens)) s.classList.add('hidden');
  canvas.classList.add('hidden');
  if (name === 'game') canvas.classList.remove('hidden');
  else if (screens[name]) screens[name].classList.remove('hidden');
}

// ---- Tarjetas de selección (se arman desde CHARS) ----
function pipsHTML(value){
  let out = '';
  for (let i = 1; i <= MAX_PIPS; i++)
    out += `<span class="pip ${i <= value ? 'on' : ''}"></span>`;
  return out;
}
function statsHTML(stats){
  return Object.entries(stats).map(([k, v]) => `
    <div class="stat"><span class="lbl">${STAT_LABELS[k]}</span>
      <span class="pips">${pipsHTML(v)}</span></div>`).join('');
}
function buildCards(){
  const cont = $('#cards');
  cont.innerHTML = CHARS.map((c, i) => `
    <div class="card" data-i="${i}" style="--c:${c.color}">
      <h3>${c.nombre}</h3>
      <img class="retrato" src="assets/personajes/${c.id}/estatico/1.png" alt="${c.nombre}">
      <div class="stats">${statsHTML(c.stats)}</div>
      <p class="desc">${c.desc}</p>
    </div>`).join('');
  cont.querySelectorAll('.card').forEach(el => {
    const i = +el.dataset.i;
    el.addEventListener('mouseenter', () => setSelected(i));
    el.addEventListener('click', () => { setSelected(i); choose(); });
  });
}

let selIndex = 0;
function setSelected(i){
  selIndex = (i + CHARS.length) % CHARS.length;
  document.querySelectorAll('.card').forEach((el, idx) =>
    el.classList.toggle('selected', idx === selIndex));
}

let state = 'title';
function goSelect(){ state = 'select'; showScreen('select'); setSelected(selIndex); }
function choose(){ startGame(CHARS[selIndex]); }

$('#btn-jugar').addEventListener('click', goSelect);
document.addEventListener('keydown', e => {
  if (state === 'title' && (e.key === 'Enter' || e.key === ' ')) goSelect();
  else if (state === 'select'){
    if (e.key === 'ArrowRight') setSelected(selIndex + 1);
    else if (e.key === 'ArrowLeft') setSelected(selIndex - 1);
    else if (e.key === 'Enter') choose();
  }
});

// =====================================================================
//  ETAPA 2 — NIVEL
// =====================================================================

// ---- Tuning (todo acá para calibrar fácil) ----
const GRAVITY = 0.6, ACCEL = 0.9, FRICTION = 0.82;
const LEVEL_W = 5200, GROUND_Y = 470;
const PLAYER_H = 128, SODA_H = 104, PROJ_H = 56;
const PLAYER_HB = { w:36, h:116 };          // hitbox del jugador
const SODA_HB   = { w:50, h:88 };
const PROJ_HB   = { w:30, h:22 };
const PROJ_ANCHOR = { x:0.62, y:0.52 };     // dónde está el chorro dentro de su PNG
const INVULN = 80, MAX_HEARTS = 3;
const JUMP_RATE = 3;   // ticks por foto en despegue/aterrizaje (bajo = más breve)

// velocidad/salto derivados de los stats
const speedOf = s => 3.2 + s.velocidad * 0.5;
const jumpOf  = s => 11  + s.salto     * 0.95;

// ---- Jefe / arena (Etapa 3) ----
const BOSS_H = 230, BOSS_HB = { w:120, h:180 }, BOSS_HP = 12;
const ARENA_X0 = LEVEL_W - CW;                  // cámara fija en la pelea
const BOSS_X = ARENA_X0 + CW/2 - BOSS_HB.w/2;   // jefe centrado en la arena
const BOSS_TRIGGER_X = ARENA_X0 + 110;          // el jugador entra y se frena acá

// ---- Layout del nivel ----
const PLATFORMS = [
  { x:0, y:GROUND_Y, w:LEVEL_W, h:CH-GROUND_Y, solid:true },   // piso (sólido)
  { x:600,  y:360, w:170, h:24 },
  { x:1120, y:300, w:170, h:24 },
  { x:1780, y:350, w:190, h:24 },
  { x:2520, y:320, w:170, h:24 },
  { x:3200, y:360, w:210, h:24 },
  { x:ARENA_X0+120, y:300, w:160, h:24 },   // arena: plataforma izquierda
  { x:ARENA_X0+680, y:360, w:160, h:24 },   // arena: plataforma derecha (más baja)
];
const SODA_X    = [880, 1420, 2080, 2780, 3300];   // ninguna cerca de la arena (zona pelada)
const PICKUP_XY = [[1180, 250], [2560, 270], [3380, 300]];

// ---- Carga de imágenes ----
const gfx = {};
const loadImg = src => new Promise(res => {
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = () => res(null);   // no frenamos el juego por un frame faltante
  i.src = src;
});
const loadFrames = (dir, n) =>
  Promise.all(Array.from({length:n}, (_, k) => loadImg(`${dir}/${k+1}.png`)));

async function loadAssets(char){
  const base = `assets/personajes/${char.id}`;
  const [estatico, correr, saltar, sodaMover, sodaAtacar, proyectil, jefeMover, jefeMuerte] = await Promise.all([
    loadFrames(`${base}/estatico`, 1),
    loadFrames(`${base}/correr`, char.frames.correr),
    loadFrames(`${base}/saltar`, char.frames.saltar),
    loadFrames('assets/enemigos/soda/mover', 4),
    loadFrames('assets/enemigos/soda/atacar', 4),
    loadImg('assets/enemigos/proyectil/1.png'),
    loadFrames('assets/enemigos/jefe/mover', 6),
    loadFrames('assets/enemigos/jefe/muerte', 3),
  ]);
  gfx.player = { estatico, correr, saltar };
  gfx.soda = { mover: sodaMover, atacar: sodaAtacar };
  gfx.proyectil = proyectil;
  gfx.boss = { mover: jefeMover, muerte: jefeMuerte };
}

// ---- Estado del juego ----
let mode = 'menu';      // 'menu' | 'play' | 'boss' | 'over' | 'win'
let running = false;
let player, sodas, projectiles, pickups, boss, camX, animTick, wasJump;
let shake = 0;   // sacudón de cámara (impacto del jefe al caer)
const gkeys = {};

function rectsOverlap(a, b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

async function startGame(char){
  state = 'play';
  showScreen('game');
  const ov = overlay(`<h2>Cargando…</h2>`);
  await loadAssets(char);
  ov.remove();

  player = {
    char, x:120, y:GROUND_Y - PLAYER_HB.h, w:PLAYER_HB.w, h:PLAYER_HB.h,
    vx:0, vy:0, onGround:false, face:1, hearts:MAX_HEARTS, inv:0,
    maxSpeed:speedOf(char.stats), jump:jumpOf(char.stats), anim:'estatico',
    jumpT:0, wasGround:false, landing:false, landT:0,
  };
  sodas = SODA_X.map(x => ({
    x, y:GROUND_Y - SODA_HB.h, w:SODA_HB.w, h:SODA_HB.h,
    home:x, dir:-1, cd:60 + Math.random()*60, attack:0, dead:false, face:-1,
  }));
  projectiles = [];
  pickups = PICKUP_XY.map(([x, y]) => ({ x, y, taken:false, t:Math.random()*6 }));
  camX = 0; animTick = 0; wasJump = false; mode = 'play';

  if (!running){ running = true; requestAnimationFrame(loop); }
}

// ---- Input del nivel ----
addEventListener('keydown', e => {
  if (mode !== 'play' && mode !== 'boss' && mode !== 'bossin') return;
  if (['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code)) e.preventDefault();
  gkeys[e.code] = true;
});
addEventListener('keyup', e => { gkeys[e.code] = false; });

// ---- Update ----
function update(){
  const p = player;

  // movimiento (congelado mientras cae el jefe)
  if (mode === 'bossin'){
    p.vx *= FRICTION;
  } else {
    if (gkeys['ArrowLeft'])  { p.vx -= ACCEL; p.face = -1; }
    if (gkeys['ArrowRight']) { p.vx += ACCEL; p.face = 1; }
    if (!gkeys['ArrowLeft'] && !gkeys['ArrowRight']) p.vx *= FRICTION;
    p.vx = Math.max(-p.maxSpeed, Math.min(p.maxSpeed, p.vx));
    const jumpKey = gkeys['ArrowUp'] || gkeys['Space'];   // salto en el flanco
    if (jumpKey && !wasJump && p.onGround){ p.vy = -p.jump; p.onGround = false; }
    wasJump = jumpKey;
  }

  p.vy += GRAVITY;

  // X: solo chocás con sólidos (paredes). Las plataformas flotantes se atraviesan de costado.
  p.x += p.vx;
  for (const pl of PLATFORMS) if (pl.solid && rectsOverlap(p, pl)){
    if (p.vx > 0) p.x = pl.x - p.w; else if (p.vx < 0) p.x = pl.x + pl.w;
    p.vx = 0;
  }
  p.x = Math.max(0, Math.min(LEVEL_W - p.w, p.x));

  // Y: piso sólido en ambos sentidos; plataformas flotantes one-way (solo al caer encima)
  const prevBottom = p.y + p.h;
  p.onGround = false;
  p.y += p.vy;
  for (const pl of PLATFORMS){
    if (pl.solid){
      if (rectsOverlap(p, pl)){
        if (p.vy > 0){ p.y = pl.y - p.h; p.onGround = true; }
        else if (p.vy < 0) p.y = pl.y + pl.h;
        p.vy = 0;
      }
    } else if (p.vy >= 0 && prevBottom <= pl.y + 6 &&
               p.y + p.h >= pl.y && p.x < pl.x + pl.w && p.x + p.w > pl.x){
      p.y = pl.y - p.h; p.vy = 0; p.onGround = true;   // aterriza sobre la plataforma
    }
  }

  // animación de salto: despegue → aire → aterrizaje
  if (!p.onGround){ if (p.wasGround) p.jumpT = 0; p.jumpT++; }
  if (p.onGround && !p.wasGround){ p.landing = true; p.landT = 0; }   // tocó piso
  if (p.onGround && p.landing){
    if (++p.landT >= p.char.jump.aterriza.length * JUMP_RATE) p.landing = false;
  }
  p.wasGround = p.onGround;
  p.anim = !p.onGround ? 'saltar'
         : p.landing   ? 'aterriza'
         : Math.abs(p.vx) > 0.5 ? 'correr' : 'estatico';
  if (p.inv > 0) p.inv--;

  // lógica por modo
  if (mode === 'play'){
    updateSodas(p);
    updatePickups(p);
    camX = Math.max(0, Math.min(LEVEL_W - CW, p.x + p.w/2 - CW/2));   // cámara sigue
    if (p.x >= BOSS_TRIGGER_X) startBossEntrance();
  } else if (mode === 'bossin'){
    p.x = Math.max(ARENA_X0, p.x);     // ya no avanza
    updateBossEntrance(p);
  } else if (mode === 'boss'){
    p.x = Math.max(ARENA_X0, p.x);     // confinado a la arena
    updateBoss(p);
    camX = ARENA_X0;                   // cámara fija
  }

  updateProjectiles(p);
  if (p.hearts <= 0){ mode = 'over'; gameOver(); }
}

function updateSodas(p){
  for (const s of sodas){
    if (s.dead) continue;
    const dx = (p.x + p.w/2) - (s.x + s.w/2);
    if (s.attack > 0) s.attack--;
    if (s.attack <= 0){                // patrulla quieta mientras ataca
      s.x += s.dir * 0.9;
      if (s.x < s.home - 90) s.dir = 1; else if (s.x > s.home + 90) s.dir = -1;
      s.face = s.dir;
    }
    if (--s.cd <= 0 && Math.abs(dx) < 430){
      s.attack = 24; s.cd = 150;
      const sign = dx < 0 ? -1 : 1;
      s.face = sign;
      projectiles.push({ x:s.x + s.w/2 + sign*30, y:s.y + 26, vx:sign*4.6, face:sign });
    }
    if (rectsOverlap(p, s)){           // pisotón vs golpe
      const cae = p.vy > 0 && (p.y + p.h) - s.y < 30;
      if (cae){ s.dead = true; p.vy = -p.jump * 0.7; }
      else hurt();
    }
  }
}

function updatePickups(p){
  for (const k of pickups){
    if (k.taken) continue;
    k.t += 0.08;
    const box = { x:k.x-18, y:k.y-18, w:36, h:36 };
    if (rectsOverlap(box, p) && p.hearts < MAX_HEARTS){ k.taken = true; p.hearts++; }
  }
}

function updateProjectiles(p){
  for (const pr of projectiles){
    pr.x += pr.vx;
    const box = { x:pr.x - PROJ_HB.w/2, y:pr.y - PROJ_HB.h/2, w:PROJ_HB.w, h:PROJ_HB.h };
    if (rectsOverlap(box, p)){ pr.hit = true; hurt(); }
  }
  projectiles = projectiles.filter(pr => !pr.hit && pr.x > camX - 60 && pr.x < camX + CW + 60);
}

function updateBoss(p){
  const b = boss;
  if (b.inv > 0) b.inv--;
  if (!b.dying){
    b.face = (p.x + p.w/2) < (b.x + b.w/2) ? -1 : 1;
    if (--b.cd <= 0){                  // dispara seguido (agresivo)
      b.cd = 70;
      const sign = b.face;
      projectiles.push({ x:b.x + b.w/2 + sign*40, y:b.y + 60, vx:sign*5.2, face:sign });
    }
    if (rectsOverlap(p, b)){
      const cae = p.vy > 0 && (p.y + p.h) - b.y < 40;   // cae sobre la cabeza
      if (cae && b.inv <= 0){
        b.hp -= p.char.stats.daño; b.inv = 40; p.vy = -p.jump * 0.85;
        if (b.hp <= 0){ b.dying = true; b.deadT = 0; }
      } else if (!cae) hurt();
    }
  } else if (++b.deadT >= gfx.boss.muerte.length * 12 + 36){
    mode = 'win'; winGame();
  }
}

function startBossEntrance(){
  mode = 'bossin';
  player.vx = 0;                       // freno seco: el jugador queda quieto
  sodas = []; pickups = []; projectiles = [];
  boss = { x:BOSS_X, y:-BOSS_HB.h - 60, vy:0, landed:false,   // arranca arriba de pantalla
           w:BOSS_HB.w, h:BOSS_HB.h, hp:BOSS_HP, maxHp:BOSS_HP,
           face:-1, cd:90, inv:0, dying:false, deadT:0 };
}

function updateBossEntrance(){
  camX += (ARENA_X0 - camX) * 0.08;                      // paneo suave a la arena
  if (Math.abs(ARENA_X0 - camX) < 1.5) camX = ARENA_X0;
  if (!boss.landed){                                     // el jefe cae del cielo
    boss.vy += GRAVITY;
    boss.y += boss.vy;
    const floor = GROUND_Y - boss.h;
    if (boss.y >= floor){ boss.y = floor; boss.vy = 0; boss.landed = true; shake = 16; }
  }
  if (boss.landed && camX === ARENA_X0) mode = 'boss';   // arranca la pelea
}

function hurt(){
  if (player.inv > 0) return;
  player.hearts--; player.inv = INVULN;
  player.vy = -5; player.vx = -player.face * 4;   // empujón
}

// ---- Dibujo ----
function drawSprite(img, cx, bottom, dispH, face){
  if (!img) return;
  const w = img.naturalWidth / img.naturalHeight * dispH;
  ctx.save();
  ctx.translate(cx - camX, bottom - dispH);   // origen: centro horizontal, tope del sprite
  ctx.scale(face < 0 ? -1 : 1, 1);             // espeja según hacia dónde mira
  ctx.drawImage(img, -w/2, 0, w, dispH);       // centrado sobre el hitbox
  ctx.restore();
}

function drawHeart(cx, cy, s, color){
  ctx.fillStyle = color;
  const r = s * 0.28;
  ctx.beginPath(); ctx.arc(cx - r, cy - r*0.5, r, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r, cy - r*0.5, r, 0, Math.PI*2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 2*r, cy - r*0.1); ctx.lineTo(cx, cy + s*0.55); ctx.lineTo(cx + 2*r, cy - r*0.1);
  ctx.closePath(); ctx.fill();
}

function drawBackground(){
  // cielo
  const g = ctx.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, '#9fd8ff'); g.addColorStop(1, '#d9f0ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
  // colinas (parallax suave)
  ctx.fillStyle = '#7ec85a';
  for (let i = -1; i < 6; i++){
    const hx = i*700 - camX*0.4 % 700;
    ctx.beginPath(); ctx.arc(hx + 350, GROUND_Y + 120, 320, Math.PI, 0); ctx.fill();
  }
}

function drawGround(){
  const y = GROUND_Y;
  ctx.fillStyle = '#caa15a';                         // tierra
  ctx.fillRect(0, y - camX*0 + 0, CW, CH - y);
  ctx.fillStyle = '#3FB44A';                          // pasto
  ctx.fillRect(0, y, CW, 16);
}

function drawPlatform(pl){
  if (pl.h > 60) return;                  // el piso lo dibuja drawGround
  const x = pl.x - camX;
  ctx.fillStyle = '#b06a2c';
  roundRect(x, pl.y, pl.w, pl.h, 8); ctx.fill();
  ctx.fillStyle = '#3FB44A';
  roundRect(x, pl.y, pl.w, 7, 6); ctx.fill();
}

function roundRect(x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
}

function frameOf(arr, rate){ return arr[Math.floor(animTick / rate) % arr.length]; }

// foto del salto según la fase: despegue (rápido) → aire (sostenida) → aterrizaje
function jumpFrame(p){
  const J = p.char.jump, sal = gfx.player.saltar;
  let n;
  if (p.landing){
    n = J.aterriza[Math.min(Math.floor(p.landT / JUMP_RATE), J.aterriza.length - 1)];
  } else {
    const k = Math.floor(p.jumpT / JUMP_RATE);
    n = k < J.despegue.length ? J.despegue[k] : J.aire;
  }
  return sal[n - 1] || gfx.player.estatico[0];   // fotos 1-based
}

function draw(){
  ctx.fillStyle = '#bfe3ff'; ctx.fillRect(0, 0, CW, CH);   // base (tapa bordes durante el shake)
  ctx.save();
  if (shake > 0.5){ ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake); shake *= 0.88; }
  else shake = 0;
  drawBackground();
  drawGround();
  for (const pl of PLATFORMS) drawPlatform(pl);

  // pickups
  for (const k of pickups){
    if (k.taken) continue;
    drawHeart(k.x - camX, k.y + Math.sin(k.t)*5, 30, '#E2362D');
  }

  // sodas
  for (const s of sodas){
    if (s.dead) continue;
    const arr = s.attack > 0 ? gfx.soda.atacar : gfx.soda.mover;
    drawSprite(frameOf(arr, 8), s.x + s.w/2, s.y + s.h, SODA_H, s.face);
  }

  // proyectiles
  for (const pr of projectiles){
    const img = gfx.proyectil;
    if (!img) continue;
    const w = img.naturalWidth / img.naturalHeight * PROJ_H;
    ctx.save();
    ctx.translate(pr.x - camX, pr.y);
    if (pr.face < 0) ctx.scale(-1, 1);   // PNG espejado: la estela queda detrás del chorro
    ctx.drawImage(img, -w*PROJ_ANCHOR.x, -PROJ_H*PROJ_ANCHOR.y, w, PROJ_H);
    ctx.restore();
  }

  // jefe (parpadea al recibir golpe)
  if ((mode === 'boss' || mode === 'bossin') && boss){
    let img;
    if (boss.dying)
      img = gfx.boss.muerte[Math.min(Math.floor(boss.deadT / 12), gfx.boss.muerte.length - 1)];
    else img = frameOf(gfx.boss.mover, 10);
    if (!(boss.inv > 0 && Math.floor(animTick/3) % 2))
      drawSprite(img, boss.x + boss.w/2, boss.y + boss.h, BOSS_H, boss.face);
  }

  // jugador (parpadea si está invulnerable)
  if (!(player.inv > 0 && Math.floor(animTick/4) % 2)){
    let img;
    if (player.anim === 'correr') img = frameOf(gfx.player.correr, 5);
    else if (player.anim === 'saltar' || player.anim === 'aterriza') img = jumpFrame(player);
    else img = gfx.player.estatico[0];
    drawSprite(img, player.x + player.w/2, player.y + player.h, PLAYER_H, player.face);
  }

  ctx.restore();          // fin del "mundo"; HUD/barra sin shake
  drawHUD();
  if (mode === 'boss' && boss) drawBossBar();
}

function drawHUD(){
  for (let i = 0; i < MAX_HEARTS; i++)
    drawHeart(40 + i*42, 40, 30, i < player.hearts ? '#E2362D' : 'rgba(255,255,255,.55)');
  ctx.fillStyle = '#3a2a18'; ctx.font = "700 22px Nunito, sans-serif";
  ctx.textAlign = 'right'; ctx.fillText(player.char.nombre, CW - 20, 46);
  ctx.textAlign = 'left';
}

function drawBossBar(){
  const w = CW - 200, x = 100, y = 64, h = 26;
  ctx.fillStyle = 'rgba(0,0,0,.22)'; roundRect(x-5, y-5, w+10, h+10, 9); ctx.fill();
  ctx.fillStyle = '#5a3a2a'; roundRect(x, y, w, h, 6); ctx.fill();
  ctx.fillStyle = '#E2362D'; roundRect(x, y, w * Math.max(0, boss.hp/boss.maxHp), h, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = "700 18px DynaPuff, Nunito, sans-serif";
  ctx.textAlign = 'center'; ctx.fillText('JEFE SODA', CW/2, y + h - 7); ctx.textAlign = 'left';
}

// ---- Loop ----
function loop(){
  if (mode === 'play' || mode === 'boss' || mode === 'bossin'){ animTick++; update(); }
  if (mode !== 'menu') draw();
  if (running) requestAnimationFrame(loop);
}

// ---- Overlays / fin ----
function overlay(html){
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.innerHTML = html;
  document.querySelector('.screen-area').appendChild(ov);   // dentro de la pantalla
  return ov;
}
function returnToSelect(ov){
  ov.remove(); running = false; mode = 'menu';
  state = 'select'; showScreen('select'); setSelected(selIndex);
}
function gameOver(){
  const ov = overlay(`<h2>¡PERDISTE!</h2><p>Te quedaste sin corazones.</p>
    <button class="btn">Volver</button>`);
  ov.querySelector('button').onclick = () => returnToSelect(ov);
}
function winGame(){
  const ov = overlay(`<h2>¡GANASTE!</h2>
    <p>Derrotaste al Jefe Soda. 🎉</p>
    <button class="btn">Volver</button>`);
  ov.querySelector('button').onclick = () => returnToSelect(ov);
}

// escala la TV completa SOLO si no entra en la ventana (nunca agranda → sprites nítidos)
const tvEl = document.querySelector('.tv');
function fitTV(){
  const s = Math.min(1, (innerWidth - 24) / tvEl.offsetWidth, (innerHeight - 24) / tvEl.offsetHeight);
  tvEl.style.transform = `scale(${s})`;
}
addEventListener('resize', fitTV);

// init
buildCards();
showScreen('title');
fitTV();
