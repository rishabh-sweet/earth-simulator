import * as THREE from 'three';

// Objects orbiting Earth — all tiny and realistically proportioned against the
// globe, attached to Earth's `system` group so they ride along Earth's orbit.
// Each is clickable with an accurate info card.

// Small orange engine-plume sprite for the Falcon 9.
function engineGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,210,0.95)');
  g.addColorStop(0.4, 'rgba(255,150,60,0.5)');
  g.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── Models ───────────────────────────────────────────────────────────────────
function buildISS(s) {
  const g = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.4, metalness: 0.75 });
  const white = new THREE.MeshStandardMaterial({ color: 0xeef0f4, roughness: 0.6, metalness: 0.2 });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xb8860b, emissive: 0x4a3508, emissiveIntensity: 0.6, roughness: 0.45, metalness: 0.6,
  });

  const truss = new THREE.Mesh(new THREE.BoxGeometry(s * 9, s * 0.35, s * 0.35), silver);
  g.add(truss);

  for (const z of [-s * 1.3, 0, s * 1.3]) {
    const mod = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 3.2, 12), white);
    mod.rotation.x = Math.PI / 2;
    mod.position.z = z;
    g.add(mod);
  }

  const panel = new THREE.BoxGeometry(s * 3.4, s * 0.05, s * 1.9);
  for (const x of [-s * 3.1, s * 3.1]) {
    for (const z of [-s * 1.5, s * 1.5]) {
      const p = new THREE.Mesh(panel, gold);
      p.position.set(x, 0, z);
      g.add(p);
    }
  }

  const radiator = new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, s * 0.05, s * 1.0), silver);
  radiator.position.y = -s * 0.9;
  g.add(radiator);

  // blinking docking-port light
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(s * 0.32, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff5a44, transparent: true })
  );
  light.position.set(0, s * 0.4, s * 2.0);
  g.add(light);
  g.userData.blink = light;
  return g;
}

function buildComm(s, panelColor) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0xcfcfd6, roughness: 0.5, metalness: 0.6 });
  const panelMat = new THREE.MeshStandardMaterial({
    color: panelColor, emissive: 0x16284d, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3,
  });

  g.add(new THREE.Mesh(new THREE.BoxGeometry(s * 1.2, s * 1.2, s * 1.6), body));

  const panel = new THREE.BoxGeometry(s * 4, s * 0.05, s * 1.2);
  const left = new THREE.Mesh(panel, panelMat);
  left.position.x = -s * 2.6;
  g.add(left);
  const right = new THREE.Mesh(panel, panelMat);
  right.position.x = s * 2.6;
  g.add(right);

  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(s * 0.75, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    body
  );
  dish.rotation.x = Math.PI;
  dish.position.z = s * 1.2;
  g.add(dish);
  return g;
}

function buildFalcon(s) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f4, roughness: 0.5, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.7 });

  g.add(new THREE.Mesh(new THREE.CylinderGeometry(s, s, s * 9, 16), white));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.02, s * 1.02, s * 0.8, 16), dark);
  band.position.y = -s * 2.2;
  g.add(band);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(s, s * 2.4, 16), white);
  nose.position.y = s * 5.7;
  g.add(nose);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: engineGlowTexture(),
      color: 0xffcc88,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );
  glow.scale.setScalar(s * 7);
  glow.position.y = -s * 5.6;
  g.add(glow);
  g.userData.glow = glow;

  g.rotation.x = Math.PI / 2; // lay the long axis along its direction of travel
  return g;
}

const OBJECTS = [
  {
    key: 'iss', name: 'International Space Station', kind: 'iss',
    orbitR: 1.3, scale: 0.022, radius: 0.13, incline: 0.85, phase: 0.0, speed: 0.7,
    facts: [
      { label: 'Altitude', value: '408 km' },
      { label: 'Speed', value: '27,600 km/h' },
      { label: 'Crew', value: '7' },
      { label: 'Launched', value: '1998' },
    ],
  },
  {
    key: 'intelsat', name: 'Intelsat', kind: 'comm', panel: 0x9ecbff,
    orbitR: 1.85, scale: 0.018, radius: 0.1, incline: 0.12, phase: 2.2, speed: 0.3,
    facts: [
      { label: 'Type', value: 'Geostationary comsat' },
      { label: 'Altitude', value: '35,786 km' },
      { label: 'Speed', value: '11,070 km/h' },
      { label: 'Launched', value: '2001' },
    ],
  },
  {
    key: 'iridium', name: 'Iridium', kind: 'comm', panel: 0x9ecbff,
    orbitR: 1.55, scale: 0.017, radius: 0.1, incline: 1.5, phase: 4.1, speed: 0.55,
    facts: [
      { label: 'Type', value: 'Comsat (LEO)' },
      { label: 'Altitude', value: '780 km' },
      { label: 'Speed', value: '26,800 km/h' },
      { label: 'Launched', value: '2017' },
    ],
  },
  {
    key: 'falcon9', name: 'SpaceX Falcon 9', kind: 'falcon',
    orbitR: 1.15, scale: 0.02, radius: 0.13, incline: 0.55, phase: 5.0, speed: 0.45,
    facts: [
      { label: 'Type', value: 'Active launch vehicle' },
      { label: 'LEO payload', value: '22,800 kg' },
      { label: 'Stages', value: '2 (reusable booster)' },
      { label: 'First flight', value: '2010' },
    ],
  },
];

export function buildSatellites(system) {
  const clickable = [];
  const updaters = [];

  for (const o of OBJECTS) {
    const incline = new THREE.Group();
    incline.rotation.z = o.incline;
    incline.rotation.x = o.incline * 0.4;
    system.add(incline);

    const orbit = new THREE.Group();
    orbit.rotation.y = o.phase;
    incline.add(orbit);

    let model;
    if (o.kind === 'iss') model = buildISS(o.scale);
    else if (o.kind === 'falcon') model = buildFalcon(o.scale);
    else model = buildComm(o.scale, o.panel);
    model.position.x = o.orbitR;
    orbit.add(model);
    o.object3d = model;

    // invisible hit sphere so the tiny object is easy to click
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(o.radius * 1.4, 10, 10),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
    );
    hit.userData.body = o;
    model.add(hit);
    clickable.push(hit);

    let t = 0;
    updaters.push((dt) => {
      t += dt;
      orbit.rotation.y += o.speed * dt;
      if (o.kind === 'iss') {
        // slow tumble + blinking docking light
        model.rotation.y += 0.25 * dt;
        model.rotation.x += 0.12 * dt;
        const blink = model.userData.blink;
        if (blink) blink.material.opacity = Math.sin(t * 3.0) > 0.6 ? 1.0 : 0.12;
      } else if (o.kind === 'falcon') {
        const glow = model.userData.glow;
        if (glow) glow.scale.setScalar(o.scale * (6 + Math.sin(t * 18) * 1.2)); // flicker
      } else {
        model.rotation.z += 0.2 * dt;
      }
    });
  }

  return { clickable, updaters };
}
