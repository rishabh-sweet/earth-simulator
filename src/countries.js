import * as THREE from 'three';

// "Countries visited" overlay. For every place the user has pinned we figure out
// which country it lands in, then wash that whole country in a soft glow on a
// canvas texture wrapped just above the Earth — GOLD for countries that hold a
// Visited pin, BLUE for countries that only hold Wishlist pins.
//
// Why a canvas instead of extruded geometry: the Earth sphere uses a plain
// equirectangular layout, so a lat/lng maps straight to a canvas pixel with no
// Mercator math — and painting filled polygons onto one texture is far cheaper
// than building a mesh per country. The forward map (matching the Earth's UVs)
// is simply:   x = (lng + 180) / 360 * W ;   y = (90 - lat) / 180 * H.
//
// Everything that touches the network is wrapped so the layer NEVER throws: if
// the country data can't be fetched the overlay just stays empty and unready,
// and the host falls back to its own coarse country estimate.

const OVERLAY_R = 1.004;        // sit a hair above the radius-1 surface
const CANVAS_W = 4096;          // equirectangular fill canvas
const CANVAS_H = 2048;
const OUTLINE_W = 2048;         // the hover-outline canvas can be smaller
const OUTLINE_H = 1024;
const TARGET_OPACITY = 0.9;     // the mesh's opacity when fully shown
const STAGGER_BATCH = 4;        // countries revealed per stagger step
const STAGGER_MS = 80;          // delay between stagger steps

// The world country polygons (a FeatureCollection). Fetched once, no key needed.
const GEOJSON_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

// lng/lat (degrees) → canvas pixel, on a W×H equirectangular canvas.
function project(lng, lat, w, h) {
  return [((lng + 180) / 360) * w, ((90 - lat) / 180) * h];
}

