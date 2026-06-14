import * as THREE from 'three';

// The asteroid belt between Mars (orbit 32) and Jupiter (orbit 48): ~200 rocks
// drawn with one InstancedMesh for performance, plus three individually named
// asteroids. Clicking any rock opens the belt card (its connector lines point
// at wherever you clicked, via a movable anchor); the named asteroids have
// their own cards.

const INNER = 35;
const OUTER = 47;
const COUNT = 200;

// `dynamicAnchor` tells main.js to move this body's object3d to the clicked
// point, so the belt card's lines point at the rock you actually clicked.
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
    key: 'ceres', name: 'Ceres', radius: 0.42, color: 0x9b8f80, angle: 0.6, dist: 38, y: 0.4,
    facts: [
      { label: 'Type', value: 'Dwarf planet' },
      { label: 'Diameter', value: '940 km' },
      { label: 'Composition', value: 'Rock & water ice' },
      { label: 'Discovered', value: '1801' },
    ],
  },
  {
    key: 'vesta', name: 'Vesta', radius: 0.3, color: 0xb8a888, angle: 2.7, dist: 43, y: -0.7,
    facts: [
      { label: 'Type', value: 'Protoplanet' },
      { label: 'Diameter', value: '525 km' },
      { label: 'Composition', value: 'Basaltic rock' },
      { label: 'Discovered', value: '1807' },
    ],
  },
  {
    key: 'eros', name: 'Eros', radius: 0.22, color: 0x8a7b66, angle: 4.7, dist: 36, y: 0.9,
    facts: [
      { label: 'Type', value: 'S-type asteroid' },
      { label: 'Diameter', value: '34 × 11 km' },
      { label: 'Composition', value: 'Silicate rock' },
      { label: 'Discovered', value: '1898' },
    ],
  },
];

// A lumpy low-poly rock (vertices nudged in and out from a sphere).
function rockGeometry(seed = 1) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const f = 0.7 + ((Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.6;
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildAsteroidBelt() {
  const group = new THREE.Group(); // the rocks + named asteroids slowly revolve
  const anchor = new THREE.Object3D(); // static; the belt card points here
  BELT.object3d = anchor;

  const clickable = [];
  const updaters = [];

  // ── Instanced rocks ──────────────────────────────────────────────────────
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b8178, roughness: 1, metalness: 0 });
  const rocks = new THREE.InstancedMesh(rockGeometry(3), mat, COUNT);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = INNER + Math.random() * (OUTER - INNER);
    dummy.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 3.2, Math.sin(a) * r);
    dummy.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
    dummy.scale.setScalar(0.05 + Math.random() * 0.16);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.userData.body = BELT;
  group.add(rocks);
  clickable.push(rocks);

  // ── Named asteroids ──────────────────────────────────────────────────────
  NAMED.forEach((n, idx) => {
    const mesh = new THREE.Mesh(
      rockGeometry(idx + 10),
      new THREE.MeshStandardMaterial({ color: n.color, roughness: 1, metalness: 0 })
    );
    mesh.scale.setScalar(n.radius);
    mesh.position.set(Math.cos(n.angle) * n.dist, n.y, Math.sin(n.angle) * n.dist);
    n.object3d = mesh;
    group.add(mesh);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(n.radius * 2.4, 8, 8),
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
