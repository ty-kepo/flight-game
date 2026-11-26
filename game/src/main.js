// Boot and the one loop of Island Ring Run: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between five screens: title, play, paused, crashed and mission complete.
//
// ?seed=N fixes the island. ?shot=start|play|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot, so the screenshots are renders of the game's own code.

import { STEP, RINGS } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createAircraft } from './aircraft.js';
import { createCameras } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';

const THREE = window.THREE;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
createRandom(seed);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;

const sceneCamera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.5, 9000);
const world = createWorld(seed, THREE);
const plane = createAircraft(THREE, world.scene);
const cameras = createCameras(THREE, sceneCamera);
const hud = createHud(document);
const audio = createAudio();
const input = createInput(canvas);

let screen = 'title';
let cameraMode = 'chase';
let paused = false;

const TITLE_BODY = `
  <p>Fly six rings around the island, then bring her home to the runway.</p>
  <p><strong>Controls</strong> — W/S or ↑/↓ pitch &nbsp;·&nbsp; A/D or ←/→ bank &nbsp;·&nbsp; Shift throttle up, X throttle down &nbsp;·&nbsp; Q/E rudder &nbsp;·&nbsp; Space airbrake &nbsp;·&nbsp; C camera &nbsp;·&nbsp; Mouse steers &nbsp;·&nbsp; P pause &nbsp;·&nbsp; R restart</p>
  <p>Watch your fuel and your speed: too slow and she stalls, too fast on the ground and she will not stop in time.</p>
`;

function showTitle() {
  screen = 'title';
  plane.startPose();
  world.setRingStates(0, 0);
  audio.quiet();
  hud.setCockpitFrame(false);
  hud.setHudVisible(false);
  hud.showOverlay('ISLAND RING RUN', TITLE_BODY, 'Press Enter or click to fly');
}

function startMission() {
  audio.ensure();
  plane.startPose();
  world.setRingStates(0, 0);
  screen = 'play';
  cameraMode = 'chase';
  hud.setCockpitFrame(false);
  hud.setHudVisible(true);
  hud.hideOverlay();
  hud.showMessage('Throttle up with Shift, then pull up — ring 1 is past the runway', 6);
}

function showEnd(won) {
  const state = plane.state;
  const minutes = Math.floor(state.time / 60);
  const seconds = Math.floor(state.time % 60);
  const timeText = `${minutes}:${String(seconds).padStart(2, '0')}`;
  if (won) {
    screen = 'done';
    audio.landing();
    hud.showOverlay(
      'MISSION COMPLETE',
      `<p>All six rings flown and a clean landing on runway 09.</p>
       <p><strong>Score: ${state.score}</strong> &nbsp;·&nbsp; Time ${timeText} &nbsp;·&nbsp; Fuel ${Math.round(state.fuel)}% left</p>`,
      'Press Enter or R to fly again'
    );
  } else {
    screen = 'over';
    audio.crash();
    hud.showOverlay(
      'CRASHED',
      `<p>${state.message}</p>
       <p>Rings flown: ${state.ringsDone} / ${RINGS.count} &nbsp;·&nbsp; <strong>Score: ${state.score}</strong> &nbsp;·&nbsp; Time ${timeText}</p>
       <p>Throttle discipline and a gentle hand on the stick bring her home.</p>`,
      'Press Enter or R to try again'
    );
  }
  hud.setHudVisible(true);
}

// One fixed step while flying: read the stick, fly the plane, and answer what
// happened — a ring, a landing, a crash, or nothing worth announcing.
function stepPlay(dt) {
  if (input.camera()) {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
    hud.setCockpitFrame(cameraMode === 'cockpit');
    hud.showMessage(cameraMode === 'cockpit' ? 'Cockpit view' : 'Chase view', 2);
  }
  const event = plane.step(dt, input, world);
  if (event === 'ring') {
    audio.ring();
    hud.showMessage(plane.state.message, 3);
  } else if (event === 'landed') {
    showEnd(true);
  } else if (event === 'landed-early') {
    hud.showMessage(plane.state.message, 4);
  } else if (event === 'crashed') {
    showEnd(false);
  } else if (event === 'fuel-out') {
    hud.showMessage(plane.state.message, 4);
  }
  if (screen === 'play') {
    audio.engine(plane.state.throttle, plane.state.speed / 95);
  }
}

function frame(dt) {
  if (screen === 'title') {
    cameras.titlePose(plane, world);
  } else {
    cameras.update(plane, cameraMode, dt);
  }
  world.update(dt);
  hud.update(plane, RINGS.count, dt);
  renderer.render(world.scene, sceneCamera);
}

const MAX_FRAME = 0.25;
let lastTime = performance.now();
let accumulator = 0;

function loop(now) {
  const elapsed = Math.min(MAX_FRAME, (now - lastTime) / 1000);
  lastTime = now;
  if (shot) return; // Screenshot mode paints its own frames below.
  if (screen === 'play' && !paused) {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      stepPlay(STEP);
      accumulator -= STEP;
      if (screen !== 'play') break;
    }
  } else if (screen === 'title') {
    world.update(elapsed);
  }
  if (input.pause() && (screen === 'play' || paused)) {
    paused = !paused;
    if (paused) {
      audio.quiet();
      hud.showOverlay('PAUSED', '<p>Take a breath. The island will wait.</p>', 'Press P or Enter to keep flying');
    } else {
      hud.hideOverlay();
    }
  }
  if (input.restart() && screen !== 'title') {
    paused = false;
    startMission();
  }
  if (screen === 'title' && input.confirm()) {
    startMission();
  } else if ((screen === 'over' || screen === 'done') && input.confirm()) {
    paused = false;
    startMission();
  }
  frame(elapsed);
  input.endFrame();
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
  sceneCamera.aspect = window.innerWidth / window.innerHeight;
  sceneCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (shot) {
  // Screenshot mode: stage the scene, paint it twice, and say it is ready.
  const game = { plane, world, cameras, camera: sceneCamera, hud, audio, renderer, THREE };
  const staged = stageShot(shot, game);
  screen = staged;
  let painted = 0;
  function paintShot() {
    if (staged === 'title') cameras.titlePose(plane, world);
    else cameras.update(plane, staged === 'done' ? 'cockpit' : 'chase', 1);
    world.update(0.016);
    renderer.render(world.scene, sceneCamera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paintShot);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paintShot);
} else {
  showTitle();
  requestAnimationFrame(loop);
}
