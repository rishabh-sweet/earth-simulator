import * as THREE from 'three';
import { localFromLatLng } from './pins.js';
import { easeInOutCubic } from './tween.js';

// Cinematic auto-pilot: flies the camera between the user's visited pins like a
// movie — transit along a great-circle-ish arc (pull back, then swoop in),
// hover and gently orbit for a few seconds while a title card fades in, then on
// to the next pin, looping. Driven from the main render loop via update(dt).

const HOVER_DIST = 1.9;   // how close the camera sits over a pin
const TRANSIT = 2.4;      // seconds to fly between pins
const HOVER = 3.0;        // seconds hovering over each pin
const PULLBACK = 1.8;     // extra distance lifted mid-transit

// Spherical interpolation between two unit direction vectors.
function slerpDir(a, b, t) {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  if (dot > 0.9995) return a.clone().lerp(b, t).normalize();
  const theta = Math.acos(dot) * t;
  const rel = b.clone().sub(a.clone().multiplyScalar(dot)).normalize();
  return a.clone().multiplyScalar(Math.cos(theta)).add(rel.multiplyScalar(Math.sin(theta)));
}

export function createCinematic({ earthView, sound, getVisitedPins }) {
  const cineEl = document.getElementById('cinematic');
  const titleEl = document.getElementById('cine-title');
  const ORIGIN = new THREE.Vector3(0, 0, 0);

  let active = false;
  let activatedAt = 0;
  let seq = [];
  let i = 0;
  let phase = 'transit';
  let t = 0;
  let startPos = new THREE.Vector3();
  let endDir = new THREE.Vector3();
  let startLen = 4;
  let titleShown = false;

  function worldDirFor(pin) {
    const local = localFromLatLng(pin.lat, pin.lng, 1);
    earthView.earth.localToWorld(local);
    return local.normalize();
  }

  function beginTransit() {
    phase = 'transit';
    t = 0;
    titleShown = false;
    titleEl.classList.remove('show');
    startPos = earthView.camera.position.clone();
    startLen = startPos.length();
    endDir = worldDirFor(seq[i]);
    sound.whoosh();
  }

  function showTitle(pin) {
    titleEl.innerHTML = `<span class="ct-name">${(pin.name || 'Untitled place')
      .replace(/[&<>]/g, '')}</span>` + (pin.note ? `<span class="ct-note">${pin.note.replace(/[&<>]/g, '')}</span>` : '');
    titleEl.classList.add('show');
    titleShown = true;
  }

  function start() {
    const visited = getVisitedPins();
    if (visited.length < 2) return false;
    seq = visited;
    active = true;
    activatedAt = performance.now();
    i = 0;
    earthView.controls.enabled = false;
    earthView.setSpin(false);
    document.body.classList.add('cinematic-on');
    cineEl.classList.add('on');
    cineEl.setAttribute('aria-hidden', 'false');
    beginTransit();
    return true;
  }

  function exit() {
    if (!active) return;
    active = false;
    document.body.classList.remove('cinematic-on');
    cineEl.classList.remove('on');
    cineEl.setAttribute('aria-hidden', 'true');
    titleEl.classList.remove('show');
    earthView.controls.target.copy(ORIGIN);
    earthView.controls.enabled = true;
    earthView.setSpin(true);
  }

  function update(dt) {
    if (!active) return;
    if (!seq.length) { exit(); return; }
    const cam = earthView.camera;

    if (phase === 'transit') {
      t += dt / TRANSIT;
      const k = easeInOutCubic(Math.min(t, 1));
      const dir = slerpDir(startPos.clone().normalize(), endDir, k);
      const len = THREE.MathUtils.lerp(startLen, HOVER_DIST, k) + Math.sin(k * Math.PI) * PULLBACK;
      cam.position.copy(dir.multiplyScalar(len));
      cam.lookAt(ORIGIN);
      if (t >= 1) { phase = 'hover'; t = 0; showTitle(seq[i]); }
    } else {
      t += dt;
      // gentle orbit: oscillate around world-up while keeping the pin framed
      const ang = Math.sin(t * 0.5) * 0.13;
      const dir = endDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      const len = HOVER_DIST + Math.sin(t * 0.8) * 0.06;
      cam.position.copy(dir.multiplyScalar(len));
      cam.lookAt(ORIGIN);
      if (titleShown && t > HOVER - 0.5) { titleEl.classList.remove('show'); titleShown = false; }
      if (t >= HOVER) { i = (i + 1) % seq.length; beginTransit(); }
    }
  }

  return {
    start,
    exit,
    update,
    isActive: () => active,
    canExit: () => active && performance.now() - activatedAt > 500,
  };
}
