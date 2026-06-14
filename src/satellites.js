import * as THREE from 'three';

// Three satellites orbiting Earth at different altitudes and inclinations: the
// ISS plus two comm sats. They attach to Earth's `system` group so they ride
// along Earth's orbit, and each is individually clickable with its own card.
// `radius` here is the camera-framing size (used by the fly-to); `orbitR` is
// the display distance from Earth.
const SATELLITES = [
  {
    key: 'iss',
    name: 'ISS',
    orbitR: 1.25,
    radius: 0.12,
    incline: 0.9,
    phase: 0.0,
    speed: 0.85,
    scale: 0.075,
    panel: 0xdfe8ff,
    facts: [
      { label: 'Type', value: 'Space station (LEO)' },
      { label: 'Altitude', value: '408 km' },
      { label: 'Orbital speed', value: '27,600 km/h' },
      { label: 'Launched', value: '1998' },
    ],
  },
  {
    key: 'intelsat',
    name: 'Intelsat',
    orbitR: 1.85,
    radius: 0.12,
    incline: 0.12,
    phase: 2.1,
    speed: 0.3,
    scale: 0.07,
    panel: 0x9ecbff,
    facts: [
      { label: 'Type', value: 'Geostationary comsat' },
      { label: 'Altitude', value: '35,786 km' },
      { label: 'Orbital speed', value: '11,070 km/h' },
      { label: 'Launched', value: '2001' },
    ],
  },
  {
    key: 'iridium',
    name: 'Iridium',
    orbitR: 1.5,
    radius: 0.11,
    incline: 1.45,
    phase: 4.0,
    speed: 0.6,
    scale: 0.065,
    panel: 0x9ecbff,
    facts: [
      { label: 'Type', value: 'Comsat (LEO)' },
      { label: 'Altitude', value: '780 km' },
      { label: 'Orbital speed', value: '26,800 km/h' },
      { label: 'Launched', value: '2017' },
    ],
  },
];

// A tiny satellite: a metallic body with two glowing solar-panel wings.
function makeSatelliteMesh(scale, panelColor) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcfcfd6, roughness: 0.5, metalness: 0.6 });
  const panelMat = new THREE.MeshStandardMaterial({
    color: panelColor,
    emissive: 0x16284d,
    emissiveIntensity: 0.7,
    roughness: 0.4,
    metalness: 0.3,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(scale, scale, scale * 1.5), bodyMat);
  g.add(body);

  const wingGeo = new THREE.BoxGeometry(scale * 2.6, scale * 0.06, scale * 1.0);
  const left = new THREE.Mesh(wingGeo, panelMat);
  left.position.x = -scale * 1.9;
  g.add(left);
  const right = new THREE.Mesh(wingGeo, panelMat);
  right.position.x = scale * 1.9;
  g.add(right);

  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(scale * 0.05, scale * 0.05, scale * 1.3, 6),
    bodyMat
  );
  antenna.rotation.x = Math.PI / 2;
  antenna.position.z = scale * 1.1;
  g.add(antenna);

  return g;
}

// Attach the satellites to Earth's `system` group. Returns clickable hit-targets
// and per-frame updaters to merge into the solar system.
export function buildSatellites(system) {
  const clickable = [];
  const updaters = [];

  for (const s of SATELLITES) {
    // incline → orbit pivot → satellite, so each rides a tilted circular orbit.
    const incline = new THREE.Group();
    incline.rotation.z = s.incline;
    incline.rotation.x = s.incline * 0.45;
    system.add(incline);

    const orbit = new THREE.Group();
    orbit.rotation.y = s.phase;
    incline.add(orbit);

    const sat = makeSatelliteMesh(s.scale, s.panel);
    sat.position.x = s.orbitR;
    orbit.add(sat);
    s.object3d = sat;

    // An invisible, larger sphere makes the tiny satellite easy to click.
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(s.scale * 4, 8, 8),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
    );
    hit.userData.body = s;
    sat.add(hit);
    clickable.push(hit);

    updaters.push((dt) => {
      orbit.rotation.y += s.speed * dt;
      sat.rotation.y += 0.5 * dt;
    });
  }

  return { clickable, updaters };
}
