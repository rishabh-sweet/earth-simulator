import * as THREE from 'three';

// Animated great-circle flight-path arcs between the user's Visited pins. The
// whole layer lives ON the Earth mesh (like pins.js), so the arcs and the little
// glowing plane-dots ride the globe's rotation and stay geo-locked.
//
// Coordinate mapping is copied (not imported) from pins.js so the arc endpoints
// land on exactly the same spots as the pins. Endpoints sit at r≈1.02, just
// above the surface/cloud layers.

const ARC_R = 1.02;     // endpoint radius — just above the cloud layer
const MAX_ARCS = 20;    // hard cap, keeps update() cheap
const GOLD = 0xffcf6a;  // soft gold for arcs + dots
const TRAIL = 6;        // trailing sprites behind each plane-dot

// lat/lng (degrees) → a point in the Earth mesh's LOCAL space (same math as pins).
function localFromLatLng(lat, lng, r = ARC_R) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

// A soft additive gold blob used for the plane-dot and its trail.
function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,220,150,0.9)');
  g.addColorStop(0.7, 'rgba(255,180,90,0.35)');
  g.addColorStop(1.0, 'rgba(255,180,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createFlightLayer(earthMesh) {
  const group = new THREE.Group();
  group.visible = false; // hidden until the caller turns it on
  earthMesh.add(group);

  // One shared dot texture for every sprite (disposed once in dispose()).
  const dotTex = dotTexture();

  let arcs = [];          // { curve, tube, dotMat, dot, trail[], t, speed }
  let opacity = 0;        // current eased opacity of the whole layer
  let targetOpacity = 0;  // where opacity is heading
  let logicalOn = false;  // the on/off state isVisible() reports

  // Decide which pairs of points to connect, always returning ≤ MAX_ARCS pairs.
  // Few points → connect every pair we can (capped). Many points → connect each
  // point to its 1–2 nearest neighbours, deduped as undirected pairs (capped).
  function choosePairs(pts) {
    const pairs = [];
    const seen = new Set();
    const key = (i, j) => (i < j ? `${i}-${j}` : `${j}-${i}`);

    // "Few points" path: the full pairwise set fits within the cap.
    const fullCount = (pts.length * (pts.length - 1)) / 2;
    if (pts.length <= 6 && fullCount <= MAX_ARCS) {
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) pairs.push([i, j]);
      }
      return pairs;
    }

    // "Many points" path: nearest-neighbour linking. For each point find its two
    // closest others and add those undirected pairs, deduping, until the cap.
    for (let i = 0; i < pts.length && pairs.length < MAX_ARCS; i++) {
      const dists = [];
      for (let j = 0; j < pts.length; j++) {
        if (j === i) continue;
        dists.push([j, pts[i].distanceToSquared(pts[j])]);
      }
      dists.sort((a, b) => a[1] - b[1]);
      for (let n = 0; n < Math.min(2, dists.length); n++) {
        const j = dists[n][0];
        const k = key(i, j);
        if (seen.has(k)) continue;
        seen.add(k);
        pairs.push([i, j]);
        if (pairs.length >= MAX_ARCS) break;
      }
    }
    return pairs;
  }

  // Tear down everything built by a previous rebuild() — geometries, materials,
  // sprites — but keep the shared dot texture alive for reuse.
  function clearArcs() {
    for (const a of arcs) {
      group.remove(a.tube);
      a.tube.geometry.dispose();
      a.tube.material.dispose();
      group.remove(a.dot);
      a.dot.material.dispose();
      for (const t of a.trail) {
        group.remove(t);
        t.material.dispose();
      }
    }
    arcs = [];
  }

  // (Re)build all arcs from the given Visited points. Called every time the pin
  // set changes, so it always disposes the old arcs first.
  function rebuild(points) {
    clearArcs();
    if (!points || points.length < 2) return;

    const verts = points.map(p => localFromLatLng(p.lat, p.lng));
    const pairs = choosePairs(verts);

    for (const [i, j] of pairs) {
      const a = verts[i];
      const b = verts[j];

      // Control point = normalized midpoint pushed outward. The lift scales with
      // the angular distance between A and B, so long routes arc higher.
      const angle = a.angleTo(b);                 // radians, 0..PI
      const lift = ARC_R + 0.12 + angle * 0.42;   // farther apart → taller arc
      const mid = a.clone().add(b).normalize().multiplyScalar(lift);
      const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());

      // The glowing tube along the curve.
      const geo = new THREE.TubeGeometry(curve, 40, 0.004, 8, false);
      const mat = new THREE.MeshBasicMaterial({
        color: GOLD,
        transparent: true,
        opacity: 0,           // faded in by update() toward 0.5 * layer opacity
        depthWrite: false,
      });
      const tube = new THREE.Mesh(geo, mat);
      group.add(tube);

      // The travelling plane-dot (bright additive sprite).
      const dotMat = new THREE.SpriteMaterial({
        map: dotTex,
        color: GOLD,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const dot = new THREE.Sprite(dotMat);
      dot.scale.setScalar(0.05);
      group.add(dot);

      // A short fading trail: smaller sprites that lag the dot in t.
      const trail = [];
      for (let k = 0; k < TRAIL; k++) {
        const tm = new THREE.SpriteMaterial({
          map: dotTex,
          color: GOLD,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const ts = new THREE.Sprite(tm);
        ts.scale.setScalar(0.05 * (1 - (k + 1) / (TRAIL + 1)));
        group.add(ts);
        trail.push(ts);
      }

      arcs.push({
        curve, tube, dotMat, dot, trail,
        t: Math.random(),                 // different starting phase per arc
        speed: 0.06 + Math.random() * 0.05, // slightly varied speeds
      });
    }
  }

  // Toggle the layer. With animate, update() eases opacity toward the target;
  // without animate it snaps instantly so there's no fade.
  function setVisible(visible, animate = true) {
    logicalOn = visible;
    targetOpacity = visible ? 1 : 0;
    if (visible) group.visible = true;
    if (!animate) {
      opacity = targetOpacity;
      if (!visible) group.visible = false;
      applyOpacity();
    }
  }

  // Push the current eased layer opacity onto every tube/dot/trail material.
  function applyOpacity() {
    for (const a of arcs) {
      a.tube.material.opacity = 0.5 * opacity;     // arcs are softer than dots
      a.dotMat.opacity = opacity;
      for (let k = 0; k < a.trail.length; k++) {
        const fade = 1 - (k + 1) / (a.trail.length + 1);
        a.trail[k].material.opacity = opacity * fade * 0.7;
      }
    }
  }

  // Per-frame: ease the layer opacity, then advance each dot along its curve and
  // drag its trail slightly behind it in t.
  function update(dt) {
    // Ease opacity toward the target (frame-rate independent).
    if (opacity !== targetOpacity) {
      const k = 1 - Math.pow(0.001, dt); // ~smooth over a fraction of a second
      opacity += (targetOpacity - opacity) * k;
      if (Math.abs(targetOpacity - opacity) < 0.002) opacity = targetOpacity;
      if (opacity === 0 && !logicalOn) group.visible = false;
    }

    const pos = new THREE.Vector3();
    for (const a of arcs) {
      a.t = (a.t + a.speed * dt) % 1; // loop 0→1 forever
      a.curve.getPointAt(a.t, pos);
      a.dot.position.copy(pos);
      // Trail points sit a little behind the dot in t, with shrinking spacing.
      for (let k = 0; k < a.trail.length; k++) {
        const tt = a.t - (k + 1) * 0.018;
        a.curve.getPointAt(tt < 0 ? tt + 1 : tt, pos);
        a.trail[k].position.copy(pos);
      }
    }

    applyOpacity();
  }

  function isVisible() {
    return logicalOn;
  }

  // Remove the layer from the Earth and free every GPU resource it holds.
  function dispose() {
    clearArcs();
    if (group.parent) group.parent.remove(group);
    dotTex.dispose();
  }

  return { group, rebuild, setVisible, update, isVisible, dispose };
}
