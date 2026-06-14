import * as THREE from 'three';

// The asteroid belt between Mars (orbit 32) and Jupiter (orbit 48): 500+ rocks
// of widely varying size, drawn with one InstancedMesh for performance, plus
// three large, individually named asteroids with visibly irregular shapes.
// Clicking any small rock opens the belt card (its connector lines point at
// wherever you clicked, via a movable anchor); the named asteroids have their
// own cards.

const INNER = 35;
const OUTER = 47;
const COUNT = 540;

const BELT = {
  key: 'belt',
  name: 'Asteroid Belt',
  radius: 6,
  dynamicAnchor: true,
  facts: [
    { label: 'Location', value: '1.1 – 3.3 AU from the Sun' },
    { label: 'Between', value: 'Mars and Jupiter' },
    { label: 'Known asteroids', value: '1.1 – 1.9 million over 1 km wide' },
    { label: 'Total mass', value: '≈ 3% of the Moon' },
  ],
};

const NAMED = [
  {
    key: 'ceres', name: 'Ceres', radius: 0.5, color: 0x9b8f80, angle: 0.6, dist: 38, y: 0.4,
    amp: 0.25, scale: [1, 1, 1], // dwarf planet → nearly round
    facts: [
      { label: 'Type', value: 'Dwarf planet' },
      { label: 'Diameter', value: '940 km' },
      { label: 'Composition', value: 'Rock & water ice' },
      { label: 'Discovered', value: '1801' },
    ],
  },
  {
    key: 'vesta', name: 'Vesta', radius: 0.38, color: 0xb8a888, angle: 2.7, dist: 43, y: -0.7,
    amp: 0.7, scale: [1, 0.9, 1.05], // lumpy protoplanet
    facts: [
      { label: 'Type', value: 'Protoplanet' },
      { label: 'Diameter', value: '525 km' },
      { label: 'Composition', value: 'Basaltic rock' },
      { label: 'Discovered', value: '1807' },
    ],
  },
  {
    key: 'eros', name: 'Eros', radius: 0.32, color: 0x8a7b66, angle: 4.7, dist: 36, y: 0.9,
    amp: 0.85, scale: [1.6, 0.6, 0.55], // famously elongated (peanut-shaped)
    facts: [
      { label: 'Type', value: 'S-type asteroid' },
      { label: 'Diameter', value: '34 × 11 km' },
      { label: 'Composition', value: 'Silicate rock' },
      { label: 'Discovered', value: '1898' },
    ],
  },
];

// A lumpy rock: sphere vertices nudged in/out by a per-vertex pseudo-random
// factor. `detail` controls poly count; `amp` controls how irregular it is.
function rockGeometry(seed = 1, detail = 1, amp = 0.6) {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const f = 1 - amp / 2 + (((Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453) % 1) + 1) % 1 * amp;
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildAsteroidBelt() {
  const group = new THREE.Group();
  const anchor = new THREE.Object3D();
  BELT.object3d = anchor;

  const clickable = [];
  const updaters = [];

  // ── Instanced rocks (tiny pebbles → modest boulders) ──────────────────────
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b8178, roughness: 1, metalness: 0 });
  const rocks = new THREE.InstancedMesh(rockGeometry(3, 1, 0.6), mat, COUNT);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = INNER + Math.random() * (OUTER - INNER);
    dummy.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 3.4, Math.sin(a) * r);
    dummy.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
    // bias toward small: square the random so most rocks are tiny pebbles
    const t = Math.random();
    dummy.scale.setScalar(0.02 + t * t * 0.28);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.userData.body = BELT;
  group.add(rocks);
  clickable.push(rocks);

  // ── Named asteroids (large, visibly irregular) ────────────────────────────
  NAMED.forEach((n, idx) => {
    const mesh = new THREE.Mesh(
      rockGeometry(idx + 10, 2, n.amp),
      new THREE.MeshStandardMaterial({ color: n.color, roughness: 1, metalness: 0 })
    );
    mesh.scale.set(n.radius * n.scale[0], n.radius * n.scale[1], n.radius * n.scale[2]);
    mesh.position.set(Math.cos(n.angle) * n.dist, n.y, Math.sin(n.angle) * n.dist);
    n.object3d = mesh;
    group.add(mesh);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(n.radius * 2.6, 8, 8),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
    );
    hit.userData.body = n;
    mesh.add(hit);
    clickable.push(hit);

    updaters.push((dt) => {
      mesh.rotation.y += 0.25 * dt;
      mesh.rotation.x += 0.1 * dt;
    });
  });

  // the whole belt drifts slowly around the Sun
  updaters.push((dt) => {
    group.rotation.y += 0.02 * dt;
  });

  return { group, anchor, clickable, updaters };
}
