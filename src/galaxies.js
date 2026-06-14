import * as THREE from 'three';

// Five distant galaxies, far out in the background as soft glowing sprites.
// Each is clickable with its own card. `radius` is the camera-framing size.
const GALAXIES = [
  {
    key: 'andromeda', name: 'Andromeda', radius: 26,
    pos: [-420, 140, -300], scale: 130, tilt: 0.5, color: [206, 222, 255],
    facts: [
      { label: 'Distance', value: '2.5 million ly' },
      { label: 'Type', value: 'Barred spiral' },
      { label: 'Fact', value: 'Heading for the Milky Way — they merge in ~4.5 billion years.' },
    ],
  },
  {
    key: 'triangulum', name: 'Triangulum', radius: 24,
    pos: [380, 95, -380], scale: 95, tilt: -0.7, color: [190, 210, 255],
    facts: [
      { label: 'Distance', value: '2.7 million ly' },
      { label: 'Type', value: 'Spiral galaxy' },
      { label: 'Fact', value: 'Third-largest in our Local Group, with ~40 billion stars.' },
    ],
  },
  {
    key: 'whirlpool', name: 'Whirlpool', radius: 24,
    pos: [-300, -120, 430], scale: 110, tilt: 0.9, color: [200, 220, 255],
    facts: [
      { label: 'Distance', value: '31 million ly' },
      { label: 'Type', value: 'Grand-design spiral' },
      { label: 'Fact', value: 'Locked in a slow dance with companion galaxy NGC 5195.' },
    ],
  },
  {
    key: 'sombrero', name: 'Sombrero', radius: 24,
    pos: [470, -85, 180], scale: 100, tilt: -0.3, color: [255, 232, 196],
    facts: [
      { label: 'Distance', value: '31 million ly' },
      { label: 'Type', value: 'Lenticular / spiral' },
      { label: 'Fact', value: 'Its bright bulge hides a ~1-billion-solar-mass black hole.' },
    ],
  },
  {
    key: 'pinwheel', name: 'Pinwheel', radius: 24,
    pos: [130, 205, -470], scale: 115, tilt: 1.3, color: [198, 216, 255],
    facts: [
      { label: 'Distance', value: '21 million ly' },
      { label: 'Type', value: 'Face-on spiral' },
      { label: 'Fact', value: 'Nearly twice the Milky Way’s width, with ~1 trillion stars.' },
    ],
  },
];

// A soft galaxy glow: a bright core fading into a faint disk halo.
function galaxyTexture([r, g, b]) {
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0.0, `rgba(255,255,255,0.95)`);
  grd.addColorStop(0.18, `rgba(${r},${g},${b},0.7)`);
  grd.addColorStop(0.5, `rgba(${r},${g},${b},0.22)`);
  grd.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildGalaxies() {
  const group = new THREE.Group();
  const clickable = [];

  for (const gx of GALAXIES) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: galaxyTexture(gx.color),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        rotation: gx.tilt,
      })
    );
    sprite.position.set(...gx.pos);
    sprite.scale.set(gx.scale, gx.scale * 0.52, 1); // squashed → disk seen at an angle
    sprite.userData.body = gx;
    gx.object3d = sprite;
    group.add(sprite);
    clickable.push(sprite);
  }

  return { group, clickable };
}
