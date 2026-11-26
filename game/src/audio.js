// Sound for Island Ring Run, made only with WebAudio: no audio files, no network.
// An engine hum that follows the throttle, a chime when a ring is flown, a rising
// arpeggio for a landing, and a low thud for a crash. The audio context is created
// on the first user gesture, as browsers require, and stays silent until then.

export function createAudio() {
  let context = null;
  let engineGain = null;
  let engineOscA = null;
  let engineOscB = null;
  let engineFilter = null;
  let muted = false;

  // Create the context and the always-on engine voice, once, on a user gesture.
  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context = new AudioContext();
    engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOscA = context.createOscillator();
    engineOscA.type = 'sawtooth';
    engineOscA.frequency.value = 52;
    engineOscB = context.createOscillator();
    engineOscB.type = 'square';
    engineOscB.frequency.value = 104;
    const oscBGain = context.createGain();
    oscBGain.gain.value = 0.35;
    engineOscA.connect(engineFilter);
    engineOscB.connect(oscBGain);
    oscBGain.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(context.destination);
    engineOscA.start();
    engineOscB.start();
  }

  function tone(frequency, startAt, duration, type, volume) {
    if (!context) return;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(volume, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
  }

  return {
    ensure,
    // The engine hum follows the throttle and the airspeed: louder and higher
    // pitched as the throttle opens. Called every frame while flying.
    engine(throttle, speed01) {
      if (!context || muted) return;
      const now = context.currentTime;
      const target = 0.05 + throttle * 0.1 + speed01 * 0.03;
      engineGain.gain.setTargetAtTime(target, now, 0.1);
      engineOscA.frequency.setTargetAtTime(48 + throttle * 55, now, 0.1);
      engineOscB.frequency.setTargetAtTime(96 + throttle * 110, now, 0.1);
      engineFilter.frequency.setTargetAtTime(320 + throttle * 700, now, 0.1);
    },
    // A two-note chime when the plane flies a ring.
    ring() {
      if (!context || muted) return;
      const now = context.currentTime;
      tone(659.25, now, 0.22, 'sine', 0.22);
      tone(987.77, now + 0.09, 0.35, 'sine', 0.22);
    },
    // A rising arpeggio for a good landing.
    landing() {
      if (!context || muted) return;
      const now = context.currentTime;
      tone(523.25, now, 0.25, 'sine', 0.2);
      tone(659.25, now + 0.1, 0.25, 'sine', 0.2);
      tone(783.99, now + 0.2, 0.4, 'sine', 0.22);
    },
    // A low thud for a crash: a falling sine plus a burst of filtered noise.
    crash() {
      if (!context || muted) return;
      const now = context.currentTime;
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.4);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(now);
      osc.stop(now + 0.5);
      const length = Math.floor(context.sampleRate * 0.25);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = context.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 500;
      const noiseGain = context.createGain();
      noiseGain.gain.value = 0.35;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(context.destination);
      noise.start(now);
    },
    // Silence the engine voice (on the title and end screens).
    quiet() {
      if (!context) return;
      engineGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.quiet();
      return muted;
    },
  };
}
