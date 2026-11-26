// The world of Island Ring Run: one island in the sea, built from a seeded height
// function so the same seed always builds the same island. The island holds a
// mountain, a valley with a lake, a small town, an airfield with a marked runway,
// and six target rings on a route that ends on the runway's final approach. The
// same heightAt() that shapes the terrain mesh is what the flight model flies
// against, so the ground you see is the ground you can hit.

import { WORLD, RUNWAY, RINGS, PALETTE } from './config.js';
import { createNoise2D } from './random.js';

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// Smoothstep that works with either edge order.
function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Distance from (x, z) to the segment (ax, az)-(bx, bz).
function distanceToSegment(x, z, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz;
  let t = 0;
  if (lengthSq > 0) t = clamp01(((x - ax) * dx + (z - az) * dz) / lengthSq);
  const px = ax + t * dx;
  const pz = az + t * dz;
  return Math.hypot(x - px, z - pz);
}

export function createWorld(seed, THREE) {
  const noise = createNoise2D(seed);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 900, 3400);

  // The island's height at any (x, z): rolling hills from fractal noise, a
  // mountain for a landmark, a valley and a lake, then the airfield and the town
  // flattened, and the whole island sinking into the sea at its edge.
  function heightAt(x, z) {
    const r = Math.hypot(x, z) / WORLD.islandRadius;
    const coast = smoothstep(1.0, 0.72, r);
    let h = 34 + 78 * noise.fbm(x * 0.0016 + 7.3, z * 0.0016 - 2.1);
    const mdx = x - WORLD.mountain.x;
    const mdz = z - WORLD.mountain.z;
    h += WORLD.mountain.height * Math.exp(-(mdx * mdx + mdz * mdz) / (2 * WORLD.mountain.radius * WORLD.mountain.radius));
    const valleyDistance = distanceToSegment(x, z, WORLD.valley.ax, WORLD.valley.az, WORLD.valley.bx, WORLD.valley.bz);
    const valleyMask = smoothstep(0, WORLD.valley.halfWidth, valleyDistance);
    if (h > 0) h *= 0.18 + 0.82 * valleyMask;
    const ldx = x - WORLD.lake.x;
    const ldz = z - WORLD.lake.z;
    h -= WORLD.lake.depth * Math.exp(-(ldx * ldx + ldz * ldz) / (2 * WORLD.lake.radius * WORLD.lake.radius));
    // Flatten the airfield: an ellipse around the runway blends to its height.
    const afx = (x - WORLD.airfield.x) / WORLD.airfield.flattenX;
    const afz = (z - WORLD.airfield.z) / WORLD.airfield.flattenZ;
    const airfieldMask = smoothstep(1.15, 0.55, Math.hypot(afx, afz));
    h = lerp(h, WORLD.airfieldHeight, airfieldMask);
    // Carve a gentle approach corridor west of the runway, so the final approach
    // descends over smooth ground toward the strip instead of over hills. It
    // starts at the runway's west end and rises gently as it goes west.
    const west = clamp01((RUNWAY.x - RUNWAY.length / 2 - x) / 310);
    const lateral = smoothstep(70, 25, Math.abs(z - RUNWAY.z));
    const corridorTarget = WORLD.airfieldHeight + west * 31;
    h = lerp(h, corridorTarget, lateral * 0.9);
    // Flatten the town the same way, so its houses stand on level ground.
    const townDistance = Math.hypot(x - WORLD.town.x, z - WORLD.town.z);
    const townMask = smoothstep(WORLD.town.radius * 1.2, WORLD.town.radius * 0.5, townDistance);
    h = lerp(h, WORLD.town.flattenHeight, townMask);
    return coast * (h + 6) - 6;
  }

  // --- Sky: a gradient dome, a sun disc, and drifting clouds. ---
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: 'varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vPosition; uniform vec3 top; uniform vec3 horizon; void main() { float t = clamp(normalize(vPosition).y * 1.6 + 0.12, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3800, 24, 16), skyMaterial);
  scene.add(sky);

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(110, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false })
  );
  sun.position.set(1700, 1350, -2100);
  sun.lookAt(0, 0, 0);
  scene.add(sun);

  // --- Light: a warm sun and a cool sky bounce. ---
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x5a6b4a, 0.85);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xfff2d8, 1.15);
  sunLight.position.set(1500, 1800, -900);
  scene.add(sunLight);

  // --- Terrain: a displaced plane, coloured by height. ---
  const terrainGeo = new THREE.PlaneGeometry(WORLD.terrainSize, WORLD.terrainSize, WORLD.terrainSegments, WORLD.terrainSegments);
  terrainGeo.rotateX(-Math.PI / 2);
  const positions = terrainGeo.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const sand = new THREE.Color(PALETTE.sand);
  const grass = new THREE.Color(PALETTE.grass);
  const grassDark = new THREE.Color(PALETTE.grassDark);
  const rock = new THREE.Color(PALETTE.rock);
  const snow = new THREE.Color(PALETTE.snow);
  const tmpColor = new THREE.Color();
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const h = heightAt(x, z);
    positions.setY(i, h);
    const shade = noise.fbm(x * 0.01 + 3.1, z * 0.01 - 5.7) * 0.5 + 0.5;
    if (h < 1.5) tmpColor.copy(sand);
    else if (h < 55) tmpColor.copy(grass).lerp(grassDark, shade * 0.7);
    else if (h < 105) tmpColor.copy(grassDark).lerp(rock, smoothstep(55, 105, h));
    else tmpColor.copy(rock).lerp(snow, smoothstep(105, 140, h));
    // The valley floor reads greener and the beach reads paler.
    if (h > 1.5 && h < 12) tmpColor.lerp(sand, 0.25 * (1 - h / 12));
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(terrain);

  // --- The sea: one wide, slightly transparent plane. ---
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.86 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = WORLD.seaLevel;
  scene.add(sea);

  // --- The runway: asphalt, centreline dashes, threshold bars, edge lights. ---
  const runwayTop = WORLD.airfieldHeight + 0.3;
  const runwayGroup = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.length, 0.6, RUNWAY.width),
    new THREE.MeshLambertMaterial({ color: PALETTE.runway })
  );
  strip.position.set(RUNWAY.x, runwayTop - 0.3, RUNWAY.z);
  runwayGroup.add(strip);
  const dashGeo = new THREE.BoxGeometry(14, 0.15, 2.2);
  const dashMat = new THREE.MeshLambertMaterial({ color: PALETTE.runwayMark });
  for (let i = 0; i < 11; i += 1) {
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.position.set(RUNWAY.x - RUNWAY.length / 2 + 30 + i * 36, runwayTop + 0.08, RUNWAY.z);
    runwayGroup.add(dash);
  }
  const thresholdGeo = new THREE.BoxGeometry(3, 0.15, RUNWAY.width - 4);
  for (const end of [-1, 1]) {
    const bar = new THREE.Mesh(thresholdGeo, dashMat);
    bar.position.set(RUNWAY.x + end * (RUNWAY.length / 2 - 8), runwayTop + 0.08, RUNWAY.z);
    runwayGroup.add(bar);
  }
  const lightGeo = new THREE.SphereGeometry(0.7, 8, 6);
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xffc861, emissive: 0xcc7a00 });
  for (let i = 0; i < 12; i += 1) {
    for (const side of [-1, 1]) {
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(RUNWAY.x - RUNWAY.length / 2 + 20 + i * 36, runwayTop + 0.5, RUNWAY.z + side * (RUNWAY.width / 2 + 3));
      runwayGroup.add(light);
    }
  }
  // A windsock by the strip, so the pilot can see the wind at a glance.
  const sockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 14, 8),
    new THREE.MeshLambertMaterial({ color: 0xdddddd })
  );
  sockPole.position.set(RUNWAY.x - 60, runwayTop + 7, RUNWAY.z - 26);
  runwayGroup.add(sockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7, 10),
    new THREE.MeshLambertMaterial({ color: 0xff6a00 })
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(RUNWAY.x - 56, runwayTop + 13.5, RUNWAY.z - 26);
  runwayGroup.add(sock);
  scene.add(runwayGroup);

  // --- The town: houses with pitched roofs around a small church tower. ---
  const townGroup = new THREE.Group();
  const houseColors = [0xe8dcc0, 0xdfc9a8, 0xead9c2, 0xd8b48f];
  const roofColors = [0xb5502e, 0x9c4a2a, 0x7a5a3a, 0x8a3b2e];
  const houseSeed = createNoise2D(seed + 101);
  for (let i = 0; i < 34; i += 1) {
    const angle = houseSeed.fbm(i * 0.37, 2.2) * Math.PI * 2;
    const radius = 20 + Math.abs(houseSeed.fbm(i * 0.61, 8.8)) * (WORLD.town.radius - 30);
    const hx = WORLD.town.x + Math.cos(angle) * radius;
    const hz = WORLD.town.z + Math.sin(angle) * radius;
    const w = 9 + Math.abs(houseSeed.fbm(i * 0.13, 1.1)) * 7;
    const d = 8 + Math.abs(houseSeed.fbm(i * 0.29, 4.4)) * 5;
    const h = 5 + Math.abs(houseSeed.fbm(i * 0.53, 6.6)) * 5;
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: houseColors[i % houseColors.length] })
    );
    walls.position.set(hx, WORLD.town.flattenHeight + h / 2, hz);
    walls.rotation.y = angle;
    townGroup.add(walls);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.72, 3.5, 4),
      new THREE.MeshLambertMaterial({ color: roofColors[i % roofColors.length] })
    );
    roof.position.set(hx, WORLD.town.flattenHeight + h + 1.7, hz);
    roof.rotation.y = angle + Math.PI / 4;
    townGroup.add(roof);
  }
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(10, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xf0e6d0 })
  );
  tower.position.set(WORLD.town.x, WORLD.town.flattenHeight + 13, WORLD.town.z);
  townGroup.add(tower);
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(5, 10, 4),
    new THREE.MeshLambertMaterial({ color: 0x5a6b7a })
  );
  spire.position.set(WORLD.town.x, WORLD.town.flattenHeight + 31, WORLD.town.z);
  spire.rotation.y = Math.PI / 4;
  townGroup.add(spire);
  scene.add(townGroup);

  // --- Trees: instanced trunks and cones, scattered where the ground is grass. ---
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 150 && guard < 4000) {
    guard += 1;
    const x = (noise.fbm(guard * 0.173, 1.7) * 0.5 + 0.5) * 2200 - 1100;
    const z = (noise.fbm(guard * 0.311, 9.3) * 0.5 + 0.5) * 2200 - 1100;
    const h = heightAt(x, z);
    if (h < 4 || h > 55) continue;
    if (Math.hypot(x - RUNWAY.x, z - RUNWAY.z) < 260) continue;
    if (Math.hypot(x - WORLD.town.x, z - WORLD.town.z) < WORLD.town.radius + 20) continue;
    treeSpots.push({ x, z, h, s: 0.7 + Math.abs(noise.fbm(guard * 0.071, 3.3)) * 0.9 });
  }
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.5, 0.7, 4, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.treeTrunk }),
    treeSpots.length
  );
  const leafMesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(3.4, 11, 8),
    new THREE.MeshLambertMaterial({ color: PALETTE.treeLeaf }),
    treeSpots.length
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  treeSpots.forEach((spot, i) => {
    position.set(spot.x, spot.h + 2 * spot.s, spot.z);
    scale.set(spot.s, spot.s, spot.s);
    matrix.compose(position, quaternion, scale);
    trunkMesh.setMatrixAt(i, matrix);
    position.set(spot.x, spot.h + (4 + 5.5) * spot.s, spot.z);
    matrix.compose(position, quaternion, scale);
    leafMesh.setMatrixAt(i, matrix);
  });
  scene.add(trunkMesh);
  scene.add(leafMesh);

  // --- Clouds: instanced puffs, drifting with the wind. ---
  const cloudPuffs = [];
  for (let c = 0; c < 14; c += 1) {
    const cx = (noise.fbm(c * 0.43, 12.1) * 0.5 + 0.5) * 2400 - 1200;
    const cz = (noise.fbm(c * 0.79, 21.7) * 0.5 + 0.5) * 2400 - 1200;
    const cy = 260 + Math.abs(noise.fbm(c * 0.19, 4.9)) * 160;
    const puffs = 3 + Math.floor(Math.abs(noise.fbm(c * 0.97, 7.7)) * 3);
    for (let p = 0; p < puffs; p += 1) {
      cloudPuffs.push({
        x: cx + (p - puffs / 2) * 16,
        y: cy + (p % 2) * 5,
        z: cz + (p % 3 - 1) * 8,
        s: 9 + Math.abs(noise.fbm(c * 0.31 + p, 2.2)) * 12,
      });
    }
  }
  const cloudMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
    cloudPuffs.length
  );
  scene.add(cloudMesh);

  // --- The rings: toruses on the route, each numbered, the next one glowing. ---
  function makeLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.0)';
    ctx.clearRect(0, 0, 128, 128);
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.fillStyle = '#12303f';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 68);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(14, 14, 1);
    return sprite;
  }
  const rings = RINGS.route.map((point, index) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(RINGS.radius, 1.6, 12, 42),
      new THREE.MeshLambertMaterial({ color: PALETTE.ringNext, emissive: PALETTE.ringNext, emissiveIntensity: 0.55 })
    );
    mesh.position.set(point.x, point.y, point.z);
    // Face the ring toward the plane's approach: from the previous point.
    const prev = RINGS.route[(index + RINGS.route.length - 1) % RINGS.route.length];
    const direction = new THREE.Vector3(point.x - prev.x, point.y - prev.y, point.z - prev.z).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    scene.add(mesh);
    const label = makeLabel(String(index + 1));
    label.position.set(point.x, point.y + RINGS.radius + 12, point.z);
    scene.add(label);
    return { index, position: new THREE.Vector3(point.x, point.y, point.z), mesh, label, state: 'todo' };
  });

  // --- Per-frame life: clouds drift, the next ring pulses. ---
  let time = 0;
  function update(dt) {
    time += dt;
    cloudPuffs.forEach((puff, i) => {
      const x = puff.x + time * 3;
      const wrapped = ((x + 1300) % 2600) - 1300;
      position.set(wrapped, puff.y, puff.z);
      scale.set(puff.s, puff.s * 0.55, puff.s);
      matrix.compose(position, quaternion, scale);
      cloudMesh.setMatrixAt(i, matrix);
    });
    cloudMesh.instanceMatrix.needsUpdate = true;
    rings.forEach((ring) => {
      if (ring.state === 'next') {
        const pulse = 1 + 0.045 * Math.sin(time * 4);
        ring.mesh.scale.set(pulse, pulse, pulse);
        ring.mesh.material.emissiveIntensity = 0.7 + 0.3 * Math.sin(time * 4);
      } else {
        ring.mesh.scale.set(1, 1, 1);
      }
    });
  }

  function setRingStates(nextIndex, doneCount) {
    rings.forEach((ring, i) => {
      if (i < doneCount) {
        ring.state = 'done';
        ring.mesh.material.color.setHex(PALETTE.ringDone);
        ring.mesh.material.emissive.setHex(PALETTE.ringDone);
        ring.mesh.material.emissiveIntensity = 0.35;
      } else if (i === nextIndex) {
        ring.state = 'next';
        ring.mesh.material.color.setHex(PALETTE.ringActive);
        ring.mesh.material.emissive.setHex(PALETTE.ringActive);
        ring.mesh.material.emissiveIntensity = 0.8;
      } else {
        ring.state = 'todo';
        ring.mesh.material.color.setHex(0x9fb4c0);
        ring.mesh.material.emissive.setHex(PALETTE.ringNext);
        ring.mesh.material.emissiveIntensity = 0.12;
      }
    });
  }
  setRingStates(0, 0);

  return {
    scene,
    heightAt,
    rings,
    runway: { x: RUNWAY.x, z: RUNWAY.z, length: RUNWAY.length, width: RUNWAY.width, topY: runwayTop, headingDeg: RUNWAY.headingDeg },
    update,
    setRingStates,
  };
}
