import * as THREE from 'three';
import { createEarthView } from './earthView.js';
import { createSolarView } from './solarView.js';
import { createInfoPanel } from './infoPanel.js';
import { tween, updateTweens } from './tween.js';
import { SoundManager } from './sound.js';

// ── Renderer (shared by both views) ──────────────────────────────────────────
// logarithmicDepthBuffer lets one camera handle both the 1-unit Earth and the
// 1000s-of-units solar system without z-fighting.
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,            // smooth edges
  logarithmicDepthBuffer: true,
  precision: 'highp',         // full float precision in shaders (avoids cracking/banding)
});
// Cap the pixel ratio at 2 — on high-DPI phones a ratio of 3 triples the pixels
// to shade for no visible gain, so this keeps mobile smooth.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// Sharpest texture filtering the GPU supports — shared by both views so the
// planet surfaces stay crisp at grazing angles instead of blocky/seamed.
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

// Tracks texture loading so the loading screen can show real progress.
const loadingManager = new THREE.LoadingManager();

// ── The two views ────────────────────────────────────────────────────────────
const earthView = createEarthView(canvas, maxAnisotropy, loadingManager);
const solarView = createSolarView(canvas, maxAnisotropy, loadingManager);
const infoPanel = createInfoPanel();

// ── Overlay DOM ──────────────────────────────────────────────────────────────
const fadeEl = document.getElementById('fade');
const btnBack = document.getElementById('btn-back');
const btnEarth = document.getElementById('btn-earth');
const btnSound = document.getElementById('btn-sound');
const hintEl = document.getElementById('hint');

// ── Sound ────────────────────────────────────────────────────────────────────
// All audio is synthesised live (see sound.js). It can't start until the user
// interacts (browser autoplay policy), so we unlock it on the first gesture.
const sound = new SoundManager();
sound.setAmbient('earth'); // queued; begins once unlocked
btnSound.classList.toggle('muted', !sound.isEnabled());
btnSound.setAttribute('aria-pressed', String(sound.isEnabled()));

function unlockAudio() {
  sound.unlock();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

btnSound.addEventListener('click', () => {
  sound.unlock(); // the toggle itself is a valid first gesture
  const on = sound.toggle();
  btnSound.classList.toggle('muted', !on);
  btnSound.setAttribute('aria-pressed', String(on));
});

// ── Loading screen ─────────────────────────────────────────────────────────
// Hold the globe behind a full-screen loader until every texture is in, then
// fade through. `ready` gates all interaction until that's done.
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const toastEl = document.getElementById('welcome-toast');
const loadStart = performance.now();
let ready = false;

earthView.controls.enabled = false; // no interaction until loaded

loadingManager.onProgress = (url, loaded, total) => {
  loaderFill.style.transform = `scaleX(${total ? loaded / total : 1})`;
};
loadingManager.onLoad = () => {
  // keep the loader up for a brief floor so it never just flashes
  const elapsed = performance.now() - loadStart;
  setTimeout(revealGlobe, Math.max(0, 750 - elapsed));
};
setTimeout(revealGlobe, 6000); // safety net if loading ever stalls

function revealGlobe() {
  if (ready) return;
  ready = true;
  loaderFill.style.transform = 'scaleX(1)';
  loaderEl.classList.add('done');
  earthView.controls.enabled = true;
  showWelcomeBack();
}

// Returning visitor (name saved by the landing page) → a gentle toast.
function showWelcomeBack() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('wanderglobe_user')); } catch (e) {}
  if (!user || !user.name) return;
  toastEl.textContent = `Welcome back, ${user.name}`;
  setTimeout(() => {
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3000);
  }, 500);
}

// ── App state ────────────────────────────────────────────────────────────────
let mode = 'earth';        // 'earth' (close-up) or 'solar'
let transitioning = false; // mid view-swap (fade in progress)
let flying = false;        // mid camera flight to/from a planet
let focusedBody = null;    // the planet/Sun we're looking at, or null
const busy = () => transitioning || flying;

