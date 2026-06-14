import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEarth } from './earth.js';
import { createAtmosphere } from './atmosphere.js';
import { createClouds } from './clouds.js';
import { createStarfield } from './starfield.js';
import { getSunDirection } from './sun.js';

// Frame the globe from the side of the Sun, so the day side, the soft
// terminator, and the night side (with its glowing city lights) are all on
// screen at any time of day. Without this, when the real Sun happens to sit
// behind the camera the whole disc is daylit and no terminator is visible.
// The Sun direction itself still comes from the real UTC clock.
function framedCameraPosition(camera) {
  const sun = getSunDirection();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(sun, up);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0); // Sun directly over a pole
  right.normalize();
  const camUp = new THREE.Vector3().crossVectors(right, sun).normalize();
  const tilt = THREE.MathUtils.degToRad(22); // a gentle look-down angle
  // A direction perpendicular to the Sun → the terminator runs down the middle.
  const dir = right.multiplyScalar(Math.cos(tilt)).add(camUp.multiplyScalar(Math.sin(tilt))).normalize();

  // Pull back far enough that the whole globe fits with breathing room around
  // it, using whichever field of view is narrower — so it's never cropped,
  // in landscape or portrait.
  const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  const halfFov = Math.min(vHalf, hHalf);
  let distance = 1.5 / Math.sin(halfFov); // globe radius 1 + ~50% breathing room
  distance = THREE.MathUtils.clamp(distance, 3, 6); // sensible, clear of the zoom-out exit
  return dir.multiplyScalar(distance);
}

// The close-up Earth — exactly the day/night globe from before, now packaged
// as a self-contained "view" (its own scene, camera and controls) so the app
// can switch between this and the solar-system view.
export function createEarthView(canvas, maxAnisotropy = 1, manager) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.copy(framedCameraPosition(camera));

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 1.5;
  controls.maxDistance = 12;   // lets you pull back to the "leave Earth" threshold
  controls.enablePan = false;

  const earth = createEarth(maxAnisotropy, manager);
  const clouds = createClouds(maxAnisotropy, manager);
  const atmosphere = createAtmosphere();
  scene.add(earth);
  scene.add(clouds);
  scene.add(atmosphere);
  scene.add(createStarfield());

  function update(dt) {
    const sun = getSunDirection();
    earth.material.uniforms.sunDirection.value.copy(sun);
    clouds.material.uniforms.sunDirection.value.copy(sun);
    atmosphere.material.uniforms.sunDirection.value.copy(sun);
    earth.rotation.y += 0.048 * dt;  // slow auto-spin (same speed as before)
    clouds.rotation.y += 0.062 * dt; // a touch faster, so clouds drift over the surface
  }

  function getDistance() {
    return controls.getDistance();
  }

  // Put the camera back to the default head-on framing.
  function reset() {
    camera.position.copy(framedCameraPosition(camera));
    controls.target.set(0, 0, 0);
    controls.update();
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  return { scene, camera, controls, update, getDistance, reset, resize };
}
