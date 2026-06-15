import * as THREE from 'three';

// The 3D travel-pin layer that lives ON the Earth mesh, so every pin rides the
// globe's rotation and stays glued to its real lat/lng. Pins are billboarded
// sprites (always face the camera), glow softly, pulse, and grow on hover.
//
// Coordinate mapping note: three.js SphereGeometry + a standard equirectangular
// Earth texture put longitude −180° on the −X axis and the prime meridian on
// +X. The forward/inverse formulas below are exact inverses of each other and
// match that layout, so a click on India lands on India.

const PIN_R = 1.015; // sit just above the radius-1 surface
const BASE = 0.052;  // on-screen pin size (globe radius is 1)
const HOVER = 1.5;   // hover grows the pin

// lat/lng (degrees) → a point in the Earth mesh's LOCAL space.
export function localFromLatLng(lat, lng, r = PIN_R) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

// A point in the Earth mesh's LOCAL space → lat/lng (degrees).
export function latLngFromLocal(v) {
  const n = v.clone().normalize();
  const lat = 90 - Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)) * 180 / Math.PI;
  let lng = Math.atan2(n.z, -n.x) * 180 / Math.PI - 180;
  if (lng < -180) lng += 360;
  if (lng > 180) lng -= 360;
  return { lat, lng };
}