const EARTH_EXIT_DIST = 8.5; // zoom past this on Earth → enter the solar system
const ORIGIN = new THREE.Vector3(0, 0, 0);
const OVERVIEW_POS = new THREE.Vector3(0, 105, 210);  // full solar-system framing
const SOLAR_START_FAR = new THREE.Vector3(0, 270, 520); // where the fly-in starts (within zoom limit)

// ── Camera flights & fades (all eased tweens) ────────────────────────────────

// Fly a view's camera + orbit target to fixed end points.
function flyCamera(view, toPos, toTarget, duration, onComplete) {
  const fromPos = view.camera.position.clone();
  const fromTarget = view.controls.target.clone();
  tween({
    duration,
    onUpdate: (k) => {
      view.camera.position.lerpVectors(fromPos, toPos, k);
      view.controls.target.lerpVectors(fromTarget, toTarget, k);
    },
    onComplete,
  });
}

// Fly to a planet. Its end point is recomputed every frame because the planet
// keeps orbiting while we approach.
function flyToBody(body, onComplete) {
  const fromPos = solarView.camera.position.clone();
  const fromTarget = solarView.controls.target.clone();
  const dir = new THREE.Vector3(0.55, 0.32, 1).normalize(); // nice 3/4 angle
  const dist = body.radius * 4 + 1.5;
  const endTarget = new THREE.Vector3();
  const endPos = new THREE.Vector3();
  tween({
    duration: 1200,
    onUpdate: (k) => {
      solarView.bodyPosition(body, endTarget);
      endPos.copy(dir).multiplyScalar(dist).add(endTarget);
      solarView.camera.position.lerpVectors(fromPos, endPos, k);
      solarView.controls.target.lerpVectors(fromTarget, endTarget, k);
    },
    onComplete,
  });
}

// Animate the black overlay's opacity.
function fade(to, duration, onComplete) {
  const from = parseFloat(fadeEl.style.opacity || '0');
  tween({
    duration,
    onUpdate: (k) => { fadeEl.style.opacity = (from + (to - from) * k).toFixed(3); },
    onComplete,
  });
}

// ── View transitions (camera fly + fade, never one giant zoom) ───────────────

// Earth close-up  →  solar system.
function goToSolar() {
  transitioning = true;
  earthView.controls.enabled = false;
  sound.whoosh();
  flyCamera(earthView, new THREE.Vector3(0, 0, 16), ORIGIN, 700); // pull away from Earth
  fade(1, 650, () => {
    mode = 'solar';
    sound.setAmbient('solar');
    focusedBody = null;
    solarView.clearFocus();
    solarView.controls.enabled = false;
    solarView.controls.minDistance = 3;
    solarView.controls.maxDistance = 600;
    solarView.camera.position.copy(SOLAR_START_FAR);
    solarView.controls.target.copy(ORIGIN);
    showSolarChrome();
    flyCamera(solarView, OVERVIEW_POS, ORIGIN, 1300, () => {
      transitioning = false;
      solarView.controls.enabled = true;
    });
    fade(0, 900);
  });
}

// Solar system  →  Earth close-up.
function goToEarth() {
  transitioning = true;
  solarView.controls.enabled = false;
  sound.stopRumble();
  sound.reentry();
  infoPanel.hide();
  solarView.clearFocus();
  focusedBody = null;
  hideAllChrome();
  fade(1, 650, () => {
    mode = 'earth';
    sound.setAmbient('earth');
    earthView.reset();
    earthView.controls.enabled = false;
    setHint('Zoom out to enter the solar system');
    fade(0, 800, () => {
      transitioning = false;
      earthView.controls.enabled = true;
    });
  });
}

// ── Focusing a planet / the Sun ──────────────────────────────────────────────
function focusBody(body) {
  if (body === focusedBody) return;
  sound.stopRumble(); // in case we're switching away from the black hole
  infoPanel.hide();
  solarView.clearFocus();
  focusedBody = body;
  flying = true;
  solarView.controls.enabled = false;
  solarView.controls.minDistance = Math.max(0.4, body.radius * 1.25);
  solarView.controls.maxDistance = 800;
  btnBack.classList.add('visible');
  setHint('Tap empty space or “Back” to return');
  sound.whoosh();
  if (body.rumble) sound.startRumble(); // deep gravitational rumble on the black hole
  flyToBody(body, () => {
    flying = false;
    solarView.controls.enabled = true;
    solarView.setFocus(body);
    infoPanel.show(body);
    sound.chime();
  });
}

