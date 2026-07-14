// === Los Tipines — El Juego ===
// Etapa 1: inicio + selección.  Etapa 2: nivel jugable (canvas).

// ---- Datos de personajes (única fuente de verdad). stats 1..5 ----
const CHARS = [
  // jump: fotos (1-based) de despegue → aire (sostenida) → aterrizaje
  { id:'peppi', nombre:'PEPPI', color:'var(--marron)',
    stats:{ velocidad:2, salto:4, daño:5 }, frames:{ correr:6, saltar:7 },
    jump:{ despegue:[], aire:7, aterriza:[3,4,6] },
    desc:'El más fuerte. Lento, pero salta bien y su pisotón es demoledor.' },
  { id:'matti', nombre:'MATTI', color:'var(--amarillo)',
    stats:{ velocidad:5, salto:4, daño:2 }, frames:{ correr:6, saltar:6 },
    jump:{ despegue:[], aire:2, aterriza:[5] },
    desc:'El más ágil y veloz. Buen salto, aunque su pisotón es flojito.' },
  { id:'gatti', nombre:'GATTI', color:'var(--rojo)',
    stats:{ velocidad:3, salto:5, daño:3 }, frames:{ correr:6, saltar:5 },
    jump:{ despegue:[], aire:3, aterriza:[4,5] },
    desc:'El saltarín: llega altísimo, y ahora se mueve un toque más rápido.' },
];

console.assert(CHARS.length === 3, 'deben ser 3 personajes');
for (const c of CHARS)
  for (const v of Object.values(c.stats))
    console.assert(v >= 1 && v <= 5, `stat fuera de rango en ${c.id}`);

const STAT_LABELS = { velocidad:'VELOCIDAD', salto:'SALTO', daño:'DAÑO' };
const MAX_PIPS = 5;

const $ = sel => document.querySelector(sel);
const screens = { title: $('#title'), intro: $('#intro'), select: $('#select') };

// ---- Intro (imágenes con texto, en orden) ----
const INTRO = [
  'El viaje los dejó agotados… pero al abrir los ojos reconocieron cada rincón. Estaban en casa, por fin. Gatti ya estaba metiendo las manos donde no debía, Peppi seguía masticando entre temblores, y Matti no le sacaba los ojos de encima a la máquina.',
  'La pantalla se encendió y ahí estaba: la Soda, la misma que conocían, ahora coronado como el nuevo presidente. El silencio se cortó cuando los tres se dieron cuenta al mismo tiempo… era él.',
  'Sabían que si no lo detenían, el futuro completo cambiaría para siempre. La Soda se convertiría en un tirano implacable. Había que actuar rápido — y los tipines armaron un plan.',
  'Escondidos entre los arbustos, los tipines observaban en silencio. El patio estaba lleno de soldados soda, todos iguales, todos leales a él. La misión recién empezaba.',
];
// pantallas de victoria (mismo formato que la intro). TODO: reemplazar por los textos reales
const FIN = [
  'Lo habían logrado. El Jefe Soda ya no era una amenaza, y los tipines por fin podían respirar tranquilos. Entre risas, abrazos y confeti, celebraron la victoria más dulce de todo el viaje.',
  'Nadie lo vio venir: los tipines, sin buscarlo, se convirtieron en la primera presidencia triple de la historia. Desde el balcón de la Casa Rosada, con la bandera flameando detrás, saludaban a un país que ya los quería como suyos.',
];

// slideshow reusable: sirve para intro y para el final
let slide = null;   // { dir, texts, i, done }
function playSlides(dir, texts, done){
  slide = { dir, texts, i:0, done };
  state = 'slides'; showScreen('intro'); renderSlide();
}
function renderSlide(){
  $('#intro-img').src = `assets/pantallas/${slide.dir}/${slide.i + 1}.png`;
  $('#intro-caption').textContent = slide.texts[slide.i];
}
function nextSlide(){ if (++slide.i >= slide.texts.length) slide.done(); else renderSlide(); }
function startIntro(){ playSlides('intro', INTRO, goSelect); }
$('#intro').addEventListener('click', () => { if (state === 'slides') nextSlide(); });

