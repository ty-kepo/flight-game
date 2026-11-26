// Keyboard and mouse input for Island Ring Run. The game reads this once a frame:
// pitch and roll from the stick keys or the mouse, throttle from Shift/X, rudder
// from Q/E, and the one-shot actions (start, restart, pause, camera) as edges so a
// held key does not fire twice. Arrow keys and Space never scroll the page.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_RESTART = 'restart';
export const ACTION_PAUSE = 'pause';
export const ACTION_CAMERA = 'camera';

// Keys that steer while held: several spellings share one job.
const PITCH_UP = new Set(['KeyW', 'ArrowUp']);
const PITCH_DOWN = new Set(['KeyS', 'ArrowDown']);
const ROLL_LEFT = new Set(['KeyA', 'ArrowLeft']);
const ROLL_RIGHT = new Set(['KeyD', 'ArrowRight']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight']);
const THROTTLE_DOWN = new Set(['KeyX']);
const RUDDER_LEFT = new Set(['KeyQ']);
const RUDDER_RIGHT = new Set(['KeyE']);
const BRAKE = new Set(['Space']);
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  // Mouse steer: -1..1 across the window, 0 at the centre; 0 while the mouse is
  // still, so the keyboard alone flies the plane.
  const mouse = { x: 0, y: 0, active: false, down: false };

  function onKeyDown(event) {
    if (SCROLL_KEYS.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    pressed.add(event.code);
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onBlur() {
    held.clear();
  }
  function onMouseMove(event) {
    mouse.x = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1));
    mouse.y = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1));
    mouse.active = true;
  }
  function onMouseDown() {
    mouse.down = true;
    pressed.add('Mouse');
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  function anyHeld(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }
  function anyPressed(set) {
    for (const code of set) if (pressed.has(code)) return true;
    return false;
  }

  return {
    // -1 (nose down) .. 1 (nose up); the mouse pulls gently the same way.
    pitch() {
      let value = 0;
      if (anyHeld(PITCH_UP)) value += 1;
      if (anyHeld(PITCH_DOWN)) value -= 1;
      if (mouse.active && value === 0) value += -mouse.y * 0.7;
      return Math.max(-1, Math.min(1, value));
    },
    // -1 (bank left) .. 1 (bank right); the mouse pulls gently the same way.
    roll() {
      let value = 0;
      if (anyHeld(ROLL_RIGHT)) value += 1;
      if (anyHeld(ROLL_LEFT)) value -= 1;
      if (mouse.active && value === 0) value += mouse.x * 0.7;
      return Math.max(-1, Math.min(1, value));
    },
    throttleUp() {
      return anyHeld(THROTTLE_UP);
    },
    throttleDown() {
      return anyHeld(THROTTLE_DOWN);
    },
    rudder() {
      let value = 0;
      if (anyHeld(RUDDER_RIGHT)) value += 1;
      if (anyHeld(RUDDER_LEFT)) value -= 1;
      return value;
    },
    brake() {
      return anyHeld(BRAKE);
    },
    // One-shot actions: true once per press, then cleared at the end of the frame.
    confirm() {
      return anyPressed(new Set(['Enter', 'Space', 'Mouse']));
    },
    restart() {
      return anyPressed(new Set(['KeyR']));
    },
    pause() {
      return anyPressed(new Set(['KeyP', 'Escape']));
    },
    camera() {
      return anyPressed(new Set(['KeyC']));
    },
    // Call at the end of every frame: edges live exactly one frame.
    endFrame() {
      pressed.clear();
    },
  };
}
