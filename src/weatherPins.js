// Weather-at-pins — fetches Open-Meteo for each visited pin, shows emoji sprites.
import * as THREE from 'three';
import { localFromLatLng } from './pins.js';

const CACHE_KEY  = 'wanderglobe_weather';
const CACHE_TTL  = 3600 * 1000; // 1 hour
const BATCH_DELAY = 120; // ms between Open-Meteo requests

// WMO weather codes → text label
function wmoEmoji(code) {
  if (code == null) return '—';
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly Cloudy';
  if (code <= 3) return 'Overcast';
  if (code <= 49) return 'Foggy';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain';
  if (code <= 86) return 'Snow';
  if (code <= 99) return 'Storm';
  return '—';
}

function wmoLabel(code) {
  if (code == null) return 'Unknown';
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code <= 3) return 'Overcast';
  if (code <= 49) return 'Foggy';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function buildEmojiTexture(emoji) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '44px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 32, 34);
  return new THREE.CanvasTexture(c);
}

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; }
}
function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

export function createWeatherPins(earthMesh, { getPins }) {
  const group = new THREE.Group();
  earthMesh.add(group);
  group.visible = false;

  const sprites = []; // { sprite, pinId }
  const weatherData = {}; // pinId → { emoji, tempC, windKmh, condition, ts }
  let texCache = {}; // emoji → texture

  function getTex(emoji) {
    if (!texCache[emoji]) texCache[emoji] = buildEmojiTexture(emoji);
    return texCache[emoji];
  }

  function clearSprites() {
    for (const { sprite } of sprites) group.remove(sprite);
    sprites.length = 0;
  }

  function rebuildSprites() {
    clearSprites();
    const pins = getPins().filter((p) => p.type === 'visited');
    for (const pin of pins) {
      const w = weatherData[pin.id];
      if (!w) continue;
      const mat = new THREE.SpriteMaterial({ map: getTex(w.emoji), transparent: true, depthWrite: false });
      const s   = new THREE.Sprite(mat);
      s.scale.setScalar(0.055);
      s.position.copy(localFromLatLng(pin.lat, pin.lng, 1.045));
      s.userData.pinId = pin.id;
      group.add(s);
      sprites.push({ sprite: s, pinId: pin.id });
    }
  }

  async function fetchOne(pin) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${pin.lat}&longitude=${pin.lng}&current_weather=true`;
    const r = await fetch(url);
    const j = await r.json();
    const cw = j.current_weather;
    return {
      emoji:   wmoEmoji(cw?.weathercode),
      tempC:   cw?.temperature != null ? Math.round(cw.temperature) : null,
      windKmh: cw?.windspeed != null ? Math.round(cw.windspeed) : null,
      condition: wmoLabel(cw?.weathercode),
      ts: Date.now(),
    };
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  async function refreshAll() {
    const cache = loadCache();
    const now   = Date.now();
    const pins  = getPins().filter((p) => p.type === 'visited');

    for (const pin of pins) {
      const cached = cache[pin.id];
      if (cached && now - cached.ts < CACHE_TTL) {
        weatherData[pin.id] = cached;
        continue;
      }
      try {
        const w = await fetchOne(pin);
        weatherData[pin.id] = w;
        cache[pin.id] = w;
      } catch {}
      await sleep(BATCH_DELAY);
    }
    saveCache(cache);
    rebuildSprites();
  }

  return {
    setVisible(v) { group.visible = !!v; if (v) refreshAll(); },
    refresh() { return refreshAll(); },
    rebuild() { rebuildSprites(); },

    getWeather(pinId) { return weatherData[pinId] || null; },

    // Returns HTML to inject into the pin info card
    cardHtml(pinId) {
      const w = weatherData[pinId];
      if (!w) return '';
      const parts = [w.emoji, w.condition];
      if (w.tempC != null) parts.push(`${w.tempC}°C`);
      if (w.windKmh != null) parts.push(`Wind: ${w.windKmh} km/h`);
      return `<div class="pin-weather">${parts.join(' · ')}</div>`;
    },

    update() {},
    dispose() { earthMesh.remove(group); Object.values(texCache).forEach((t) => t.dispose()); },
  };
}
