// Every tuning number and colour of Island Ring Run in one place. Distances are in
// metres, speeds in metres per second, angles in radians, money in nothing at all:
// the game scores in points. The world is one island about 2.2 km across; the plane
// cruises at roughly 60 m/s, so a lap of the ring route takes about three minutes.

export const STEP = 1 / 60;

export const WORLD = {
  // The island's land radius; the terrain plane is wider so the sea has room.
  islandRadius: 1100,
  terrainSize: 2600,
  terrainSegments: 200,
  // Sea level: terrain below this is under water.
  seaLevel: 0,
  // The airfield is flattened to this height.
  airfieldHeight: 8,
  airfield: { x: 620, z: 280, flattenX: 340, flattenZ: 170 },
  town: { x: 430, z: 540, radius: 150, flattenHeight: 10 },
  // A lake hollow in the valley, for a second water feature inland.
  lake: { x: -150, z: 60, radius: 130, depth: 11 },
  // The mountain peak, for a landmark the player can steer by.
  mountain: { x: -500, z: -350, height: 150, radius: 300 },
  // The valley runs from the north-west hills to the south-east shore.
  valley: { ax: -750, az: -600, bx: 350, bz: 550, halfWidth: 260 },
};

export const RUNWAY = {
  x: 620,
  z: 280,
  length: 420,
  width: 28,
  // Take-off heading, degrees: 90 is due east, down the runway.
  headingDeg: 90,
  // The plane starts this far back from the runway's west end.
  startOffset: 150,
};

export const RINGS = {
  count: 6,
  radius: 16,
  // Passing within this fraction of the ring's radius counts as through it.
  passFraction: 0.9,
  // The route: each ring is an (x, y, z) point the plane must fly through, in order.
  // Ring 6 sits on the final approach so the landing follows naturally from it.
  route: [
    { x: 900, y: 78, z: 280 },
    { x: 960, y: 95, z: -320 },
    { x: 320, y: 145, z: -760 },
    { x: -430, y: 235, z: -520 },
    { x: -820, y: 130, z: 180 },
    { x: 300, y: 62, z: 280 },
  ],
};

export const PLANE = {
  // Speeds in m/s (60 m/s is about 117 knots).
  maxSpeed: 95,
  cruiseSpeed: 62,
  stallSpeed: 26,
  // Thrust acceleration at full throttle, before drag.
  thrust: 22,
  drag: 0.24,
  // How much climbing bleeds speed and diving gains it.
  climbBleed: 5.4,
  pitchRate: 0.95,
  rollRate: 1.7,
  maxPitch: 0.62,
  maxRoll: 1.15,
  // The banked turn: yaw follows roll, scaled by speed.
  turnGain: 0.55,
  rudderRate: 0.25,
  // The plane settles back toward level flight when the stick is released.
  autoLevel: 0.85,
  // Fuel: percent drained per second at full throttle; cruise is cheaper.
  fuelDrain: 0.22,
  startFuel: 100,
  // Landing: gentle enough, slow enough, level enough, on the strip.
  landMaxSink: 5.5,
  landMaxSpeed: 52,
  landMaxPitch: 0.18,
  landMaxRoll: 0.35,
  // A crash is any ground contact that is not that landing.
  crashClearance: 1.4,
};

export const SCORE = {
  ring: 100,
  // Landing bonus: up to this many points, shrinking with the mission time.
  landingBonus: 500,
  landingParSeconds: 240,
  // A gentle touchdown earns a little extra.
  softLanding: 150,
};

export const CAMERA = {
  chaseDistance: 21,
  chaseHeight: 7,
  chaseLookAhead: 42,
  // How fast the chase camera catches up: higher is snappier, lower is dreamier.
  chaseStiffness: 4.5,
  cockpitFov: 78,
  chaseFov: 68,
};

export const PALETTE = {
  skyTop: 0x3a7bd5,
  skyHorizon: 0xd6ecf7,
  fog: 0xcfe0ea,
  sea: 0x2e7fb8,
  sand: 0xd9c28a,
  grass: 0x6fae4e,
  grassDark: 0x4f8f3a,
  rock: 0x8a7f72,
  snow: 0xf2f5f7,
  runway: 0x3a3f46,
  runwayMark: 0xf5f5f0,
  townRoof: 0xb5502e,
  townWall: 0xe8dcc0,
  treeTrunk: 0x6b4a2b,
  treeLeaf: 0x2f7d32,
  planeBody: 0xf2f2ee,
  planeRed: 0xc8332b,
  planeCanopy: 0x9fd4e8,
  ringActive: 0xff7a1a,
  ringDone: 0x37c978,
  ringNext: 0xffb020,
};
