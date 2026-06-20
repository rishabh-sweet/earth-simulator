import * as THREE from 'three';

// terminator.js — a glowing golden ring drawn exactly along the day/night
// terminator (the great circle separating the sunlit half of the Earth from
// the dark half), plus "Sunrise" / "Sunset" labels where that line
// crosses the equator.
//
// How it works in one breath: the terminator is the set of surface points
// perpendicular to the Sun. A flat ring built in the XY plane has the +Z axis
// as its normal, so if we rotate that ring's +Z onto the Sun direction, the
// ring lands exactly on the day/night boundary. Each frame we just re-aim it.

// Globe radius is 1, so float the ring + labels just above the surface.
const RING_RADIUS = 1.02;
const LABEL_RADIUS = 1.06;

// Labels are fully visible when the camera is closer than NEAR, fully faded
// once it's past FAR, smoothly interpolating between.
const LABEL_NEAR = 4.0;
const LABEL_FAR = 7.0;

// --- Draw a text label onto a canvas and wrap it in a sprite texture. ---
// depthTest:false makes the sprite read on top of the globe instead of being
// clipped by it, so the words are always legible.
function makeLabelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Soft dark pill behind the text so it stays readable over bright oceans.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  // Rounded rectangle (manual, for broad browser support).
  const x = 16, y = 36, w = 224, h = 56, r = 28;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();

  ctx.font = '40px system-ui, "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd27f'; // warm gold, matching the ring
  ctx.fillText(text, 128, 66);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,  // always render on top of the globe
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.5, 0.25, 1); // canvas is 2:1, keep that aspect
  return sprite;
}

// --- Build a tube following a unit circle in the XY plane. ---
// Per-vertex colours sweep a warm gradient around the ring: gold on one half,
// deep orange on the other, blended through the middle so the line glows like
// a band of dawn light.
function makeRing() {
  const SEGMENTS = 160;
  const points = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = (i / SEGMENTS) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(t), Math.sin(t), 0).multiplyScalar(RING_RADIUS));
  }
  const curve = new THREE.CatmullRomCurve3(points, true);
  const geometry = new THREE.TubeGeometry(curve, SEGMENTS, 0.006, 8, true);

  // Colour every vertex by its angle around the ring. (1 + cos t) / 2 runs
  // 1 → 0 → 1, so one half leans gold and the opposite half leans orange.
  const gold = new THREE.Color(0xffd700);
  const orange = new THREE.Color(0xff6600);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const angle = Math.atan2(pos.getY(i), pos.getX(i)); // -π..π
    const mix = (Math.cos(angle) + 1) / 2;              // 0..1 around the ring
    c.copy(orange).lerp(gold, mix);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending, // glow that adds light onto the scene
    depthWrite: false,                // never hides things behind it
    opacity: 1.0,
  });

  return new THREE.Mesh(geometry, material);
}

export function createTerminator(scene) {
  // The ring lives in its own group so we can spin that group onto the Sun
  // without disturbing anything else.
  const group = new THREE.Group();
  const ring = makeRing();
  group.add(ring);
  scene.add(group);
  group.visible = true; // ON by default

  // Labels live in a SEPARATE group added straight to the scene, so the ring's
  // rotation never spins them — we place them in world space ourselves.
  const labelGroup = new THREE.Group();
  const sunriseSprite = makeLabelSprite('Sunrise');
  const sunsetSprite = makeLabelSprite('Sunset');
  labelGroup.add(sunriseSprite, sunsetSprite);
  scene.add(labelGroup);

  // Reused scratch vectors so update() never allocates per frame.
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const sun = new THREE.Vector3();
  const crossA = new THREE.Vector3(); // one equator crossing
  const crossB = new THREE.Vector3(); // the opposite crossing
  const east = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  let pulse = 0; // drives the gentle glow throb

  // smoothstep that goes 1 → 0 as `d` rises from `near` to `far`, so labels
  // are bright up close and fade away when the camera pulls back.
  function fadeByDistance(d) {
    const t = THREE.MathUtils.clamp((d - LABEL_NEAR) / (LABEL_FAR - LABEL_NEAR), 0, 1);
    const s = t * t * (3 - 2 * t);
    return 1 - s;
  }

  function update(sunDir, camera, dt) {
    if (!group.visible) return;
    if (!sunDir || sunDir.lengthSq() < 1e-9) return; // nothing to aim at

    sun.copy(sunDir).normalize();

    // Aim the ring's plane normal (+Z) at the Sun → the ring sits on the
    // terminator great circle.
    group.quaternion.setFromUnitVectors(Z_AXIS, sun);

    // Gently pulse the ring's brightness so the line feels alive.
    pulse += (dt || 0) * 2.0;
    ring.material.opacity = 0.7 + 0.3 * Math.sin(pulse);

    // Equator crossings: the two y = 0 unit vectors perpendicular to the Sun.
    crossA.set(-sun.z, 0, sun.x);
    if (crossA.lengthSq() < 1e-9) {
      // Sun is straight over a pole → the terminator is the equator itself and
      // there's no single crossing; just hide the labels this frame.
      sunriseSprite.material.opacity = 0;
      sunsetSprite.material.opacity = 0;
      return;
    }
    crossA.normalize();
    crossB.copy(crossA).multiplyScalar(-1);

    // Which crossing is dawn? At a point P on the equator, Earth's eastward
    // tangent is up × P. If that eastward direction points toward the Sun, the
    // Sun is rising there → SUNRISE; the opposite point is SUNSET.
    east.crossVectors(UP, crossA).normalize();
    const aIsSunrise = east.dot(sun) > 0;
    const sunrisePoint = aIsSunrise ? crossA : crossB;
    const sunsetPoint = aIsSunrise ? crossB : crossA;

    // Place the sprites just above the surface at their crossings.
    sunriseSprite.position.copy(sunrisePoint).multiplyScalar(LABEL_RADIUS);
    sunsetSprite.position.copy(sunsetPoint).multiplyScalar(LABEL_RADIUS);

    // Fade the labels out as the camera zooms away. (Sprites billboard on
    // their own, so they always face the camera.)
    if (camera) {
      const fadeR = fadeByDistance(camera.position.distanceTo(sunriseSprite.position));
      const fadeS = fadeByDistance(camera.position.distanceTo(sunsetSprite.position));
      sunriseSprite.material.opacity = fadeR;
      sunsetSprite.material.opacity = fadeS;
    } else {
      sunriseSprite.material.opacity = 1;
      sunsetSprite.material.opacity = 1;
    }
  }

  function setVisible(v) {
    group.visible = v;
    labelGroup.visible = v;
  }

  function dispose() {
    ring.geometry.dispose();
    ring.material.dispose();
    scene.remove(group);

    for (const s of [sunriseSprite, sunsetSprite]) {
      if (s.material.map) s.material.map.dispose();
      s.material.dispose();
    }
    scene.remove(labelGroup);
  }

  return { group, update, setVisible, dispose };
}
