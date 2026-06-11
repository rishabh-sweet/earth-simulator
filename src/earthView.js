import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEarth } from './earth.js';
import { createAtmosphere } from './atmosphere.js';
import { createStarfield } from './starfield.js';
import { getSunDirection } from './sun.js';

// The close-up Earth — exactly the day/night globe from before, now packaged
// as a self-contained "view" (its own scene, camera and controls) so the app
// can switch between this and the solar-system view.
export function createEarthView(canvas, maxAnisotropy = 1) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 3);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 1.5;
  controls.maxDistance = 12;   // lets you pull back to the "leave Earth" threshold
  controls.enablePan = false;

  const earth = createEarth(maxAnisotropy);
  const atmosphere = createAtmosphere();
  scene.add(earth);
  scene.add(atmosphere);
  scene.add(createStarfield());

  function update(dt) {
    const sun = getSunDirection();
    earth.material.uniforms.sunDirection.value.copy(sun);
    atmosphere.material.uniforms.sunDirection.value.copy(sun);
    earth.rotation.y += 0.048 * dt; // slow auto-spin (same speed as before)
  }

  function getDistance() {
    return controls.getDistance();
  }

  // Put the camera back to the default head-on framing.
  function reset() {
    camera.position.set(0, 0, 3);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  return { scene, camera, controls, update, getDistance, reset, resize };
}
