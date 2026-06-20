import * as THREE from 'three';
import { localFromLatLng } from './pins.js';

const FETCH_INTERVAL_MS = 5_000;
const TRAIL_MAX_POINTS  = 180;
const ISS_API           = 'https://api.wheretheiss.at/v1/satellites/25544';
const ISS_RADIUS        = 1.008;  // visually above surface
const TRAIL_RADIUS      = 1.001;

// ── canvas sprite texture ──────────────────────────────────────────────────

function buildISSTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx  = canvas.getContext('2d');
  const cx   = size / 2;
  const cy   = size / 2;

  // Outer glow
  const glow = ctx.createRadialGradient(cx, cy, size * 0.08, cx, cy, size * 0.5);
  glow.addColorStop(0,   'rgba(255, 215, 0, 0.9)');
  glow.addColorStop(0.4, 'rgba(255, 215, 0, 0.4)');
  glow.addColorStop(1,   'rgba(255, 215, 0, 0.0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // Bright core
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.12);
  core.addColorStop(0, 'rgba(255, 255, 200, 1.0)');
  core.addColorStop(1, 'rgba(255, 215,   0, 0.0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.18, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// ── trail geometry helpers ─────────────────────────────────────────────────

function buildTrailGeometry() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(TRAIL_MAX_POINTS * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setDrawRange(0, 0);
  return geo;
}

// ── factory ───────────────────────────────────────────────────────────────

export function createISSTracker(earthMesh) {
  // Sprite
  const spriteMat = new THREE.SpriteMaterial({
    map:         buildISSTexture(),
    color:       0xffd700,
    transparent: true,
    depthWrite:  false,
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.04, 0.04, 1);
  sprite.visible = false;
  earthMesh.add(sprite);

  // Trail
  const trailGeo = buildTrailGeometry();
  const trailMat = new THREE.LineBasicMaterial({
    color:       0xffd700,
    opacity:     0.35,
    transparent: true,
  });
  const trail = new THREE.Line(trailGeo, trailMat);
  earthMesh.add(trail);

  // State
  const trailPositions = [];          // array of THREE.Vector3
  let currentPos  = null;             // THREE.Vector3 current (lerped)
  let targetPos   = null;             // THREE.Vector3 goal
  let fetchTimer  = null;
  let pulseT      = 0;

  let info = {
    lat:        0,
    lng:        0,
    altKm:      408,
    speedKmh:   27600,
    visibility: 'unknown',
    lastUpdate: null,
  };

  // ── trail update ──────────────────────────────────────────────────────

  function pushTrailPoint(vec3) {
    trailPositions.push(vec3.clone());
    if (trailPositions.length > TRAIL_MAX_POINTS) {
      trailPositions.shift();
    }

    const posAttr = trailGeo.attributes.position;
    const count   = trailPositions.length;
    for (let i = 0; i < count; i++) {
      posAttr.setXYZ(i, trailPositions[i].x, trailPositions[i].y, trailPositions[i].z);
    }
    posAttr.needsUpdate = true;
    trailGeo.setDrawRange(0, count);
  }

  // ── fetch ─────────────────────────────────────────────────────────────

  async function fetchISS() {
    try {
      const resp = await fetch(ISS_API);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const lat = parseFloat(data.latitude);
      const lng = parseFloat(data.longitude);
      if (isNaN(lat) || isNaN(lng)) throw new Error('Bad lat/lng');

      info = {
        lat,
        lng,
        altKm:      408,
        speedKmh:   27600,
        visibility: data.visibility || 'unknown',
        lastUpdate: Date.now(),
      };

      const newTarget = localFromLatLng(lat, lng, ISS_RADIUS);

      // Initialise currentPos on first fetch
      if (!currentPos) {
        currentPos = newTarget.clone();
        sprite.position.copy(currentPos);
        sprite.visible = true;
      }

      targetPos = newTarget;

      // Push trail point at surface level
      const trailPt = localFromLatLng(lat, lng, TRAIL_RADIUS);
      pushTrailPoint(trailPt);

    } catch (err) {
      console.warn('[iss] fetch error:', err);
    }

    fetchTimer = setTimeout(fetchISS, FETCH_INTERVAL_MS);
  }

  // Start fetching
  fetchISS();

  // ── public API ────────────────────────────────────────────────────────

  return {
    /** Call each animation frame with delta time in seconds. */
    update(dt) {
      pulseT += dt * 1.8; // pulse frequency

      // Lerp ISS toward target position
      if (currentPos && targetPos) {
        const speed = Math.min(1.0, dt * 2.0); // smooth ~0.5 s travel
        currentPos.lerp(targetPos, speed);
        sprite.position.copy(currentPos);
      }

      // Pulse: gently scale the sprite with a sine wave
      if (sprite.visible) {
        const pulse = 1.0 + 0.18 * Math.sin(pulseT);
        sprite.scale.set(0.04 * pulse, 0.04 * pulse, 1);
      }
    },

    getClickable() {
      return sprite;
    },

    getInfo() {
      return { ...info };
    },
  };
}
