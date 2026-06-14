import * as THREE from 'three';

// Shooting stars: a handful of meteors that streak across the deep background on
// a loop. Each one is a short trail of additive sprites (head bright, tail
// fading) positioned in 3D, so the streak reads correctly from any angle.

const METEORS = 7;
const TRAIL = 8;
const SHELL = 320;      // roughly how far out they fly
const SPEED = 230;      // units per second
const LIFE = 1.6;       // seconds visible

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(200,225,255,0.5)');
  g.addColorStop(1, 'rgba(160,200,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function randomDir() {
  return new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
}

export function buildMeteors() {
  const group = new THREE.Group();
  const tex = dotTexture();
  const meteors = [];

  for (let i = 0; i < METEORS; i++) {
    const sprites = [];
    for (let j = 0; j < TRAIL; j++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          color: 0xcfe2ff,
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
      );
      s.scale.setScalar(6 * (1 - j / TRAIL) + 1.5);
      group.add(s);
      sprites.push(s);
    }
    meteors.push({ sprites, pos: new THREE.Vector3(), vel: new THREE.Vector3(), t: 0, delay: Math.random() * 6 });
  }

  function launch(m) {
    // start somewhere on a far shell, fly across in a random direction
    const start = randomDir().multiplyScalar(SHELL);
    const dir = randomDir();
    if (dir.dot(start) > 0) dir.negate(); // bias inward so it crosses the view
    m.pos.copy(start);
    m.vel.copy(dir).multiplyScalar(SPEED);
    m.t = 0;
  }

  const updaters = [
    (dt) => {
      for (const m of meteors) {
        if (m.delay > 0) {
          m.delay -= dt;
          continue;
        }
        if (m.t === 0) launch(m);
        m.t += dt;
        m.pos.addScaledVector(m.vel, dt);

        const k = m.t / LIFE;
        const headOpacity = Math.sin(Math.min(k, 1) * Math.PI); // fade in then out
        for (let j = 0; j < TRAIL; j++) {
          const s = m.sprites[j];
          s.position.copy(m.pos).addScaledVector(m.vel, -j * 0.018); // trail behind
          s.material.opacity = headOpacity * (1 - j / TRAIL) * 0.9;
        }

        if (k >= 1) {
          for (const s of m.sprites) s.material.opacity = 0;
          m.t = 0;
          m.delay = 1.5 + Math.random() * 6; // pause before the next streak
        }
      }
    },
  ];

  return { group, updaters };
}
