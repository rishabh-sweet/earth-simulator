import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildSolarSystem } from './solarSystem.js';

// The zoomed-out solar-system view: its own scene, camera and controls plus
// the planets. It can "follow" a focused body (so a clicked planet stays put
// on screen while it keeps orbiting) and report where that body is on screen.
export function createSolarView(canvas, maxAnisotropy = 1) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000003);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 6000);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;       // one-finger rotate, two-finger / scroll zoom
  controls.minDistance = 3;
  controls.maxDistance = 600;
  // Both views share the canvas, so this one stays off until we're in it —
  // otherwise Earth-view scrolling would also drive the solar camera.
  controls.enabled = false;

  const system = buildSolarSystem(maxAnisotropy);
  scene.add(system.root);

  let focused = null;                 // body we're tracking, or null
  const prev = new THREE.Vector3();   // its position last frame (for follow)
  const tmp = new THREE.Vector3();

  function update(dt) {
    system.update(dt);

    // Follow mode: shift the camera and its target by however far the body
    // moved this frame, so it stays framed while the user can still orbit it.
    if (focused) {
      focused.object3d.getWorldPosition(tmp);
      camera.position.add(tmp.clone().sub(prev));
      controls.target.add(tmp.clone().sub(prev));
      prev.copy(tmp);
    }
  }

  function setFocus(body) {
    focused = body;
    body.object3d.getWorldPosition(prev);
  }
  function clearFocus() {
    focused = null;
  }
  const isFocused = () => !!focused;

  // Where a body currently is, in world space (used for camera flights).
  function bodyPosition(body, out) {
    return body.object3d.getWorldPosition(out);
  }

  // Project the focused body to 2D screen pixels for the HTML label lines.
  function focusScreenPos() {
    focused.object3d.getWorldPosition(tmp).project(camera);
    return {
      x: (tmp.x * 0.5 + 0.5) * window.innerWidth,
      y: (-tmp.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  return {
    scene,
    camera,
    controls,
    clickable: system.clickable,
    update,
    setFocus,
    clearFocus,
    isFocused,
    bodyPosition,
    focusScreenPos,
    resize,
  };
}
