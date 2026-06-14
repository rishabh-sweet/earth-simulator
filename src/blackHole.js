import * as THREE from 'three';

// Sagittarius A* — placed far from the Sun. A dark event-horizon sphere, a
// bright photon ring hugging it (the light bent around the hole), and a
// shader-driven glowing accretion disk. Clickable like any other body; main.js
// also plays the deep rumble while its card is open.
const BLACK_HOLE = {
  key: 'blackhole',
  name: 'Sagittarius A*',
  radius: 16,
  rumble: true,
  facts: [
    { label: 'Distance', value: '26,000 light-years' },
    { label: 'Mass', value: '4.3 million M☉' },
    { label: 'Type', value: 'Supermassive black hole' },
    { label: 'Fact', value: 'First imaged by the Event Horizon Telescope in 2022.' },
  ],
};

// The accretion disk shader: hot white inner edge → orange outer, with a
// swirling, Doppler-brightened band that rotates over time. Includes the
// logarithmic-depth chunks so it sorts correctly with the rest of the scene.
const diskVertex = /* glsl */ `
  varying vec3 vLocal;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const diskFragment = /* glsl */ `
  uniform float uTime;
  uniform float uInner;
  uniform float uOuter;
  varying vec3 vLocal;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float r = length(vLocal.xy);
    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    float ang = atan(vLocal.y, vLocal.x);

    // swirling bands of brightness spiralling inward
    float swirl = 0.5 + 0.5 * sin(ang * 3.0 - uTime * 2.5 + r * 1.4);
    float bright = (1.0 - t) * (0.45 + 0.55 * swirl);

    // Doppler beaming: one side of the disk is much brighter
    bright *= 0.55 + 0.95 * smoothstep(-1.0, 1.0, sin(ang - uTime));

    // soften the very inner and outer edges
    bright *= smoothstep(0.0, 0.09, t) * smoothstep(1.0, 0.82, t);

    vec3 col = mix(vec3(1.0, 0.96, 0.86), vec3(1.0, 0.42, 0.07), t);
    gl_FragColor = vec4(col * bright * 2.3, 1.0);
  }
`;

// Soft orange outer glow texture.
function glowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,200,130,0.5)');
  g.addColorStop(0.4, 'rgba(255,140,60,0.18)');
  g.addColorStop(1.0, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildBlackHole() {
  const group = new THREE.Group();
  group.position.set(320, -70, -340); // far from the Sun
  const clickable = [];
  const updaters = [];

  // event horizon — a pure black sphere (the dark centre)
  const horizon = new THREE.Mesh(
    new THREE.SphereGeometry(6, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  horizon.userData.body = BLACK_HOLE;
  BLACK_HOLE.object3d = horizon;
  group.add(horizon);
  clickable.push(horizon);

  // photon ring — the bright ring of lensed light around the horizon
  const photon = new THREE.Mesh(
    new THREE.TorusGeometry(6.7, 0.16, 16, 120),
    new THREE.MeshBasicMaterial({
      color: 0xffe9c8,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );
  group.add(photon);

  // accretion disk — tilted toward the viewer, custom shader
  const disk = new THREE.Mesh(
    new THREE.RingGeometry(7, 16, 160, 1),
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uInner: { value: 7 }, uOuter: { value: 16 } },
      vertexShader: diskVertex,
      fragmentShader: diskFragment,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const diskTilt = new THREE.Group();
  diskTilt.rotation.x = -1.25; // lay it back toward the camera
  diskTilt.add(disk);
  disk.userData.body = BLACK_HOLE;
  group.add(diskTilt);
  clickable.push(disk);

  // faint outer glow
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );
  glow.scale.setScalar(64);
  group.add(glow);

  updaters.push((dt) => {
    disk.material.uniforms.uTime.value += dt;
    disk.rotation.z += 0.12 * dt; // gentle bulk spin on top of the shader swirl
    photon.rotation.z += 0.04 * dt;
  });

  return { group, clickable, updaters };
}
