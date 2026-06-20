// Seismic history timeline — scrubs through the last 30 days of USGS M2.5+ earthquakes.
import * as THREE from 'three';
import { localFromLatLng } from './pins.js';

const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson';
const SPRITE_URL = null; // use programmatic canvas texture

function buildQuakeTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d'); const cx = 32, cy = 32;
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 28);
  g.addColorStop(0, 'rgba(255,80,30,0.95)');
  g.addColorStop(0.5, 'rgba(255,120,0,0.5)');
  g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function dayKey(isoString) {
  return isoString ? isoString.slice(0, 10) : null;
}

export function createSeismicTimeline(seismicLayer, earthMesh) {
  let allQuakes = []; // flat array, each: { lat, lng, mag, place, time, depth }
  let byDay = {}; // { 'YYYY-MM-DD': [quakes] }
  let loaded = false;
  let playing = false;
  let playTimer = null;

  const group = new THREE.Group();
  earthMesh.add(group);
  group.visible = false;

  const spriteTex = buildQuakeTexture();
  const activeSprites = [];

  const sliderEl  = document.getElementById('stl-slider');
  const dateEl    = document.getElementById('stl-date');
  const playBtn   = document.getElementById('stl-play');
  const timelineEl = document.getElementById('seismic-timeline');

  // ── Data loading ──────────────────────────────────────────────────────────
  async function loadData() {
    if (loaded) return;
    try {
      const r = await fetch(USGS_URL);
      const j = await r.json();
      allQuakes = (j.features || []).map((f) => ({
        lat: f.geometry?.coordinates?.[1],
        lng: f.geometry?.coordinates?.[0],
        depth: f.geometry?.coordinates?.[2],
        mag: f.properties?.mag,
        place: f.properties?.place,
        time: f.properties?.time, // ms epoch
      })).filter((q) => q.lat != null && q.lng != null);

      // Group by UTC day
      byDay = {};
      for (const q of allQuakes) {
        const key = q.time ? new Date(q.time).toISOString().slice(0, 10) : null;
        if (!key) continue;
        (byDay[key] = byDay[key] || []).push(q);
      }
      loaded = true;
    } catch (e) { /* silent fail */ }
  }

  // ── Build sprites for a set of quakes ────────────────────────────────────
  function clearSprites() {
    for (const s of activeSprites) group.remove(s);
    activeSprites.length = 0;
  }

  function showQuakes(quakes) {
    clearSprites();
    for (const q of quakes) {
      const scale = Math.max(0.01, Math.min(0.06, (q.mag || 3) * 0.008));
      const mat = new THREE.SpriteMaterial({ map: spriteTex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(scale);
      sprite.position.copy(localFromLatLng(q.lat, q.lng, 1.005));
      group.add(sprite);
      activeSprites.push(sprite);
    }
  }

  // ── Slider logic ──────────────────────────────────────────────────────────
  function getDayKeys() {
    const keys = Object.keys(byDay).sort();
    return keys;
  }

  function updateToSliderValue(val) {
    if (!loaded) return;
    const keys = getDayKeys();
    const maxIdx = keys.length - 1;
    const idx = Math.round((val / 30) * maxIdx);
    const key = keys[Math.min(idx, maxIdx)];
    if (!key) return;

    const isToday = idx === maxIdx;
    if (dateEl) dateEl.textContent = isToday ? 'Today (Live)' : formatDate(key);

    if (isToday) {
      // show live seismic layer
      group.visible = false;
      seismicLayer.setVisible(true);
    } else {
      // show historical
      group.visible = true;
      seismicLayer.setVisible(false);
      showQuakes(byDay[key] || []);
    }
  }

  function formatDate(key) {
    const d = new Date(key + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  let sliderActive = false;
  sliderEl?.addEventListener('input', () => {
    sliderActive = true;
    stopPlay();
    updateToSliderValue(parseInt(sliderEl.value, 10));
  });

  function startPlay() {
    if (!loaded) return;
    playing = true;
    if (playBtn) playBtn.textContent = '⏸';
    if (sliderEl) sliderEl.value = '0';
    updateToSliderValue(0);
    playTimer = setInterval(() => {
      const cur = parseInt(sliderEl?.value || '0', 10);
      const next = cur + 1;
      if (next > 30) { stopPlay(); return; }
      if (sliderEl) sliderEl.value = String(next);
      updateToSliderValue(next);
    }, 600);
  }

  function stopPlay() {
    playing = false;
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    if (playBtn) playBtn.textContent = '▶';
  }

  playBtn?.addEventListener('click', () => { playing ? stopPlay() : startPlay(); });

  return {
    show() {
      if (timelineEl) timelineEl.hidden = false;
      loadData().then(() => {
        if (sliderEl) sliderEl.value = '30';
        if (dateEl) dateEl.textContent = 'Today (Live)';
      });
    },
    hide() {
      if (timelineEl) timelineEl.hidden = true;
      stopPlay();
      clearSprites();
      group.visible = false;
      // restore live seismic visibility is handled by caller
    },
    update() {},
    dispose() {
      stopPlay(); earthMesh.remove(group); spriteTex.dispose();
    },
  };
}
