# Island Ring Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/ty-kepo/flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/ty-kepo/flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A complete 3D flight game for the make.fun bounty [Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057).

**The game:** you fly a low-poly propeller plane around a procedurally built
island — mountain, valley, lake, town, and an airfield. Fly through six
glowing target rings in order, then bring her home: land on the runway. Fuel
drains with the throttle, speed is life (too slow and she stalls), and a
landing has to be slow, level, and on the strip — or it is a crash.

**Play it:** serve `game/` with any static server (`node serve.ts`, then open
http://localhost:8080) and play in a desktop browser. No network, no build
step; every file the game loads is under `game/`.

**Controls**

| Key | Does what |
| --- | --- |
| W / S or ↑ / ↓ | Pitch up / down |
| A / D or ← / → | Bank left / right |
| Shift | Throttle up |
| X | Throttle down |
| Q / E | Rudder |
| Space | Airbrake |
| Mouse | Steers gently |
| C | Chase / cockpit camera |
| P | Pause |
| R | Restart |
| Enter / click | Start, and fly again |

**How it is built:** Three.js (vendored minified build under `game/vendor/`),
with the game's own source split into files with one clear job each under
`game/src/`: `random.js` (seeded RNG and noise), `config.js` (all tuning),
`world.js` (island, town, runway, rings, sky), `aircraft.js` (plane model and
flight physics), `render.js` (cameras), `hud.js` (instruments), `audio.js`
(WebAudio engine hum, ring chime, landing and crash sounds), `input.js`
(keyboard and mouse), `shots.js` (screenshot poses), `main.js` (boot and the
game loop). The island is deterministic: `?seed=N` always builds the same one.

**Screenshots:** `screenshots/` holds three real renders of the game's own
code — the title screen over the runway, mid-flight toward a ring with the
full HUD, and the cockpit view on the runway after a completed mission —
taken with `?shot=start|play|end&seed=1`.

**Hand in:** `main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to `/output` and writes `/output/dossier.json` with
`buildDossier` from `vendor/makefun-game.ts`:
`mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

MIT licensed. Original art, sounds and name — no commercial game was copied.