function unfocus() {
  sound.stopRumble(); // black-hole rumble fades when its card closes
  infoPanel.hide();
  solarView.clearFocus();
  focusedBody = null;
  flying = true;
  solarView.controls.enabled = false;
  solarView.controls.minDistance = 3;
  solarView.controls.maxDistance = 600;
  btnBack.classList.remove('visible');
  setHint('Tap a planet or the Sun to explore · drag to rotate · scroll or pinch to zoom');
  flyCamera(solarView, OVERVIEW_POS, ORIGIN, 1100, () => {
    flying = false;
    solarView.controls.enabled = true;
  });
}

// ── Small UI helpers ─────────────────────────────────────────────────────────
function setHint(text) { hintEl.textContent = text; }
function showSolarChrome() {
  btnEarth.classList.add('visible');
  btnBack.classList.remove('visible');
  setHint('Tap a planet or the Sun to explore · drag to rotate · scroll or pinch to zoom');
}
function hideAllChrome() {
  btnEarth.classList.remove('visible');
  btnBack.classList.remove('visible');
}

btnEarth.addEventListener('click', () => { sound.click(); if (mode === 'solar' && !busy()) goToEarth(); });
btnBack.addEventListener('click', () => { sound.click(); if (mode === 'solar' && !busy() && focusedBody) unfocus(); });

// ── Click / tap to select a body (or empty space to go back) ─────────────────
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pickHit(clientX, clientY) {
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, solarView.camera);
  const hits = raycaster.intersectObjects(solarView.clickable, false);
  return hits.length ? hits[0] : null;
}
function pick(clientX, clientY) {
  const hit = pickHit(clientX, clientY);
  return hit ? hit.object.userData.body : null;
}

// A tap is a press + release that barely moved (so it isn't a drag-rotate).
let pointerDown = null;
canvas.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
});
window.addEventListener('pointerup', (e) => {
  const d = pointerDown;
  pointerDown = null;
  if (!d || !ready || mode !== 'solar' || busy()) return;
  const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
  if (moved > 8 || performance.now() - d.t > 500) return; // it was a drag
  const hit = pickHit(e.clientX, e.clientY);
  const body = hit ? hit.object.userData.body : null;
  if (body) {
    // For an asteroid-belt rock, anchor the card's lines at the exact click.
    if (body.dynamicAnchor && body !== focusedBody && body.object3d) {
      body.object3d.position.copy(hit.point);
    }
    focusBody(body);
  } else if (focusedBody) {
    unfocus();
  }
});

// Hover a body in the solar view → play its unique tone (once per entry).
let hoveredKey = null;
let lastHoverCheck = 0;
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;          // touch has no hover
  if (!ready || mode !== 'solar' || busy()) { hoveredKey = null; return; }
  const now = performance.now();
  if (now - lastHoverCheck < 60) return;          // throttle the raycast
  lastHoverCheck = now;
  const body = pick(e.clientX, e.clientY);
  const key = body ? body.key : null;
  if (key !== hoveredKey) {
    hoveredKey = key;
    if (key) sound.hover(key);
    canvas.style.cursor = key ? 'pointer' : '';
  }
});

// ── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  earthView.resize();
  solarView.resize();
});

// ── Main loop ────────────────────────────────────────────────────────────────
setHint('Zoom out to enter the solar system');
let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  updateTweens(now);

  if (mode === 'earth') {
    earthView.update(dt);
    if (!busy()) earthView.controls.update();
    renderer.render(earthView.scene, earthView.camera);
    // Pull back far enough and we leave for the solar system.
    if (ready && !busy() && earthView.getDistance() > EARTH_EXIT_DIST) goToSolar();
  } else {
    solarView.update(dt);
    if (!busy()) solarView.controls.update();
    renderer.render(solarView.scene, solarView.camera);
    if (solarView.isFocused()) {
      const p = solarView.focusScreenPos();
      infoPanel.update(p.x, p.y);
    }
  }
}
requestAnimationFrame(animate);
