// The aircraft of Island Ring Run: a low-poly propeller plane built from Three.js
// primitives, and the arcade flight model that flies it. The model is built nose
// toward local +Z; the physics keeps yaw (heading), pitch and roll, and the group
// is rotated from those three angles, so the plane you see is the plane you fly.
//
// The model is forgiving enough to fly and strict enough that throttle matters:
// lift needs speed, banking turns the plane, climbing bleeds speed, fuel drains
// with the throttle, and the ground is always there. Landing is a real judgement:
// slow, level and on the strip, or it is a crash.

import { PLANE, RINGS, SCORE, RUNWAY, WORLD } from './config.js';

export function createAircraft(THREE, scene) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf2f2ee });
  const redMat = new THREE.MeshLambertMaterial({ color: 0xc8332b });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x2e3438 });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x9fd4e8, shininess: 90, transparent: true, opacity: 0.85 });

  // Fuselage: a cylinder along Z with a cone nose.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.62, 6.4, 12), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = -0.4;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.02, 1.8, 12), redMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 3.7;
  group.add(nose);
  // A red cheatline along the fuselage, so the plane reads from the side.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 6.2), redMat);
  stripe.position.set(1.02, 0.1, -0.4);
  group.add(stripe);
  const stripeLeft = stripe.clone();
  stripeLeft.position.x = -1.02;
  group.add(stripeLeft);

  // The canopy: a glass half-sphere over the cockpit.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
  canopy.scale.set(1, 0.75, 1.5);
  canopy.position.set(0, 0.75, 0.9);
  group.add(canopy);

  // Wings: a main wing with a slight dihedral and a smaller tailplane.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.28, 2.3), redMat);
  wing.position.set(0, -0.15, 0.6);
  wing.rotation.z = 0.06;
  group.add(wing);
  const wingLeft = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.28, 2.3), redMat);
  wingLeft.position.set(0, -0.15, 0.6);
  wingLeft.rotation.z = -0.06;
  group.add(wingLeft);
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 1.4), redMat);
  tailplane.position.set(0, 0.35, -3.4);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.0, 1.6), redMat);
  fin.position.set(0, 1.15, -3.4);
  group.add(fin);

  // The propeller: two blades and a spinner, spun by the engine.
  const propeller = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(0.32, 3.6, 0.14);
  const bladeA = new THREE.Mesh(bladeGeo, darkMat);
  const bladeB = new THREE.Mesh(bladeGeo, darkMat);
  bladeB.rotation.z = Math.PI / 2;
  propeller.add(bladeA);
  propeller.add(bladeB);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 10), redMat);
  spinner.rotation.x = Math.PI / 2;
  spinner.position.z = 0.4;
  propeller.add(spinner);
  propeller.position.z = 4.6;
  group.add(propeller);

  // Landing gear: two mains and a nose wheel.
  const gearMat = new THREE.MeshLambertMaterial({ color: 0x22262a });
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 6), gearMat);
    strut.position.set(side * 1.1, -1.3, 1.2);
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 12), gearMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.1, -2.0, 1.2);
    group.add(wheel);
  }
  const noseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), gearMat);
  noseWheel.rotation.z = Math.PI / 2;
  noseWheel.position.set(0, -1.9, 3.2);
  group.add(noseWheel);

  // Navigation lights: red on the left wingtip, green on the right.
  const navLeft = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 })
  );
  navLeft.position.set(-5.7, -0.1, 0.6);
  group.add(navLeft);
  const navRight = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x22ff66, emissive: 0x00aa33 })
  );
  navRight.position.set(5.7, -0.1, 0.6);
  group.add(navRight);

  scene.add(group);

  // --- Flight state. ---
  const startYaw = (RUNWAY.headingDeg * Math.PI) / 180;
  const state = {
    position: new THREE.Vector3(0, 0, 0),
    yaw: startYaw,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: PLANE.startFuel,
    ringsDone: 0,
    score: 0,
    time: 0,
    // flying | landed | crashed | done
    status: 'flying',
    message: '',
    verticalSpeed: 0,
    stalled: false,
    // True while the plane is rolling on the runway after a touchdown, until
    // it stops (the landing resolves) or lifts off again.
    rolling: false,
  };

  function startPose() {
    const startX = RUNWAY.x - RUNWAY.length / 2 + RUNWAY.startOffset;
    state.position.set(startX, 10.2, RUNWAY.z);
    state.yaw = startYaw;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.fuel = PLANE.startFuel;
    state.ringsDone = 0;
    state.score = 0;
    state.time = 0;
    state.status = 'flying';
    state.message = '';
    state.verticalSpeed = 0;
    state.stalled = false;
    state.rolling = false;
  }
  startPose();

  function forwardVector() {
    const cp = Math.cos(state.pitch);
    return new THREE.Vector3(
      Math.sin(state.yaw) * cp,
      Math.sin(state.pitch),
      -Math.cos(state.yaw) * cp
    );
  }

  function headingDeg() {
    return ((state.yaw * 180) / Math.PI % 360 + 360) % 360;
  }

  function applyPose() {
    group.position.copy(state.position);
    // The model is built nose toward +Z; yaw 0 is north (-Z), so the Y rotation
    // is PI - yaw, and the X rotation is the negative pitch (nose up is +pitch).
    group.rotation.set(-state.pitch, Math.PI - state.yaw, -state.roll, 'YXZ');
    propeller.rotation.z += (0.15 + state.throttle * 2.4) * (state.status === 'flying' ? 1 : 0.2);
  }

  // One fixed step of the flight model. Returns an event string when something
  // worth announcing happens: 'ring', 'landed', 'landed-early', 'crashed',
  // 'fuel-out', or ''.
  function step(dt, input, world) {
    if (state.status !== 'flying') return '';
    state.time += dt;

    // Throttle: Shift opens it, X closes it; no fuel means no engine.
    if (input.throttleUp()) state.throttle = Math.min(1, state.throttle + dt * 0.7);
    if (input.throttleDown()) state.throttle = Math.max(0, state.throttle - dt * 0.7);
    if (state.fuel <= 0) {
      if (state.throttle > 0) {
        state.throttle = 0;
        state.message = 'Fuel empty — gliding!';
        return 'fuel-out';
      }
    }
    state.fuel = Math.max(0, state.fuel - state.throttle * PLANE.fuelDrain * dt);

    // The airbrake (Space) sheds speed for the landing.
    const brake = input.brake() ? 0.5 : 0;

    // Speed: thrust against drag, climbing bleeds it, diving gains it.
    const accel = state.throttle * PLANE.thrust - PLANE.drag * state.speed - PLANE.climbBleed * Math.sin(state.pitch) - brake * 8;
    state.speed = Math.max(0, state.speed + accel * dt);

    // Stalled below the minimum speed: the stick goes soft and the plane sinks.
    // The sink runs down to the ground, never stopping above it: a stalled
    // plane must reach the ground, where the check below decides the landing
    // or the crash, instead of hovering over it forever. The one exception is
    // a plane already resting on the runway strip, which sits at the runway
    // top plus its gear height and must not sink through the strip.
    const groundNow = world.heightAt(state.position.x, state.position.z);
    const onStripNow =
      Math.abs(state.position.z - world.runway.z) < world.runway.width / 2 + 2 &&
      Math.abs(state.position.x - world.runway.x) < world.runway.length / 2 + 4;
    const sinkFloor = onStripNow ? world.runway.topY + 2.0 : groundNow + PLANE.crashClearance;
    state.stalled = state.speed < PLANE.stallSpeed && state.position.y > sinkFloor;
    const speedFactor = Math.max(0.25, Math.min(1, state.speed / PLANE.cruiseSpeed));

    // Pitch and roll from the stick, softened when stalled.
    const pitchAuthority = state.stalled ? 0.35 : 1;
    state.pitch += input.pitch() * PLANE.pitchRate * pitchAuthority * speedFactor * dt;
    state.pitch = Math.max(-PLANE.maxPitch, Math.min(PLANE.maxPitch, state.pitch));
    state.roll += input.roll() * PLANE.rollRate * speedFactor * dt;
    state.roll = Math.max(-PLANE.maxRoll, Math.min(PLANE.maxRoll, state.roll));
    // The plane settles back toward level flight when the stick is released.
    if (Math.abs(input.roll()) < 0.05) {
      state.roll -= state.roll * PLANE.autoLevel * dt;
    }
    if (Math.abs(input.pitch()) < 0.05) {
      state.pitch -= state.pitch * PLANE.autoLevel * 0.6 * dt;
    }

    // A banked turn: the nose follows the bank, and the rudder nudges it too.
    state.yaw += (state.roll * PLANE.turnGain * speedFactor + input.rudder() * PLANE.rudderRate * speedFactor) * dt;

    // Move along the nose direction; a stalled plane sinks as well.
    const forward = forwardVector();
    const previousY = state.position.y;
    state.position.addScaledVector(forward, state.speed * dt);
    if (state.stalled) state.position.y -= (PLANE.stallSpeed - state.speed) * 0.45 * dt;
    state.verticalSpeed = (state.position.y - previousY) / dt;

    // The next ring: flying through it scores and lights the one after.
    const nextRing = world.rings[state.ringsDone];
    if (nextRing) {
      const distance = state.position.distanceTo(nextRing.position);
      if (distance < RINGS.radius * RINGS.passFraction) {
        state.ringsDone += 1;
        state.score += SCORE.ring;
        world.setRingStates(state.ringsDone, state.ringsDone);
        state.message = `Ring ${state.ringsDone} of ${RINGS.count}!`;
        applyPose();
        return 'ring';
      }
    }

    // The ground: the runway forgives a gentle touchdown, anything else is a crash.
    const ground = world.heightAt(state.position.x, state.position.z);
    const clearance = state.position.y - ground;
    // The sea: touching the water is a ditching, wherever the seabed is, so a
    // plane that stalls over the sea crashes at the surface, not on the seabed.
    if (ground < WORLD.seaLevel && state.position.y <= WORLD.seaLevel + 0.5) {
      state.status = 'crashed';
      state.message = 'Ditched in the sea!';
      applyPose();
      return 'crashed';
    }
    // A touchdown on the strip starts a ground roll, and the roll keeps this
    // check running until the plane stops (the landing resolves) or lifts off
    // again: the resting height sits above the contact threshold, so without
    // the roll the check would end the step after touchdown and the landing
    // would never resolve.
    if (clearance <= PLANE.crashClearance || state.rolling) {
      const onStrip =
        Math.abs(state.position.z - world.runway.z) < world.runway.width / 2 + 2 &&
        Math.abs(state.position.x - world.runway.x) < world.runway.length / 2 + 4;
      const gentle =
        Math.abs(state.verticalSpeed) < PLANE.landMaxSink &&
        state.speed < PLANE.landMaxSpeed &&
        Math.abs(state.pitch) < PLANE.landMaxPitch &&
        Math.abs(state.roll) < PLANE.landMaxRoll;
      if (onStrip && gentle) {
        state.rolling = true;
        state.position.y = world.runway.topY + 2.0;
        state.speed = Math.max(0, state.speed - 30 * dt);
        state.pitch = 0;
        state.roll = 0;
        if (state.speed < 2) {
          state.rolling = false;
          if (state.ringsDone >= RINGS.count) {
            state.status = 'done';
            const timeBonus = Math.max(0, SCORE.landingBonus - Math.floor(state.time) * 2);
            const soft = Math.abs(state.verticalSpeed) < 2.5 ? SCORE.softLanding : 0;
            state.score += timeBonus + soft;
            state.message = 'Mission complete — welcome home!';
            applyPose();
            return 'landed';
          }
          // An early touchdown: refuel, roll back out, and fly the rings.
          state.fuel = PLANE.startFuel;
          state.message = 'Landed early — refuelled, back to the rings!';
          applyPose();
          return 'landed-early';
        }
        applyPose();
        return '';
      }
      state.rolling = false;
      state.status = 'crashed';
      state.message = ground < 1 ? 'Ditched in the sea!' : 'Crashed into the ground!';
      applyPose();
      return 'crashed';
    }

    applyPose();
    return '';
  }

  // Place the plane for a screenshot pose without flying the mission.
  function placeForShot(pose) {
    startPose();
    if (pose === 'play') {
      // Over the sea east of the island, on course for ring 2, the island and
      // the mountain ahead and the ring in sight.
      state.position.set(1150, 120, -250);
      state.yaw = (-69.7 * Math.PI) / 180;
      state.pitch = -0.05;
      state.roll = 0.1;
      state.speed = 64;
      state.throttle = 0.72;
      state.fuel = 78;
      state.ringsDone = 1;
      state.score = 100;
      state.time = 96;
    } else if (pose === 'end') {
      // Parked on the runway past the threshold, facing down the strip, after a
      // completed mission. The height stays the one startPose() sets: the plane
      // sits on its gear on the runway top (config RUNWAY has no topY; the
      // runway's top lives on the world's runway object, not in config).
      state.position.set(RUNWAY.x + 60, state.position.y, RUNWAY.z);
      state.yaw = startYaw;
      state.pitch = 0;
      state.roll = 0;
      state.speed = 0;
      state.throttle = 0;
      state.fuel = 34;
      state.ringsDone = RINGS.count;
      state.score = 600 + 320;
      state.time = 212;
      state.status = 'done';
      state.message = 'Mission complete — welcome home!';
    }
    applyPose();
  }

  applyPose();

  return {
    group,
    state,
    startPose,
    step,
    placeForShot,
    forwardVector,
    headingDeg,
    applyPose,
  };
}