// ===== Audio (Web Audio, sin archivos) =====
let AC, masterGain, audioReady = false, musicOn = true;
function initAudio(){
  if (audioReady) return;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  masterGain = AC.createGain(); masterGain.gain.value = 0.9; masterGain.connect(AC.destination);
  audioReady = true;
  if (AC.state === 'suspended') AC.resume();
  startMusic();
}
addEventListener('pointerdown', initAudio, { once:true });
addEventListener('keydown',     initAudio, { once:true });

function tone(freq, dur, type, vol, when = 0){        // una nota con envolvente
  if (!audioReady) return;
  const t = AC.currentTime + when, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(masterGain); o.start(t); o.stop(t + dur + 0.02);
}
function glide(f0, f1, dur, type, vol){               // nota con glide (efectos)
  if (!audioReady) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(masterGain); o.start(t); o.stop(t + dur + 0.02);
}
const sfxJump = () => glide(300, 720, 0.16, 'square', 0.30);
const sfxHeal = () => [523, 659, 880].forEach((f, i) => tone(f, 0.16, 'triangle', 0.28, i * 0.08));
const sfxHit  = () => glide(480, 90, 0.16, 'square', 0.34);      // pisotón / hace daño
const sfxHurt = () => glide(240, 55, 0.30, 'sawtooth', 0.34);    // recibe daño

// música: dos loops. main tranquilo; boss intenso (más rápido + bajo/pulso)
const MUSIC = {
  main: { tempo:280, vol:0.035, type:'triangle',
    notes:[523,659,784,659, 880,784,659,587, 523,659,784,988, 880,784,659,587] },
  boss: { tempo:145, vol:0.055, type:'sawtooth', bass:0.075,     // pelea: agresivo
    notes:    [330,392,330,466, 349,330,294,349, 330,392,466,523, 494,466,392,330],
    bassNotes:[ 82, 82, 82, 82,  87, 87, 82, 82,  82, 82, 98, 98,  87, 87, 82, 82] },
  win: { tempo:200, vol:0.05, type:'triangle', bass:0.05,        // festejo: mayor, alegre
    notes:    [523,659,784,1047, 880,784,1047,784, 659,784,880,1047, 1175,1047,880,784],
    bassNotes:[131,131,196,196,  175,175,262,262,  131,131,196,196,  175,175,262,196] },
};
let musicTrack = 'main', musicStep = 0, musicStarted = false;
function musicTick(){
  const m = MUSIC[musicTrack];
  if (musicOn && audioReady){
    tone(m.notes[musicStep % m.notes.length], m.tempo/1000 * 0.85, m.type, m.vol);
    if (m.bassNotes) tone(m.bassNotes[musicStep % m.bassNotes.length], m.tempo/1000 * 0.95, 'square', m.bass);
  }
  musicStep = (musicStep + 1) % 10000;
  setTimeout(musicTick, m.tempo);
}
function startMusic(){ if (!musicStarted){ musicStarted = true; musicTick(); } }
function setMusic(t){ musicTrack = t; }

const musicIcon = $('#music-icon');
$('#music-btn').addEventListener('click', e => {
  e.stopPropagation(); initAudio();
  musicOn = !musicOn;
  musicIcon.src = `assets/iconos/${musicOn ? 2 : 1}.png`;   // 2=on(ondas) 1=off(X)
});
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
function fillStatBox(c){
  const box = $('#statbox');
  box.style.setProperty('--c', c.color);
  box.innerHTML = `<h3>${c.nombre}</h3>${statsHTML(c.stats)}<p class="desc">${c.desc}</p>`;
}
function bindSelect(){
  document.querySelectorAll('.hot').forEach(el => {
    const i = +el.dataset.i;
    el.addEventListener('mouseenter', () => setSelected(i));
    el.addEventListener('click', () => { setSelected(i); choose(); });
  });
}

