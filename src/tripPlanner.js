import * as THREE from 'three';
import { localFromLatLng } from './pins.js';

// Trip Planner. A right-hand sheet that lists the user's Wishlist pins as
// draggable waypoints; reordering them redraws an animated cyan great-circle
// route on the globe (same arc style as the flight paths, but blue/cyan) with a
// single plane-dot looping the whole journey. Shows total distance, estimated
// flight time (800 km/h) and stop count, can launch a cinematic fly-through of
// just these waypoints, and saves named routes to localStorage.

const KEY = 'wanderglobe_routes';
const ROUTE_R = 1.02;       // arc endpoint radius — just above the surface
const CYAN = 0x49e0ff;      // route + dot colour
const TRAIL = 6;
const $ = (id) => document.getElementById(id);

function haversine(a, b) {
  const R = 6371; // km
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Soft additive cyan blob for the travelling dot + its trail.
function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(170,240,255,0.9)');
  g.addColorStop(0.7, 'rgba(73,224,255,0.35)');
  g.addColorStop(1.0, 'rgba(73,224,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createTripPlanner({ earthView, getPins, sound, startJourney, setHint, earthHint }) {
  const earthMesh = earthView.earth;

  // ── 3D route layer (lives on the Earth so it rides the spin) ───────────────
  const group = new THREE.Group();
  group.visible = false;
  earthMesh.add(group);
  const dotTex = dotTexture();

  let segments = [];   // [{ curve, tube }]
  let dotMat = null;
  let dot = null;
  let trail = [];
  let routeT = 0;      // 0..1 progress of the plane-dot across the whole route

  function clearRoute() {
    for (const s of segments) {
      group.remove(s.tube);
      s.tube.geometry.dispose();
      s.tube.material.dispose();
    }
    segments = [];
    if (dot) { group.remove(dot); dot.material.dispose(); dot = null; dotMat = null; }
    for (const t of trail) { group.remove(t); t.material.dispose(); }
    trail = [];
  }

  // Build cyan arcs through the ordered waypoints (consecutive pairs).
  function buildRoute(pts) {
    clearRoute();
    if (!pts || pts.length < 2) return;
    const verts = pts.map((p) => localFromLatLng(p.lat, p.lng, ROUTE_R));
    for (let i = 1; i < verts.length; i++) {
      const a = verts[i - 1];
      const b = verts[i];
      const angle = a.angleTo(b);
      const lift = ROUTE_R + 0.10 + angle * 0.40;
      const mid = a.clone().add(b).normalize().multiplyScalar(lift);
      const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
      const geo = new THREE.TubeGeometry(curve, 48, 0.0045, 8, false);
      const mat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.6, depthWrite: false });
      const tube = new THREE.Mesh(geo, mat);
      group.add(tube);
      segments.push({ curve });
      segments[segments.length - 1].tube = tube;
    }
    dotMat = new THREE.SpriteMaterial({ map: dotTex, color: CYAN, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    dot = new THREE.Sprite(dotMat);
    dot.scale.setScalar(0.055);
    group.add(dot);
    for (let k = 0; k < TRAIL; k++) {
      const tm = new THREE.SpriteMaterial({ map: dotTex, color: CYAN, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const ts = new THREE.Sprite(tm);
      ts.scale.setScalar(0.055 * (1 - (k + 1) / (TRAIL + 1)));
      group.add(ts);
      trail.push(ts);
    }
    routeT = 0;
  }

  // Sample the whole multi-segment route at global progress t (0..1).
  const _p = new THREE.Vector3();
  function sampleRoute(t, out) {
    const n = segments.length;
    if (!n) return out.set(0, 0, 0);
    const f = (t % 1) * n;
    const idx = Math.min(n - 1, Math.floor(f));
    return segments[idx].curve.getPointAt(f - idx, out);
  }

  function updateLayer(dt) {
    if (!group.visible || !segments.length || !dot) return;
    routeT = (routeT + dt * 0.05) % 1; // gentle loop
    sampleRoute(routeT, _p);
    dot.position.copy(_p);
    for (let k = 0; k < trail.length; k++) {
      let tt = routeT - (k + 1) * 0.01;
      if (tt < 0) tt += 1;
      sampleRoute(tt, _p);
      trail[k].position.copy(_p);
      trail[k].material.opacity = 0.7 * (1 - (k + 1) / (trail.length + 1));
    }
  }

  // ── State + persistence ────────────────────────────────────────────────────
  let order = [];      // ordered array of wishlist pin ids defining the route
  let open = false;
  let routes = load();

  function load() {
    try { const a = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(a)) return a; } catch (e) {}
    return [];
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(routes)); } catch (e) {} }

  function wishlistPins() {
    return (getPins() || []).filter((p) => p.type === 'wishlist');
  }

  // Resolve the ordered id list to live pin objects (dropping any deleted ids).
  function orderedPins() {
    const byId = new Map(wishlistPins().map((p) => [p.id, p]));
    const seen = new Set();
    const list = [];
    for (const id of order) { const p = byId.get(id); if (p && !seen.has(id)) { list.push(p); seen.add(id); } }
    // append any wishlist pins not yet in `order` (e.g. newly added)
    for (const p of wishlistPins()) if (!seen.has(p.id)) list.push(p);
    return list;
  }

  function syncOrder() {
    order = orderedPins().map((p) => p.id);
  }

  // ── DOM ──────────────────────────────────────────────────────────────────
  const panel = $('planner-panel');
  const listEl = $('planner-list');
  const emptyEl = $('planner-empty');
  const statDist = $('planner-dist');
  const statTime = $('planner-time');
  const statStops = $('planner-stops');
  const startBtn = $('planner-start');
  const savedEl = $('planner-saved');

  let dragId = null;

  function fmtTime(hours) {
    if (!hours) return '0m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return (h ? `${h}h ` : '') + `${m}m`;
  }

  function renderList() {
    const pins = orderedPins();
    emptyEl.style.display = pins.length ? 'none' : 'block';
    listEl.innerHTML = pins.map((p, i) => `
      <li class="wp-item" draggable="true" data-id="${p.id}">
        <span class="wp-grip" aria-hidden="true">⠿</span>
        <span class="wp-num">${i + 1}</span>
        <span class="wp-name">${escapeHtml(p.name || 'Untitled')}</span>
      </li>`).join('');

    listEl.querySelectorAll('.wp-item').forEach((el) => {
      el.addEventListener('dragstart', (e) => { dragId = el.dataset.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      el.addEventListener('dragend', () => { dragId = null; el.classList.remove('dragging'); });
      el.addEventListener('dragover', (e) => { e.preventDefault(); });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetId = el.dataset.id;
        if (!dragId || dragId === targetId) return;
        reorder(dragId, targetId);
      });
    });
  }

  function reorder(fromId, toId) {
    syncOrder();
    const fromIdx = order.indexOf(fromId);
    const toIdx = order.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0) return;
    order.splice(toIdx, 0, order.splice(fromIdx, 1)[0]);
    refresh();
    if (sound) sound.click();
  }

  function renderStats(pins) {
    let dist = 0;
    for (let i = 1; i < pins.length; i++) dist += haversine(pins[i - 1], pins[i]);
    statDist.textContent = Math.round(dist).toLocaleString() + ' km';
    statTime.textContent = fmtTime(dist / 800);
    statStops.textContent = String(pins.length);
    startBtn.disabled = pins.length < 2;
  }

  function renderSaved() {
    if (!routes.length) { savedEl.innerHTML = ''; return; }
    savedEl.innerHTML = '<div class="planner-saved-label">Saved routes</div>' +
      routes.map((r) => `<div class="saved-route" data-id="${r.id}">
        <span class="sr-name">${escapeHtml(r.name)}</span>
        <span class="sr-meta">${r.ids.length} stops</span>
        <button class="sr-load" data-id="${r.id}" type="button">Load</button>
        <button class="sr-del" data-id="${r.id}" type="button" aria-label="Delete">×</button>
      </div>`).join('');
    savedEl.querySelectorAll('.sr-load').forEach((b) => b.addEventListener('click', () => loadRoute(b.dataset.id)));
    savedEl.querySelectorAll('.sr-del').forEach((b) => b.addEventListener('click', () => deleteRoute(b.dataset.id)));
  }

  // Recompute everything: list, route geometry, stats.
  function refresh() {
    if (!open) return;
    syncOrder();
    const pins = orderedPins();
    renderList();
    renderStats(pins);
    buildRoute(pins);
  }

  function openPanel() {
    open = true;
    syncOrder();
    group.visible = true;
    panel.classList.add('open');
    renderSaved();
    refresh();
    if (setHint) setHint('Drag to reorder your route · launch a fly-through');
    if (sound) sound.click();
  }
  function close() {
    open = false;
    panel.classList.remove('open');
    group.visible = false;
    clearRoute();
    if (setHint && earthHint) setHint(earthHint);
  }

  function saveRoute() {
    const pins = orderedPins();
    if (pins.length < 2) return;
    const name = (prompt('Name this route', `Route ${routes.length + 1}`) || '').trim();
    if (!name) return;
    routes.push({ id: 'route_' + Date.now().toString(36), name, ids: pins.map((p) => p.id) });
    persist();
    renderSaved();
    if (sound) sound.chime();
  }

  function loadRoute(id) {
    const r = routes.find((x) => x.id === id);
    if (!r) return;
    // keep only ids that still exist as wishlist pins, in the saved order
    const valid = new Set(wishlistPins().map((p) => p.id));
    order = r.ids.filter((x) => valid.has(x));
    refresh();
    if (sound) sound.click();
  }

  function deleteRoute(id) {
    routes = routes.filter((x) => x.id !== id);
    persist();
    renderSaved();
    if (sound) sound.click();
  }

  startBtn.addEventListener('click', () => {
    const pins = orderedPins();
    if (pins.length < 2) return;
    close();
    if (startJourney) startJourney(pins);
  });
  $('planner-save').addEventListener('click', saveRoute);
  $('planner-close').addEventListener('click', () => { close(); if (sound) sound.click(); });

  return {
    open: openPanel,
    close,
    toggle: () => { open ? close() : openPanel(); },
    isOpen: () => open,
    update: updateLayer,
    refresh: () => { if (open) refresh(); },
  };
}
