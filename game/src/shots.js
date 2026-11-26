// The screenshot scenes behind ?shot=start|play|end. Each one stages a real pose
// of the game — the plane, the world and the HUD exactly as the loop would show
// them — so a screenshot is a render of the game's own code, and the same seed
// always gives the same frame. The start shot is the title screen over the
// runway; the play shot is mid-flight on course for a ring with the full HUD;
// the end shot is the cockpit view on the runway after a completed mission.

import { RINGS } from './config.js';

const TITLE_BODY = `
  <p>Fly six rings around the island, then bring her home to the runway.</p>
  <p><strong>Controls</strong> — W/S or ↑/↓ pitch &nbsp;·&nbsp; A/D or ←/→ bank &nbsp;·&nbsp; Shift throttle up, X throttle down &nbsp;·&nbsp; Q/E rudder &nbsp;·&nbsp; Space airbrake &nbsp;·&nbsp; C camera &nbsp;·&nbsp; Mouse steers &nbsp;·&nbsp; P pause &nbsp;·&nbsp; R restart</p>
  <p>Watch your fuel and your speed: too slow and she stalls, too fast on the ground and she will not stop in time.</p>
`;

export function stageShot(name, game) {
  const { plane, world, cameras, camera, hud, audio } = game;
  audio.quiet();

  if (name === 'start') {
    plane.startPose();
    world.setRingStates(0, 0);
    cameras.titlePose(plane, world);
    hud.setCockpitFrame(false);
    hud.setHudVisible(false);
    hud.showOverlay(
      'ISLAND RING RUN',
      TITLE_BODY,
      'Press Enter or click to fly'
    );
    return 'title';
  }

  if (name === 'play') {
    plane.placeForShot('play');
    world.setRingStates(1, 1);
    cameras.update(plane, 'chase', 1);
    hud.setCockpitFrame(false);
    hud.setHudVisible(true);
    hud.hideOverlay();
    hud.showMessage('Ring 2 of 6 — follow the orange ring', 30);
    hud.update(plane, RINGS.count, 0);
    return 'play';
  }

  // end: the mission complete, cockpit view on the runway.
  plane.placeForShot('end');
  world.setRingStates(RINGS.count, RINGS.count);
  cameras.update(plane, 'cockpit', 1);
  hud.setCockpitFrame(true);
  hud.setHudVisible(true);
  hud.hideOverlay();
  hud.update(plane, RINGS.count, 0);
  hud.showOverlay(
    'MISSION COMPLETE',
    `<p>All six rings flown and a clean landing on runway 09.</p>
     <p><strong>Score: ${plane.state.score}</strong> &nbsp;·&nbsp; Time ${Math.floor(plane.state.time / 60)}:${String(Math.floor(plane.state.time % 60)).padStart(2, '0')}</p>
     <p>Rings 6/6 &nbsp;·&nbsp; Fuel ${Math.round(plane.state.fuel)}% left</p>`,
    'Press Enter or R to fly again'
  );
  return 'done';
}