let selIndex = 0;
function setSelected(i){
  selIndex = (i + CHARS.length) % CHARS.length;
  document.querySelectorAll('.hot').forEach(el =>
    el.classList.toggle('active', +el.dataset.i === selIndex));
  fillStatBox(CHARS[selIndex]);
}

let state = 'title';
function goSelect(){ state = 'select'; showScreen('select'); setSelected(selIndex); }
function choose(){ startGame(CHARS[selIndex]); }

$('#btn-jugar').addEventListener('click', startIntro);
document.addEventListener('keydown', e => {
  if (state === 'title' && (e.key === 'Enter' || e.key === ' ')) startIntro();
  else if (state === 'slides' && (e.key === 'Enter' || e.key === ' ')) nextSlide();
  else if (state === 'select'){
    const order = [2, 0, 1], pos = order.indexOf(selIndex);   // izq→der: gatti,peppi,matti
    if (e.key === 'ArrowRight') setSelected(order[(pos + 1) % 3]);
    else if (e.key === 'ArrowLeft') setSelected(order[(pos + 2) % 3]);
    else if (e.key === 'Enter') choose();
  }
});

// =====================================================================
//  ETAPA 2 — NIVEL
// =====================================================================

// ---- Tuning (todo acá para calibrar fácil) ----
const GRAVITY = 0.6, ACCEL = 0.9, FRICTION = 0.82;
const LEVEL_W = 5200, GROUND_Y = 470;
const PLAYER_H = 128, SODA_H = 140, PROJ_H = 56;
const PLAYER_HB = { w:36, h:116 };          // hitbox del jugador
const SODA_HB   = { w:66, h:118 };
const PROJ_HB   = { w:30, h:22 };
const PROJ_ANCHOR = { x:0.62, y:0.52 };     // dónde está el chorro dentro de su PNG
const INVULN = 80, MAX_HEARTS = 3;
const JUMP_RATE = 3;   // ticks por foto en despegue/aterrizaje (bajo = más breve)

// velocidad/salto derivados de los stats
const speedOf = s => 3.2 + s.velocidad * 0.5;
const jumpOf  = s => 11  + s.salto     * 0.95;

// ---- Jefe / arena (Etapa 3) ----
const BOSS_H = 230, BOSS_HB = { w:120, h:180 }, BOSS_HP = 17;   // Peppi (daño 5): 4 golpes
const ARENA_X0 = LEVEL_W - CW;                  // cámara fija en la pelea
const BOSS_X = ARENA_X0 + CW/2 - BOSS_HB.w/2;   // jefe centrado en la arena
const BOSS_TRIGGER_X = ARENA_X0 + 110;          // el jugador entra y se frena acá

// ---- Árboles-plataforma (sprite con 3 superficies de contacto) ----
const TREE_AR = 1982 / 1315;              // proporción del sprite
const TREE_H = 240, TREE_W = TREE_H * TREE_AR;
const TREE_SINK = 22;                     // hunde la base del tronco en el piso (draw+hitbox juntos)
const TREE_X = [720, 1560, 2450, 3260];   // centros; el tronco apoya en el piso
// superficies medidas del sprite, en fracciones [xIni, xFin, yTope]
const TREE_SURF = [
  [0.06, 0.95, 0.42],   // losa grande (media)
  [0.28, 0.66, 0.05],   // losa de arriba
  [0.70, 0.90, 0.27],   // losa derecha
];
function treePlatforms(cx){               // hitboxes one-way alineadas al sprite
  const left = cx - TREE_W/2, top = GROUND_Y + TREE_SINK - TREE_H;
  return TREE_SURF.map(([a, b, yf]) => ({
    x: left + a*TREE_W, y: top + yf*TREE_H, w: (b-a)*TREE_W, h: 14, tree:true,
  }));
}

