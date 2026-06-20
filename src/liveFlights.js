import * as THREE from 'three';
import { localFromLatLng } from './pins.js';

const MAX_INSTANCES = 3000;
const REFRESH_INTERVAL_MS = 60_000;
const RETRY_ON_ERROR_MS = 300_000;

const COLOR_LOW  = new THREE.Color(1.0, 0.9, 0.2);   // yellow  < 3000 m
const COLOR_MID  = new THREE.Color(0.9, 0.9, 0.9);   // white  3000–10000 m
const COLOR_HIGH = new THREE.Color(0.4, 0.75, 1.0);  // blue    > 10000 m

function buildTriangleGeometry() {
  const geo = new THREE.BufferGeometry();
  // tip pointing in +Y (north), wings spread in ±X
  const verts = new Float32Array([
     0.000,  0.013, 0,   // tip
    -0.006, -0.005, 0,   // left wing
     0.006, -0.005, 0,   // right wing
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex([0, 1, 2]);
  geo.computeVertexNormals();
  return geo;
}

function altColor(baroAlt) {
  if (baroAlt == null || baroAlt < 3000) return COLOR_LOW;
  if (baroAlt < 10000) return COLOR_MID;
  return COLOR_HIGH;
}

export function createLiveFlights(earthMesh) {
  const geo  = buildTriangleGeometry();
  const mat  = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_INSTANCES);
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_INSTANCES * 3), 3
  );
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  earthMesh.add(mesh);

  // State
  let flightData     = [];   // parallel array to instance indices
  let trackedIcao    = null;
  let countCallback  = null;
  let refreshTimer   = null;

  // ── helpers ──────────────────────────────────────────────────────────────

  function positionInstance(idx, lat, lng, heading) {
    const pos = localFromLatLng(lat, lng, 1.003);
    const up  = localFromLatLng(lat, lng, 1).normalize();

    // Tangent-space basis: project world north onto the tangent plane
    const worldNorth = new THREE.Vector3(0, 1, 0);
    const dot        = worldNorth.dot(up);
    const north      = worldNorth.clone().sub(up.clone().multiplyScalar(dot)).normalize();
    const east       = new THREE.Vector3().crossVectors(north, up).normalize();

    const headingRad = heading * Math.PI / 180;
    const cosH = Math.cos(headingRad);
    const sinH = Math.sin(headingRad);

    const fwd   = north.clone().multiplyScalar(cosH).add(east.clone().multiplyScalar(sinH));
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize();

    const m = new THREE.Matrix4();
    m.makeBasis(right, fwd, up);
    m.setPosition(pos);
    mesh.setMatrixAt(idx, m);
  }

  // ── fetch & update ───────────────────────────────────────────────────────

  async function refresh() {
    if (!mesh.visible) return;

    let raw;
    try {
      const resp = await fetch('https://opensky-network.org/api/states/all');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      raw = await resp.json();
    } catch (err) {
      console.warn('[liveFlights] fetch error, retrying in 5 min:', err);
      scheduleRefresh(RETRY_ON_ERROR_MS);
      return;
    }

    const states = (raw && Array.isArray(raw.states)) ? raw.states : [];
    flightData = [];
    let count = 0;

    for (const s of states) {
      if (count >= MAX_INSTANCES) break;

      // state indices per OpenSky docs
      const icao24   = s[0];
      const callsign = (s[1] || '').trim();
      const country  = s[2] || '';
      const lng      = s[5];
      const lat      = s[6];
      const baroAlt  = s[7];
      const onGround = s[8];
      const velocity = s[9];
      const heading  = s[10];

      if (onGround)                          continue;
      if (lat == null || lng == null)        continue;
      if (heading == null)                   continue;
      if (velocity == null || velocity < 10) continue;

      positionInstance(count, lat, lng, heading);
      mesh.setColorAt(count, altColor(baroAlt));

      flightData[count] = {
        callsign,
        country,
        altM:     baroAlt,
        speedKmh: velocity != null ? Math.round(velocity * 3.6) : null,
        heading,
        icao24,
      };
      count++;
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    if (countCallback) countCallback(count);
    scheduleRefresh(REFRESH_INTERVAL_MS);
  }

  function scheduleRefresh(ms) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, ms);
  }

  // Kick off immediately
  refresh();

  // ── public API ───────────────────────────────────────────────────────────

  return {
    setVisible(v) {
      mesh.visible = v;
      if (v) refresh();
      else {
        clearTimeout(refreshTimer);
      }
    },

    refresh,

    trackFlight(icao24) {
      trackedIcao = icao24;
    },

    stopTracking() {
      trackedIcao = null;
    },

    getClickables() {
      return [mesh];
    },

    getFlightData(instanceId) {
      return flightData[instanceId] || null;
    },

    flightCount() {
      return mesh.count;
    },

    onCountChange(fn) {
      countCallback = fn;
    },
  };
}
