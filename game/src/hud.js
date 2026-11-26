// The HUD of Island Ring Run: a DOM overlay styled like lit aviation instruments,
// readable at a glance and in a screenshot. Altitude in feet, speed in knots,
// heading in compass degrees, throttle and fuel as bars, and the mission numbers
// (score, rings, time). The title, pause and end screens live here too, so the
// game canvas stays a clean view of the sky.

const KNOTS_PER_MS = 1.94384;
const FEET_PER_M = 3.28084;

function compassLetter(heading) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(heading / 45) % 8];
}

export function createHud(document) {
  const root = document.getElementById('hud');
  const speedEl = document.getElementById('hud-speed');
  const altitudeEl = document.getElementById('hud-altitude');
  const headingEl = document.getElementById('hud-heading');
  const compassEl = document.getElementById('hud-compass');
  const throttleFill = document.getElementById('hud-throttle-fill');
  const throttleText = document.getElementById('hud-throttle-text');
  const fuelFill = document.getElementById('hud-fuel-fill');
  const fuelText = document.getElementById('hud-fuel-text');
  const scoreEl = document.getElementById('hud-score');
  const ringsEl = document.getElementById('hud-rings');
  const timeEl = document.getElementById('hud-time');
  const messageEl = document.getElementById('hud-message');
  const stallEl = document.getElementById('hud-stall');
  const horizon = document.getElementById('hud-horizon-inner');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayBody = document.getElementById('overlay-body');
  const overlayHint = document.getElementById('overlay-hint');
  const cockpitFrame = document.getElementById('cockpit-frame');

  let messageTimer = 0;

  function formatTime(seconds) {
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  return {
    // Refresh every instrument from the plane's state, once a frame.
    update(plane, ringCount, dt) {
      const state = plane.state;
      const knots = Math.round(state.speed * KNOTS_PER_MS);
      const feet = Math.max(0, Math.round(state.position.y * FEET_PER_M));
      const heading = Math.round(plane.headingDeg());
      speedEl.textContent = `${knots}`;
      altitudeEl.textContent = `${feet}`;
      headingEl.textContent = `${String(heading).padStart(3, '0')}°`;
      compassEl.textContent = compassLetter(heading);
      throttleFill.style.width = `${Math.round(state.throttle * 100)}%`;
      throttleText.textContent = `${Math.round(state.throttle * 100)}%`;
      fuelFill.style.width = `${Math.round(state.fuel)}%`;
      fuelFill.classList.toggle('low', state.fuel < 25);
      fuelText.textContent = `${Math.round(state.fuel)}%`;
      scoreEl.textContent = `${state.score}`;
      ringsEl.textContent = `${state.ringsDone} / ${ringCount}`;
      timeEl.textContent = formatTime(state.time);
      // The attitude ball: the sky/ground line rolls with the bank and slides
      // with the pitch, as a real horizon indicator does.
      const rollDeg = (state.roll * 180) / Math.PI;
      const pitchShift = (state.pitch * 180) / Math.PI * 1.4;
      horizon.style.transform = `rotate(${-rollDeg}deg) translateY(${pitchShift}px)`;
      stallEl.classList.toggle('show', state.stalled);
      if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0) messageEl.textContent = '';
      }
    },
    showMessage(text, seconds) {
      messageEl.textContent = text;
      messageTimer = seconds || 3;
    },
    // The big centred screens: title, pause, crashed, landed.
    showOverlay(title, body, hint) {
      overlayTitle.textContent = title;
      overlayBody.innerHTML = body;
      overlayHint.textContent = hint;
      overlay.classList.remove('hidden');
    },
    hideOverlay() {
      overlay.classList.add('hidden');
    },
    // The cockpit dashboard frame: a dark panel with lit gauges, only in
    // cockpit view, so the cockpit screenshots read as flown, not drawn.
    setCockpitFrame(visible) {
      cockpitFrame.classList.toggle('hidden', !visible);
    },
    setHudVisible(visible) {
      root.classList.toggle('hidden', !visible);
    },
  };
}