// ---- Piso (sprite) con agujero intencional: caer = perder las 3 vidas ----
const PISO_AR = 21210 / 552;
const HOLE_X0 = Math.round(0.530 * LEVEL_W);   // agujero del piso
const HOLE_X1 = Math.round(0.557 * LEVEL_W);

// ---- Layout del nivel ----
const PLATFORMS = [
  { x:0,        y:GROUND_Y, w:HOLE_X0,          h:CH-GROUND_Y, solid:true },  // piso izq.
  { x:HOLE_X1,  y:GROUND_Y, w:LEVEL_W-HOLE_X1,  h:CH-GROUND_Y, solid:true },  // piso der.
  ...TREE_X.flatMap(treePlatforms),                            // superficies de los árboles
  { x:ARENA_X0+110, y:345, w:200, h:14, slab:true },   // arena izquierda (slab, bajada)
  { x:ARENA_X0+660, y:360, w:200, h:14, slab:true },   // arena derecha (slab)
];
const SODA_X    = [880, 1420, 2080, 3300];         // saco la que caía sobre el agujero
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
  const [estatico, correr, saltar, sodaMover, sodaAtacar, proyectil, jefeMover, jefeMuerte,
         vidaHud, vidaPick, fondo1, fondo2, tree, slab, piso, bossBar] = await Promise.all([
    loadFrames(`${base}/estatico`, 1),
    loadFrames(`${base}/correr`, char.frames.correr),
    loadFrames(`${base}/saltar`, char.frames.saltar),
    loadFrames('assets/enemigos/soda/mover', 4),
    loadFrames('assets/enemigos/soda/atacar', 4),
    loadImg('assets/enemigos/proyectil/1.png'),
    loadFrames('assets/enemigos/jefe/mover', 6),
    loadFrames('assets/enemigos/jefe/muerte', 3),
    loadImg('assets/vidas/1.png'),          // corazón HUD
    loadImg('assets/vidas/2.png'),          // vida suelta (comida)
    loadImg('assets/fondos/1.png'),         // fondo nivel
    loadImg('assets/fondos/2.png'),         // fondo jefe
    loadImg('assets/plataformas/1.png'),    // árbol-plataforma
    loadImg('assets/plataformas/2.png'),    // slab (arena del jefe)
    loadImg('assets/plataformas/piso/1.png'),               // piso del nivel
    loadFrames('assets/enemigos/jefe/barra', 5),            // barra de vida del jefe (5 estados)
  ]);
  gfx.player = { estatico, correr, saltar };
  gfx.soda = { mover: sodaMover, atacar: sodaAtacar };
  gfx.proyectil = proyectil;
  gfx.boss = { mover: jefeMover, muerte: jefeMuerte };
  gfx.vidaHud = vidaHud; gfx.vidaPick = vidaPick;
  gfx.fondo1 = fondo1; gfx.fondo2 = fondo2; gfx.tree = tree; gfx.slab = slab;
  gfx.piso = piso; gfx.bossBar = bossBar;
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
  new Image().src = `assets/pantallas/muerte/${char.id}/1.png`;   // precarga la pantalla de muerte
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
  setMusic('main');

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
    if (jumpKey && !wasJump && p.onGround){ p.vy = -p.jump; p.onGround = false; sfxJump(); }
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
  if (p.y > CH) p.hearts = 0;            // cayó al agujero → pierde todo de una
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
      s.attack = 60; s.cd = 180;
      const sign = dx < 0 ? -1 : 1;
      s.face = sign;
      projectiles.push({ x:s.x + s.w/2 + sign*30, y:s.y + 26, vx:sign*4.6, face:sign });
    }
    if (rectsOverlap(p, s)){           // pisotón vs golpe
      const cae = p.vy > 0 && (p.y + p.h) - s.y < 30;
      if (cae){ s.dead = true; p.vy = -p.jump * 0.7; sfxHit(); }
      else hurt();
    }
  }
}

