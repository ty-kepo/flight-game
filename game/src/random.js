// Seeded randomness for Island Ring Run: one small generator (mulberry32) and a
// deterministic 2D value-noise field, so the island, the town and the ring route are
// identical on every run and every machine for the same seed. Nothing here reads
// Math.random, so ?seed=N always rebuilds the same world.

// A mulberry32 generator: fast, small, and good enough for terrain and placement.
export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    // A float in [min, max).
    range(min, max) {
      return min + (max - min) * next();
    },
    // An integer in [min, max] inclusive.
    int(min, max) {
      return Math.floor(min + (max - min + 1) * next());
    },
    // One of the given values, each equally likely.
    pick(values) {
      return values[Math.floor(next() * values.length)];
    },
  };
}

// A deterministic 2D value-noise field: a hashed lattice with smooth interpolation,
// layered into fractal noise. The hash mixes the seed, so different seeds give
// different islands while the same seed always gives the same one.
export function createNoise2D(seed) {
  function hash(ix, iz) {
    let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const a = hash(ix, iz);
    const b = hash(ix + 1, iz);
    const c = hash(ix, iz + 1);
    const d = hash(ix + 1, iz + 1);
    const ux = smooth(fx);
    const uz = smooth(fz);
    return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
  }
  // Fractal noise: 4 octaves, each twice the frequency and half the weight.
  function fbm(x, z) {
    let total = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let octave = 0; octave < 4; octave += 1) {
      total += amplitude * noise(x * frequency, z * frequency);
      amplitude *= 0.5;
      frequency *= 2;
    }
    return total;
  }
  return { noise, fbm };
}