// A filled glowing dot (Visited pins, and the pending placement marker).
function dotTexture(rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, `rgba(${rgb},1)`);
  g.addColorStop(0.55, `rgba(${rgb},0.55)`);
  g.addColorStop(1.0, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// An outlined ring with a small core (Wishlist pins).
function ringTexture(rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.lineWidth = 7;
  ctx.shadowColor = `rgba(${rgb},0.9)`;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = `rgba(${rgb},1)`;
  ctx.beginPath();
  ctx.arc(32, 32, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 6;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(32, 32, 3.4, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A thin white ring (tinted per-trip via material.color) drawn around pins that
// belong to a trip collection.
function tripRingTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createPinLayer(earthMesh) {
  const group = new THREE.Group();
  earthMesh.add(group);

  const goldTex = dotTexture('255,196,84');   // Visited
  const blueTex = ringTexture('120,180,255');  // Wishlist
  const tripRingTex = tripRingTexture();       // tinted per trip
  const pins = new Map(); // id → { data, sprite, ring, dim }
  let pending = null;     // placement marker sprite while the Add panel is open
  let hoverId = null;
  let highlightTrip = null; // when set, only this trip's pins stay bright
  let clock = 0;

  // A tinted ring sprite sitting just behind a pin, marking its trip colour.
  function makeRing(color) {
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tripRingTex,
      color: new THREE.Color(color),
      transparent: true,
      depthTest: true,
      depthWrite: false,
    }));
    ring.scale.setScalar(BASE * 1.9);
    return ring;
  }

  function spriteFor(type) {
    const mat = new THREE.SpriteMaterial({
      map: type === 'wishlist' ? blueTex : goldTex,
      transparent: true,
      depthTest: true,    // back-of-globe pins are hidden by the opaque Earth
      depthWrite: false,
      blending: THREE.NormalBlending, // keep true colour over the bright day side
    });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(BASE);
    return s;
  }

  // `data.tripColor` (a hex string) is supplied by the manager when the pin
  // belongs to a trip; null/undefined means no ring.
  function addPin(data) {
    const pos = localFromLatLng(data.lat, data.lng);
    const sprite = spriteFor(data.type);
    sprite.position.copy(pos);
    group.add(sprite);
    let ring = null;
    if (data.tripColor) {
      ring = makeRing(data.tripColor);
      ring.position.copy(pos);
      group.add(ring);
    }
    pins.set(data.id, { data, sprite, ring, dim: 1 });
  }

  function updatePin(data) {
    const rec = pins.get(data.id);
    if (!rec) return;
    rec.data = data;
    const pos = localFromLatLng(data.lat, data.lng);
    rec.sprite.material.map = data.type === 'wishlist' ? blueTex : goldTex;
    rec.sprite.material.needsUpdate = true;
    rec.sprite.position.copy(pos);
    // sync the trip ring
    if (data.tripColor && !rec.ring) {
      rec.ring = makeRing(data.tripColor);
      group.add(rec.ring);
    } else if (!data.tripColor && rec.ring) {
      group.remove(rec.ring);
      rec.ring.material.dispose();
      rec.ring = null;
    } else if (data.tripColor && rec.ring) {
      rec.ring.material.color.set(data.tripColor);
    }
    if (rec.ring) rec.ring.position.copy(pos);
  }

  function removePin(id) {
    const rec = pins.get(id);
    if (!rec) return;
    group.remove(rec.sprite);
    rec.sprite.material.dispose();
    if (rec.ring) { group.remove(rec.ring); rec.ring.material.dispose(); }
    pins.delete(id);
    if (hoverId === id) hoverId = null;
  }

  // When a trip is highlighted, its pins stay fully opaque and all others dim.
  function setHighlight(tripId) {
    highlightTrip = tripId;
    for (const [, rec] of pins) {
      rec.dim = (tripId == null || rec.data.tripId === tripId) ? 1 : 0.2;
    }
  }

  // The pulsing marker shown at the chosen spot while the Add panel is open.
  function setPending(lat, lng) {
    clearPending();
    pending = spriteFor('visited');
    pending.position.copy(localFromLatLng(lat, lng));
    group.add(pending);
  }
  function clearPending() {
    if (!pending) return;
    group.remove(pending);
    pending.material.dispose();
    pending = null;
  }

  // World-space hit point (from a surface raycast) → lat/lng.
  function latLngFromWorld(point) {
    const local = earthMesh.worldToLocal(point.clone());
    return latLngFromLocal(local);
  }

  // Pick the nearest visible pin to a screen point. Robust against tiny sprite
  // quads: project each pin to the screen and choose the closest within a pixel
  // radius, skipping pins on the far (occluded) hemisphere.
  function pickPin(camera, clientX, clientY, w, h) {
    const center = earthMesh.getWorldPosition(new THREE.Vector3());
    const world = new THREE.Vector3();
    const camPos = camera.position;
    let best = null;
    let bestDist = 24; // px tolerance

    for (const [id, rec] of pins) {
      rec.sprite.getWorldPosition(world);
      const normal = world.clone().sub(center);
      const toCam = camPos.clone().sub(world);
      if (normal.dot(toCam) <= 0) continue; // back hemisphere → occluded

      const p = world.clone().project(camera);
      if (p.z > 1) continue; // behind the camera
      const sx = (p.x * 0.5 + 0.5) * w;
      const sy = (-p.y * 0.5 + 0.5) * h;
      const dist = Math.hypot(sx - clientX, sy - clientY);
      if (dist < bestDist) {
        bestDist = dist;
        best = id;
      }
    }
    return best;
  }

  function setHover(id) {
    hoverId = id;
  }

  function count() {
    let visited = 0;
    let wishlist = 0;
    for (const [, rec] of pins) {
      if (rec.data.type === 'wishlist') wishlist++;
      else visited++;
    }
    return { visited, wishlist };
  }

  // Per-frame: gentle pulse for Visited pins + the pending marker, and a smooth
  // hover grow on whichever pin is hovered.
  function update(dt) {
    clock += dt;
    const pulse = 1 + Math.sin(clock * 2.4) * 0.12;
    for (const [id, rec] of pins) {
      let s = BASE;
      if (rec.data.type !== 'wishlist') s = BASE * pulse; // visited pins breathe
      if (id === hoverId) s *= HOVER;
      rec.sprite.scale.setScalar(s);
      rec.sprite.material.opacity = rec.dim;
      if (rec.ring) {
        rec.ring.scale.setScalar(s * 1.9);
        rec.ring.material.opacity = rec.dim;
      }
    }
    if (pending) pending.scale.setScalar(BASE * (1.15 + Math.sin(clock * 5) * 0.18));
  }

  return {
    group, addPin, updatePin, removePin,
    setPending, clearPending, setHighlight,
    latLngFromWorld, pickPin, setHover, count, update,
  };
}