// Ray-casting point-in-polygon. `ring` is an array of [lng, lat] pairs; we test
// in raw lng/lat space (the projection above is linear so the result is the
// same as testing in pixels, and this keeps the bbox test trivial).
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const crosses = (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

// A GeoJSON Polygon is [outerRing, hole1, hole2, ...]; a point counts as inside
// when it's in the outer ring and in NO hole. A MultiPolygon is many of those.
function pointInPolygons(lng, lat, polygons) {
  for (const poly of polygons) {
    if (!poly.length) continue;
    if (!pointInRing(lng, lat, poly[0])) continue; // outside the outer ring
    let inHole = false;
    for (let h = 1; h < poly.length; h++) {
      if (pointInRing(lng, lat, poly[h])) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}

export function createCountryLayer(earthMesh, { getPins }) {
  // --- the two stacked canvases -------------------------------------------
  // fill: the gold/blue country washes. outline: a thin white hover outline,
  // drawn on its own canvas so re-outlining never disturbs the fills.
  const fillCanvas = document.createElement('canvas');
  fillCanvas.width = CANVAS_W;
  fillCanvas.height = CANVAS_H;
  const fillCtx = fillCanvas.getContext('2d');

  const outlineCanvas = document.createElement('canvas');
  outlineCanvas.width = OUTLINE_W;
  outlineCanvas.height = OUTLINE_H;
  const outlineCtx = outlineCanvas.getContext('2d');

  const fillTex = new THREE.CanvasTexture(fillCanvas);
  fillTex.colorSpace = THREE.SRGBColorSpace;
  fillTex.anisotropy = 4;
  const outlineTex = new THREE.CanvasTexture(outlineCanvas);
  outlineTex.colorSpace = THREE.SRGBColorSpace;

  const geometry = new THREE.SphereGeometry(OVERLAY_R, 64, 64);
  const fillMat = new THREE.MeshBasicMaterial({
    map: fillTex,
    transparent: true,
    depthWrite: false,        // never hides the stars; the Earth occludes it
    blending: THREE.NormalBlending,
    opacity: TARGET_OPACITY,
  });
  const mesh = new THREE.Mesh(geometry, fillMat);
  mesh.visible = false;       // off by default
  mesh.renderOrder = 2;

  // The outline rides as a sibling shell a touch higher so it reads above the
  // fill. It's a child of the fill mesh, so it inherits the geo-alignment.
  const outlineMat = new THREE.MeshBasicMaterial({
    map: outlineTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    opacity: 1,
  });
  const outlineMesh = new THREE.Mesh(new THREE.SphereGeometry(OVERLAY_R + 0.001, 64, 64), outlineMat);
  outlineMesh.renderOrder = 3;
  mesh.add(outlineMesh);

  earthMesh.add(mesh);        // child of the Earth → rotates and stays aligned

  // --- state ---------------------------------------------------------------
  let features = [];          // [{ name, polygons, bbox }]
  let ready = false;
  let disposed = false;
  const readyCbs = [];

  // Per-country status from the latest rebuild(): name → 'visited' | 'wishlist'.
  let statusByName = new Map();
  let visitedCount = 0;       // unique countries with a Visited pin
  let pinCountByName = new Map(); // name → how many of the user's pins fall in it

  // Animation state. We either run a staggered reveal (preferred) or, if asked
  // to hide / told not to stagger, fall back to a plain opacity fade.
  let mode = 'idle';          // 'idle' | 'stagger' | 'fade'
  let revealQueue = [];       // names still to paint during a stagger reveal
  let stepTimer = 0;          // counts down to the next stagger batch
  let targetOpacity = TARGET_OPACITY;

  let hoveredName = null;     // the country currently outlined (for cheap redraws)

  // --- name + geometry extraction -----------------------------------------
  // The geo-countries dataset names each feature in properties.ADMIN; we fall
  // back to properties.name if a build of the data uses that instead.
  function nameOf(feature) {
    const p = (feature && feature.properties) || {};
    return p.ADMIN || p.name || p.NAME || 'Unknown';
  }

  // Normalise either geometry kind into a flat list of polygons, where each
  // polygon is [outerRing, ...holes] and each ring is [[lng,lat], ...].
  function polygonsOf(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'Polygon') return [geometry.coordinates];
    if (geometry.type === 'MultiPolygon') return geometry.coordinates;
    return [];
  }

  // Precompute a lng/lat bounding box so hit-testing can reject most countries
  // with four comparisons before doing any ray casting.
  function bboxOf(polygons) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const poly of polygons) {
      for (const ring of poly) {
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    return { minX, minY, maxX, maxY };
  }

  // --- data load -----------------------------------------------------------
  async function load() {
    try {
      const res = await fetch(GEOJSON_URL, { cache: 'force-cache' });
      if (!res.ok) throw new Error('countries geojson fetch failed');
      const data = await res.json();
      if (disposed) return;
      const list = (data && data.features) || [];
      features = list.map((f) => {
        const polygons = polygonsOf(f.geometry);
        return { name: nameOf(f), polygons, bbox: bboxOf(polygons) };
      }).filter((f) => f.polygons.length);
      ready = true;
      rebuild();                 // first classification + draw
      for (const cb of readyCbs) { try { cb(); } catch (e) { /* ignore */ } }
      readyCbs.length = 0;
    } catch (err) {
      // Never throw — leave the layer empty/unready so the host can fall back.
      ready = false;
    }
  }
  load();

  // Find the feature whose polygons contain (lng,lat). Bbox-gated for speed.
  function featureAt(lng, lat) {
    for (const f of features) {
      const b = f.bbox;
      if (lng < b.minX || lng > b.maxX || lat < b.minY || lat > b.maxY) continue;
      if (pointInPolygons(lng, lat, f.polygons)) return f;
    }
    return null;
  }

  // --- drawing -------------------------------------------------------------
  // Trace one feature's outer rings (holes too) as a single path on a ctx sized
  // w×h. Used both for filling and for the hover outline.
  function tracePath(ctx, feature, w, h) {
    ctx.beginPath();
    for (const poly of feature.polygons) {
      for (const ring of poly) {
        for (let i = 0; i < ring.length; i++) {
          const [px, py] = project(ring[i][0], ring[i][1], w, h);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }
    }
  }

  // Paint one country onto the fill canvas with a soft two-stop glow: a faint
  // outer wash plus a brighter inner pass so it reads as a glow, not a flat blob.
  function paintCountry(feature, status) {
    const rgb = status === 'visited' ? '255,206,106' : '127,184,255';
    tracePath(fillCtx, feature, CANVAS_W, CANVAS_H);
    fillCtx.fillStyle = `rgba(${rgb},0.35)`;
    fillCtx.fill('evenodd');           // even-odd so holes (lakes) stay clear
    // a lighter inner pass, blurred, lifts the centre into a glow
    fillCtx.save();
    fillCtx.shadowColor = `rgba(${rgb},0.9)`;
    fillCtx.shadowBlur = 18;
    fillCtx.fillStyle = `rgba(${rgb},0.18)`;
    fillCtx.fill('evenodd');
    fillCtx.restore();
  }

  // Wipe and repaint the whole fill canvas from statusByName. Visited countries
  // are drawn first so a country that flips to visited always wins its colour.
  function redrawFill(names) {
    fillCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const byName = new Map(features.map((f) => [f.name, f]));
    const list = names || [...statusByName.keys()];
    // visited first, then wishlist
    for (const order of ['visited', 'wishlist']) {
      for (const name of list) {
        if (statusByName.get(name) !== order) continue;
        const f = byName.get(name);
        if (f) paintCountry(f, order);
      }
    }
    fillTex.needsUpdate = true;
  }

  // --- classification (rebuild) -------------------------------------------
  // Walk every pin, drop it into its country, and tally status + pin counts.
  function rebuild() {
    if (!ready) return;
    const pins = (typeof getPins === 'function' && getPins()) || [];
    const status = new Map();   // name → 'visited' | 'wishlist'
    const counts = new Map();   // name → pin tally
    for (const p of pins) {
      if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
      const f = featureAt(p.lng, p.lat);
      if (!f) continue;
      counts.set(f.name, (counts.get(f.name) || 0) + 1);
      const prev = status.get(f.name);
      // 'visited' is sticky: once a country has any visited pin it stays gold.
      if (p.type === 'visited' || prev === 'visited') status.set(f.name, 'visited');
      else if (!prev) status.set(f.name, 'wishlist');
    }
    statusByName = status;
    pinCountByName = counts;
    visitedCount = 0;
    for (const v of status.values()) if (v === 'visited') visitedCount++;

    // If we're mid-reveal the queue is stale; otherwise just repaint everything.
    if (mode === 'stagger') {
      revealQueue = orderedNames();
      fillCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      fillTex.needsUpdate = true;
    } else {
      redrawFill();
    }
  }

  // Country names in reveal order: all visited first, then all wishlist.
  function orderedNames() {
    const visited = [];
    const wishlist = [];
    for (const [name, st] of statusByName) {
      (st === 'visited' ? visited : wishlist).push(name);
    }
    return visited.concat(wishlist);
  }

  // --- show / hide ---------------------------------------------------------
  // setVisible(true, true) runs the staggered reveal: the canvas starts blank
  // and countries are painted on a few at a time from update(). Hiding, or any
  // non-animated toggle, uses the simpler opacity fade.
  function setVisible(v, animate) {
    if (v) {
      mesh.visible = true;
      if (animate && ready) {
        // staggered reveal
        revealQueue = orderedNames();
        fillCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        fillTex.needsUpdate = true;
        fillMat.opacity = TARGET_OPACITY; // each country pops in at full strength
        targetOpacity = TARGET_OPACITY;
        stepTimer = 0;
        mode = 'stagger';
      } else {
        // fade in (or snap if not animating)
        redrawFill();
        targetOpacity = TARGET_OPACITY;
        if (!animate) fillMat.opacity = TARGET_OPACITY;
        mode = animate ? 'fade' : 'idle';
      }
    } else {
      targetOpacity = 0;
      if (animate) {
        mode = 'fade';
      } else {
        fillMat.opacity = 0;
        mesh.visible = false;
        mode = 'idle';
      }
    }
  }

  // Per-frame driver for whichever animation is running.
  function update(dt) {
    if (mode === 'stagger') {
      stepTimer -= (dt || 0) * 1000;
      if (stepTimer <= 0) {
        stepTimer = STAGGER_MS;
        const byName = new Map(features.map((f) => [f.name, f]));
        for (let i = 0; i < STAGGER_BATCH && revealQueue.length; i++) {
          const name = revealQueue.shift();
          const f = byName.get(name);
          if (f) paintCountry(f, statusByName.get(name));
        }
        fillTex.needsUpdate = true;
        if (!revealQueue.length) mode = 'idle'; // reveal finished
      }
    } else if (mode === 'fade') {
      // frame-rate-independent ease toward the target opacity
      const k = 1 - Math.pow(0.002, dt || 0.016);
      fillMat.opacity += (targetOpacity - fillMat.opacity) * k;
      if (Math.abs(targetOpacity - fillMat.opacity) < 0.01) {
        fillMat.opacity = targetOpacity;
        if (targetOpacity === 0) mesh.visible = false;
        mode = 'idle';
      }
    }
  }

  // --- hover ---------------------------------------------------------------
  // Look up the country under (lat,lng), draw its outline, and report it. The
  // outline canvas is only repainted when the hovered country actually changes,
  // so dragging the cursor across one country is essentially free.
  function hoverAt(lat, lng) {
    if (lat == null || lng == null) {
      clearOutline();
      return null;
    }
    const f = featureAt(lng, lat);
    const name = f ? f.name : null;
    if (name !== hoveredName) {
      hoveredName = name;
      outlineCtx.clearRect(0, 0, OUTLINE_W, OUTLINE_H);
      if (f) {
        tracePath(outlineCtx, f, OUTLINE_W, OUTLINE_H);
        outlineCtx.lineWidth = 2;
        outlineCtx.strokeStyle = 'rgba(255,255,255,0.85)';
        outlineCtx.stroke();
      }
      outlineTex.needsUpdate = true;
    }
    if (!f) return null;
    return { name: f.name, pinCount: pinCountByName.get(f.name) || 0 };
  }

  function clearOutline() {
    if (hoveredName === null) return; // already clear → skip the work
    hoveredName = null;
    outlineCtx.clearRect(0, 0, OUTLINE_W, OUTLINE_H);
    outlineTex.needsUpdate = true;
  }

  // --- stats ---------------------------------------------------------------
  // Unique countries with a Visited pin, or null when the data isn't loaded yet
  // (so the host can fall back to its own estimate).
  function visitedCountryCount() {
    return ready ? visitedCount : null;
  }

  // --- lifecycle -----------------------------------------------------------
  function onReady(cb) {
    if (typeof cb !== 'function') return;
    if (ready) cb();
    else readyCbs.push(cb);
  }
  function isReady() {
    return ready;
  }

  function dispose() {
    disposed = true;
    if (mesh.parent) mesh.parent.remove(mesh);
    geometry.dispose();
    fillMat.dispose();
    fillTex.dispose();
    outlineMesh.geometry.dispose();
    outlineMat.dispose();
    outlineTex.dispose();
  }

  return {
    mesh,
    hoverAt,
    visitedCountryCount,
    rebuild,
    setVisible,
    update,
    onReady,
    isReady,
    dispose,
  };
}
