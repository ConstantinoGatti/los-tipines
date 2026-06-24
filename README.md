# Los Tipines — El Juego

Plataformero 2D estilo claymation. Elegí entre **Peppi**, **Matti** o **Gatti**,
cruzá el nivel esquivando las **sodas** (sifones) y derrotá al **Jefe Soda** al final.

## Cómo jugar

Doble clic en `index.html`, o levantá un server local para evitar limitaciones del navegador:

```sh
node serve.js          # http://localhost:5500
```

**Controles:** ← → moverse · ↑ / Espacio saltar.
Pisá la cabeza de las sodas para vencerlas; al jefe pegale de arriba desde las plataformas.

## Personajes

| Tipín | Velocidad | Salto | Daño |
|-------|-----------|-------|------|
| Peppi | ●●        | ●●●   | ●●●●● |
| Matti | ●●●●●     | ●●●●  | ●●   |
| Gatti | ●●        | ●●●●● | ●●●  |

## Estructura

```
index.html      # pantallas (menús en HTML/CSS) + canvas, todo dentro de una TV CRT
styles.css      # paleta plastilina, tipografías (DynaPuff/Nunito) y el televisor
game.js         # motor del juego: estados, física, enemigos, jefe
serve.js        # server estático mínimo para desarrollo (solo Node, sin deps)
assets/         # sprites
  personajes/{peppi,matti,gatti}/{estatico,correr,saltar}/
  enemigos/{soda,jefe,proyectil}/
```

Sin dependencias ni build: HTML + JS + Canvas.
