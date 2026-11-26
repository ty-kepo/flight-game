// Cameras for Island Ring Run: a chase camera that follows the plane from behind
// and above without ever fighting the pilot, and a cockpit camera on the nose.
// The chase camera chases a point behind the plane and eases toward it, so it
// swings smoothly through turns instead of snapping; the cockpit camera sits
// where the pilot sits and looks where the nose points.

import { CAMERA } from './config.js';

export function createCameras(THREE, camera) {
  // A smoothed chase position, so the view never jerks when the plane banks.
  const chasePosition = new THREE.Vector3(0, 0, 0);
  const lookTarget = new THREE.Vector3(0, 0, 0);
  let initialised = false;

  function update(plane, mode, dt) {
    if (mode === 'cockpit') {
      camera.fov = CAMERA.cockpitFov;
      camera.updateProjectionMatrix();
      const forward = plane.forwardVector();
      const up = new THREE.Vector3(0, 1, 0);
      camera.position.copy(plane.state.position).addScaledVector(forward, 1.6);
      camera.position.y += 1.15;
      lookTarget.copy(plane.state.position).addScaledVector(forward, 120);
      camera.up.copy(up);
      camera.lookAt(lookTarget);
      initialised = false;
      return;
    }

    // Chase view: behind the plane, above it, looking ahead down the nose.
    camera.fov = CAMERA.chaseFov;
    camera.updateProjectionMatrix();
    const forward = plane.forwardVector();
    const desired = new THREE.Vector3()
      .copy(plane.state.position)
      .addScaledVector(forward, -CAMERA.chaseDistance);
    desired.y += CAMERA.chaseHeight;
    if (!initialised) {
      chasePosition.copy(desired);
      initialised = true;
    }
    const stiffness = 1 - Math.exp(-CAMERA.chaseStiffness * dt);
    chasePosition.lerp(desired, stiffness);
    camera.position.copy(chasePosition);
    lookTarget.copy(plane.state.position).addScaledVector(forward, CAMERA.chaseLookAhead);
    camera.up.set(0, 1, 0);
    camera.lookAt(lookTarget);
  }

  // A fixed scenic pose for the title screen: the plane on the runway, seen
  // from ahead and to the side, with the island behind it. The camera sits
  // high and aims above the plane, so the plane reads in the lower part of
  // the frame, clear of the centred title panel.
  function titlePose(plane, world) {
    const forward = plane.forwardVector();
    camera.fov = 62;
    camera.updateProjectionMatrix();
    camera.position.copy(plane.state.position).addScaledVector(forward, 52);
    camera.position.y = plane.state.position.y + 30;
    camera.position.x += 14;
    lookTarget.copy(plane.state.position).addScaledVector(forward, -10);
    lookTarget.y = plane.state.position.y + 26;
    camera.up.set(0, 1, 0);
    camera.lookAt(lookTarget);
    initialised = false;
  }

  return { update, titlePose };
}
