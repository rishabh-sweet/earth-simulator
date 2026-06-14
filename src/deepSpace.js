import * as THREE from 'three';

// Deep-background dressing for the solar view: a dense field of stars with
// natural colour variation (blue/white/yellow/orange), plus a few soft nebula
// clouds. Stars are one Points object (a single draw call) for performance.

const STAR_COUNT = 4200;
const STAR_SHELL = 1500; // just inside the Milky Way sky sphere (1800)

// realistic-ish stellar colours, weighted toward white/blue-white
const STAR_COLORS = [
  [0.75, 0.83, 1.0], // blue
  [0.85, 0.9, 1.0],  // blue-white
  [1.0, 1.0, 1.0],   // white
  [1.0, 1.0, 1.0],   // white (more common)
  [1.0, 0.97, 0.85], // yellow-white
  [1.0, 0.88, 0.65], // yellow
  [1.0, 0.74, 0.5],  // orange
];

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function nebulaTexture(rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, `rgba(${rgb},0.5)`);
  g.addColorStop(0.45, `rgba(${rgb},0.18)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildDeepSpace() {
  const group = new THREE.Group();

  // ── Stars ─────────────────────────────────────────────────────────────────
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // even distribution over a sphere
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const radius = STAR_SHELL * (0.85 + Math.random() * 0.15);
    positions[i * 3] = Math.cos(theta) * r * radius;
    positions[i * 3 + 1] = u * radius;
    positions[i * 3 + 2] = Math.sin(theta) * r * radius;

    const col = STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0];
    const b = 0.6 + Math.random() * 0.4; // brightness variation
    colors[i * 3] = col[0] * b;
    colors[i * 3 + 1] = col[1] * b;
    colors[i * 3 + 2] = col[2] * b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 6,
      map: dotTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
  );
  group.add(stars);

  // ── Nebula clouds ───────────────────────────────────────────────────────────
  const nebulae = [
    { rgb: '150,90,210', pos: [-900, 320, -1000], scale: 850 }, // purple
    { rgb: '70,120,210', pos: [1050, -260, -780], scale: 720 }, // blue
    { rgb: '210,120,70', pos: [-650, -420, 1050], scale: 620 }, // orange
  ];
  for (const n of nebulae) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: nebulaTexture(n.rgb),
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
    );
    sprite.position.set(...n.pos);
    sprite.scale.setScalar(n.scale);
    group.add(sprite);
  }

  return { group };
}
