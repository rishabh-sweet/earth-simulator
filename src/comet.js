import * as THREE from 'three';

// A single comet on a slow, inclined orbit: an icy nucleus with a glowing coma
// and a long ion/dust tail that always streams away from the Sun. Clickable.

const COMET = {
  key: 'comet',
  name: "Halley's Comet",
  radius: 6, // framing radius for the camera flight
  facts: [
    { label: 'Type', value: 'Periodic comet' },
    { label: 'Orbital period', value: '76 years' },
    { label: 'Nucleus', value: '15 × 8 km' },
    { label: 'Composition', value: 'Ice, dust & rock' },
    { label: 'Last perihelion', value: '1986' },
  ],
};

const TAIL_H = 26;

// The tail: an additive cone, widest at the nucleus, fading to nothing at the
// tip. The cone's local +Y runs from base (0) to apex (1); we fade along it.
const tailVertex = /* glsl */ `
  varying float vT;
  varying vec2 vUv2;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vT = (position.y + ${(TAIL_H / 2).toFixed(1)}) / ${TAIL_H.toFixed(1)};
    vUv2 = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const tailFragment = /* glsl */ `
  varying float vT;
  varying vec2 vUv2;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float along = pow(clamp(vT, 0.0, 1.0), 1.4);     // 0 at nucleus, 1 at tip
    float fade = (1.0 - along);                        // brightest near nucleus
    float edge = smoothstep(0.0, 0.5, 1.0 - abs(vUv2.x - 0.5) * 2.0); // soft sides
    vec3 col = mix(vec3(0.7, 0.85, 1.0), vec3(0.45, 0.6, 1.0), along); // bluish
    gl_FragColor = vec4(col, fade * edge * 0.5);
  }
`;

function comaTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(220,240,255,0.95)');
  g.addColorStop(0.4, 'rgba(150,200,255,0.4)');
  g.addColorStop(1, 'rgba(120,170,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildComet() {
  // inclined pivot (centred on the Sun) → comet group out on the orbit
  const incline = new THREE.Group();
  incline.rotation.x = 0.5;
  incline.rotation.z = 0.3;

  const pivot = new THREE.Group();
  pivot.rotation.y = 1.2;
  incline.add(pivot);

  const comet = new THREE.Group();
  comet.position.x = 78; // orbit radius (out past Saturn)
  pivot.add(comet);
  COMET.object3d = comet;

  // icy nucleus
  const nucleus = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.7, 1),
    new THREE.MeshStandardMaterial({ color: 0xc7d6e0, roughness: 1, metalness: 0 })
  );
  const np = nucleus.geometry.attributes.position;
  for (let i = 0; i < np.count; i++) {
    const f = 0.75 + (((Math.sin(i * 91.7) * 43758.5) % 1) + 1) % 1 * 0.5;
    np.setXYZ(i, np.getX(i) * f, np.getY(i) * f, np.getZ(i) * f);
  }
  nucleus.geometry.computeVertexNormals();
  comet.add(nucleus);

  // glowing coma around the nucleus
  const coma = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: comaTexture(),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );
  coma.scale.setScalar(5);
  comet.add(coma);

  // tail streaming away from the Sun (local +X = radially outward)
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, TAIL_H, 28, 1, true),
    new THREE.ShaderMaterial({
      vertexShader: tailVertex,
      fragmentShader: tailFragment,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );
  tail.rotation.z = -Math.PI / 2;   // axis from +Y to +X
  tail.position.x = TAIL_H / 2;     // base at the nucleus, taper outward
  comet.add(tail);

  // invisible hit sphere for easy clicking
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(3.5, 12, 12),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
  );
  hit.userData.body = COMET;
  comet.add(hit);

  const updaters = [
    (dt) => {
      pivot.rotation.y += 0.04 * dt; // slow drift along the orbit
      nucleus.rotation.y += 0.3 * dt;
    },
  ];

  return { group: incline, clickable: [hit], updaters };
}