function updatePickups(p){
  for (const k of pickups){
    if (k.taken) continue;
    k.t += 0.08;
    const box = { x:k.x-18, y:k.y-18, w:36, h:36 };
    if (rectsOverlap(box, p) && p.hearts < MAX_HEARTS){ k.taken = true; p.hearts++; sfxHeal(); }
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
    if (b.hp <= b.maxHp / 2){          // pasada la mitad, se mueve de lado a lado (más rápido)
      b.x += b.mdir * 1.5;
      const lo = ARENA_X0 + 60, hi = ARENA_X0 + CW - b.w - 60;
      if (b.x < lo){ b.x = lo; b.mdir = 1; } else if (b.x > hi){ b.x = hi; b.mdir = -1; }
    }
    if (--b.cd <= 0){                  // dispara seguido (agresivo)
      b.cd = 70;
      const sign = b.face;
      projectiles.push({ x:b.x + b.w/2 + sign*40, y:b.y + 60, vx:sign*5.2, face:sign });
    }
    if (rectsOverlap(p, b)){
      const cae = p.vy > 0 && (p.y + p.h) - b.y < 40;   // cae sobre la cabeza
      if (cae){
        p.vy = -p.jump * 0.85;                            // siempre rebota
        if (b.inv <= 0){                                  // solo daña si no es invencible
          b.hp -= p.char.stats.daño; b.inv = 60; sfxHit();  // ~1s invencible (corta el exploit)
          if (b.hp <= 0){ b.dying = true; b.deadT = 0; setMusic('win'); }   // corta la del jefe
        }
      } else hurt();
    }
  } else if (++b.deadT >= gfx.boss.muerte.length * 12 + 36){
    mode = 'win'; winGame();
  }
}

