import * as THREE from 'three';
import { SUN, PLANETS, MOON } from './planetData.js';
import { buildSatellites } from './satellites.js';
import { buildAsteroidBelt } from './asteroidBelt.js';
import { buildGalaxies } from './galaxies.js';
import { buildBlackHole } from './blackHole.js';

// Builds the whole solar system as one THREE.Group and returns:
//   • root      — add this to the scene
//   • clickable — meshes the raycaster can hit (each has userData.body)
//   • update(dt)— spins planets on their axes and orbits them round the Sun
//
// Each body object also gets a `.object3d` reference so other code can ask
// where it currently is in the world (for camera flights and labels).
export function buildSolarSystem(maxAnisotropy = 1) {
  const root = new THREE.Group();
  const clickable = [];
  const spinners = []; // { mesh, speed } — things that rotate on their axis
  const orbiters = []; // { pivot, speed } — pivots that swing a body around
  const updaters = []; // generic per-frame callbacks (satellites, belt, etc.)

  const loader = new THREE.TextureLoader();
  const colorTex = (path) => {
    const t = loader.load(path);
    t.colorSpace = THREE.SRGBColorSpace; // these are color photos
    t.anisotropy = maxAnisotropy;        // keep them sharp at grazing angles
    return t;
  };

  // ── Milky Way backdrop ──────────────────────────────────────────────────
  // A huge sphere seen from the inside, so the scene sits within the galaxy.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1800, 64, 64),
    new THREE.MeshBasicMaterial({ map: colorTex('/textures/milky_way.jpg'), side: THREE.BackSide })
  );
  root.add(sky);

  // ── Lighting ────────────────────────────────────────────────────────────
  // One bright light at the Sun (no distance falloff so far planets still
  // show), plus a faint ambient fill so night sides aren't pure black.
  const sunLight = new THREE.PointLight(0xfff4e6, 2.2, 0, 0);
  root.add(sunLight);
  root.add(new THREE.AmbientLight(0x222233, 0.6));

  // ── Sun ─────────────────────────────────────────────────────────────────
  // Unlit (MeshBasic) so it always glows at full brightness like a star.
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(SUN.radius, 64, 64),
    new THREE.MeshBasicMaterial({ map: colorTex('/textures/sun.jpg') })
  );
  sunMesh.userData.body = SUN;
  SUN.object3d = sunMesh;
  root.add(sunMesh);
  clickable.push(sunMesh);
  root.add(makeGlowSprite(SUN.radius)); // soft outer halo
  spinners.push({ mesh: sunMesh, speed: SUN.spinSpeed });

  // ── Planets ───────────────────────────────────────────────────────────────
  PLANETS.forEach((p, i) => {
    // pivot (at the Sun) → system (out on the orbit) → tilt → mesh
    const pivot = new THREE.Group();
    pivot.rotation.y = i * 1.3 + 0.4; // scatter starting positions
    root.add(pivot);

    const system = new THREE.Group();
    system.position.x = p.orbitRadius;
    pivot.add(system);

    const tilt = new THREE.Group();
    tilt.rotation.z = THREE.MathUtils.degToRad(p.axialTilt);
    system.add(tilt);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius, 64, 64),
      new THREE.MeshStandardMaterial({ map: colorTex(p.texture), roughness: 1, metalness: 0 })
    );
    mesh.userData.body = p;
    p.object3d = mesh;
    tilt.add(mesh);
    clickable.push(mesh);
    spinners.push({ mesh, speed: p.spinSpeed });

    // Saturn's rings — flat disc lying in the planet's tilted equator.
    if (p.rings) {
      const ring = makeRing(p.rings, loader, maxAnisotropy);
      ring.userData.body = p; // clicking the rings selects Saturn
      tilt.add(ring);
      clickable.push(ring);
    }

    // Earth's Moon — its own little pivot orbiting the planet.
    if (p.moon) {
      const moonPivot = new THREE.Group();
      system.add(moonPivot);
      const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(p.moon.radius, 64, 64),
        new THREE.MeshStandardMaterial({ map: colorTex(p.moon.texture), roughness: 1, metalness: 0 })
      );
      moonMesh.position.x = p.moon.orbitRadius;
      moonMesh.userData.body = MOON;
      MOON.object3d = moonMesh;
      moonPivot.add(moonMesh);
      clickable.push(moonMesh);
      spinners.push({ mesh: moonMesh, speed: p.moon.spinSpeed });
      orbiters.push({ pivot: moonPivot, speed: 0.5 }); // Moon laps Earth quickly
    }

    // Satellites orbiting Earth (ISS + two comm sats).
    if (p.key === 'earth') {
      const sats = buildSatellites(system);
      clickable.push(...sats.clickable);
      updaters.push(...sats.updaters);
    }

    // Faint circular orbit line on the flat plane.
    root.add(makeOrbitLine(p.orbitRadius, p.color));

    // Kepler-ish: inner planets sweep faster than outer ones.
    orbiters.push({ pivot, speed: 0.28 / Math.sqrt(p.orbitRadius) });
  });

  // ── Asteroid belt (instanced rocks + Ceres, Vesta, Eros) ──────────────────
  const belt = buildAsteroidBelt();
  root.add(belt.group);
  root.add(belt.anchor);
  clickable.push(...belt.clickable);
  updaters.push(...belt.updaters);

  // ── Distant galaxies (soft glowing sprites, far in the background) ─────────
  const galaxies = buildGalaxies();
  root.add(galaxies.group);
  clickable.push(...galaxies.clickable);

  // ── Black hole — Sagittarius A*, far from the Sun ─────────────────────────
  const blackHole = buildBlackHole();
  root.add(blackHole.group);
  clickable.push(...blackHole.clickable);
  updaters.push(...blackHole.updaters);

  function update(dt) {
    for (const s of spinners) s.mesh.rotation.y += s.speed * dt;
    for (const o of orbiters) o.pivot.rotation.y += o.speed * dt;
    for (const u of updaters) u(dt);
  }

  return { root, clickable, update };
}

// Soft glowing halo around the Sun — a camera-facing sprite with a radial
// gradient painted on a canvas (no extra texture download needed).
function makeGlowSprite(radius) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,240,210,0.95)');
  g.addColorStop(0.25, 'rgba(255,200,120,0.45)');
  g.addColorStop(1.0, 'rgba(255,150,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );
  sprite.scale.setScalar(radius * 6);
  return sprite;
}

// Saturn's rings. The ring texture is a thin strip (inner edge → outer edge),
// so we remap the UVs to run that strip outward along the radius.
function makeRing(rings, loader, maxAnisotropy = 1) {
  const geo = new THREE.RingGeometry(rings.inner, rings.outer, 128);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = v.length();
    uv.setXY(i, (r - rings.inner) / (rings.outer - rings.inner), 0.5);
  }
  const tex = loader.load(rings.texture);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2; // lay flat into the planet's equatorial plane
  return mesh;
}

// A faint full circle marking a planet's orbit, on the flat (XZ) plane.
function makeOrbitLine(radius, color) {
  const points = [];
  const segments = 180;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22 }));
}