function startBossEntrance(){
  mode = 'bossin';
  setMusic('boss');
  player.vx = 0;                       // freno seco: el jugador queda quieto
  sodas = []; pickups = []; projectiles = [];
  boss = { x:BOSS_X, y:-BOSS_HB.h - 60, vy:0, landed:false,   // arranca arriba de pantalla
           w:BOSS_HB.w, h:BOSS_HB.h, hp:BOSS_HP, maxHp:BOSS_HP,
           face:-1, mdir:1, cd:90, inv:0, dying:false, deadT:0 };
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
  sfxHurt();
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

function drawBackground(){
  const enBoss = (mode === 'boss' || mode === 'bossin');
  const img = enBoss ? gfx.fondo2 : gfx.fondo1;
  if (!img){ ctx.fillStyle = '#bfe3ff'; ctx.fillRect(0, 0, CW, CH); return; }
  if (enBoss){                                  // arena fija: una sola imagen (cover), sin costura
    const s = Math.max(CW / img.naturalWidth, CH / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (CW - w)/2, (CH - h)/2, w, h);
    return;
  }
  // una sola imagen con parallax lento: cubre todo el nivel sin repetir → sin costura
  const w = Math.round(CH * (img.naturalWidth / img.naturalHeight));
  const f = (w - CW) / (LEVEL_W - CW);          // factor justo para cubrir el recorrido
  ctx.drawImage(img, -Math.round(camX * f), 0, w, CH);
}

function drawTrees(){
  if (!gfx.tree) return;
  const top = GROUND_Y + TREE_SINK - TREE_H;
  for (const cx of TREE_X) ctx.drawImage(gfx.tree, cx - TREE_W/2 - camX, top, TREE_W, TREE_H);
}

function drawPiso(){            // el verde del sprite (~0.27) queda en GROUND_Y; agujero incluido
  if (!gfx.piso) return;
  const h = LEVEL_W / PISO_AR;
  ctx.drawImage(gfx.piso, -camX, GROUND_Y - 0.27 * h, LEVEL_W, h);
}

function drawPlatform(pl){
  if (pl.solid || pl.tree) return;        // piso y árboles se dibujan aparte
  if (pl.slab && gfx.slab){               // slab del jefe: superficie (0.27) alineada a pl.y
    const dispW = pl.w, dispH = dispW * (206 / 1151);
    ctx.drawImage(gfx.slab, pl.x - camX, pl.y - 0.27 * dispH, dispW, dispH);
    return;
  }
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
  drawPiso();                 // también en la arena del jefe (ahí no hay agujero)
  drawTrees();
  for (const pl of PLATFORMS) drawPlatform(pl);

  // pickups (vida suelta = comida), flotando
  if (gfx.vidaPick) for (const k of pickups){
    if (k.taken) continue;
    const h = 90, w = h * gfx.vidaPick.naturalWidth / gfx.vidaPick.naturalHeight;
    ctx.drawImage(gfx.vidaPick, k.x - camX - w/2, k.y + Math.sin(k.t)*6 - h/2, w, h);
  }

  // sodas (ataque más lento que la caminata)
  for (const s of sodas){
    if (s.dead) continue;
    const atacando = s.attack > 0;
    const arr = atacando ? gfx.soda.atacar : gfx.soda.mover;
    drawSprite(frameOf(arr, atacando ? 16 : 8), s.x + s.w/2, s.y + s.h, SODA_H, s.face);
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
    else if (boss.hp <= boss.maxHp / 2) img = frameOf(gfx.boss.mover, 8);   // camina al moverse
    else img = gfx.boss.mover[0];                                           // quieto: foto fija
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
  const img = gfx.vidaHud;
  if (img){
    const h = 40, w = h * img.naturalWidth / img.naturalHeight;
    for (let i = 0; i < MAX_HEARTS; i++){
      const bob = Math.sin(animTick * 0.06 + i * 0.9) * 4;   // flota suave
      ctx.globalAlpha = i < player.hearts ? 1 : 0.22;
      ctx.drawImage(img, 22 + i*(w+8), 20 + bob, w, h);
    }
    ctx.globalAlpha = 1;
  }
}

function drawBossBar(){
  if (!gfx.bossBar) return;
  const f = boss.hp / boss.maxHp;
  const i = f > 0.75 ? 0 : f > 0.5 ? 1 : f > 0.25 ? 2 : f > 0 ? 3 : 4;   // lleno→3/4→½→¼→vacío
  const img = gfx.bossBar[i]; if (!img) return;
  const w = 440, h = w * img.naturalHeight / img.naturalWidth;
  ctx.drawImage(img, (CW - w) / 2, -56, w, h);
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
  ov.remove(); running = false; mode = 'menu'; setMusic('main');
  state = 'select'; showScreen('select'); setSelected(selIndex);
}
function gameOver(){
  const id = player.char.id;
  const ov = overlay(`
    <div class="death-bg" style="background-image:url('assets/pantallas/muerte/${id}/1.png')"></div>
    <h2>¡PERDISTE!</h2>
    <button class="btn">Volver</button>`);
  ov.classList.add('death');
  ov.querySelector('button').onclick = () => returnToSelect(ov);
}
function winGame(){                 // al ganar: slideshow final (formato intro) → título
  running = false;
  playSlides('fin', FIN, () => { mode = 'menu'; state = 'title'; showScreen('title'); setMusic('main'); });
}

// escala la TV completa SOLO si no entra en la ventana (nunca agranda → sprites nítidos)
const tvEl = document.querySelector('.tv');
function fitTV(){
  const s = Math.min(1, (innerWidth - 24) / tvEl.offsetWidth, (innerHeight - 24) / tvEl.offsetHeight);
  tvEl.style.transform = `scale(${s})`;
}
addEventListener('resize', fitTV);

// init
bindSelect();
showScreen('title');
fitTV();
