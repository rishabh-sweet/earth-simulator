import * as THREE from 'three';

// A live geology layer that rides ON the Earth mesh: red/orange earthquake
// rings pulled from the USGS feed, plus a hardcoded set of the world's most
// active volcanoes. Everything lives inside one Group that is a child of the
// Earth, so it rotates with the globe and stays glued to real lat/lng. The
// layer is hidden by default and toggled on by the host app.
//
// Coordinate mapping is copied (not imported) from pins.js so a marker over
// Japan lands on Japan: three.js SphereGeometry + an equirectangular Earth
// texture put longitude -180 on the -X axis and the prime meridian on +X.

const MARKER_R = 1.012; // sit just above the radius-1 surface
const QUAKE_FEED =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
const MAX_QUAKES = 300; // cap the most significant quakes if the feed is huge

// lat/lng (degrees) -> a point in the Earth mesh's LOCAL space. Exact match
// for the formula in pins.js.
function localFromLatLng(lat, lng, r = MARKER_R) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

// A glowing radial RING: bright hot core fading out, with a crisp ring band.
// Used for earthquakes. `rgb` is an "r,g,b" string.
function quakeRingTexture(rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  // soft outer glow
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0.0, `rgba(${rgb},0.0)`);
  g.addColorStop(0.55, `rgba(${rgb},0.0)`);
  g.addColorStop(0.72, `rgba(${rgb},0.85)`); // the ring band
  g.addColorStop(0.82, `rgba(255,255,255,0.95)`);
  g.addColorStop(0.92, `rgba(${rgb},0.4)`);
  g.addColorStop(1.0, `rgba(${rgb},0.0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A flat upward-pointing TRIANGLE for volcanoes, drawn bright orange with a
// little glow so it reads as a hazard marker on both day and night sides.
function volcanoTriangleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.shadowColor = 'rgba(255,140,40,0.9)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(32, 8);   // apex
  ctx.lineTo(56, 54);  // bottom-right
  ctx.lineTo(8, 54);   // bottom-left
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,150,40,1)';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,235,180,0.95)';
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The world's ~50 most active / notable volcanoes. Hardcoded so the layer
// always has something to show on the very first build, even before (or
// without) any network call.
const VOLCANOES = [
  { name: 'Kilauea', country: 'USA (Hawaii)', lat: 19.421, lng: -155.287, elevation: 1247, type: 'Shield', lastEruption: '2023' },
  { name: 'Mauna Loa', country: 'USA (Hawaii)', lat: 19.475, lng: -155.608, elevation: 4169, type: 'Shield', lastEruption: '2022' },
  { name: 'Mount St. Helens', country: 'USA', lat: 46.191, lng: -122.195, elevation: 2549, type: 'Stratovolcano', lastEruption: '2008' },
  { name: 'Mount Rainier', country: 'USA', lat: 46.853, lng: -121.760, elevation: 4392, type: 'Stratovolcano', lastEruption: '1894' },
  { name: 'Mount Shasta', country: 'USA', lat: 41.409, lng: -122.193, elevation: 4317, type: 'Stratovolcano', lastEruption: '1786' },
  { name: 'Yellowstone', country: 'USA', lat: 44.428, lng: -110.588, elevation: 2805, type: 'Caldera', lastEruption: '70000 BC' },
  { name: 'Etna', country: 'Italy', lat: 37.751, lng: 14.993, elevation: 3357, type: 'Stratovolcano', lastEruption: '2024' },
  { name: 'Stromboli', country: 'Italy', lat: 38.789, lng: 15.213, elevation: 924, type: 'Stratovolcano', lastEruption: '2024' },
  { name: 'Vesuvius', country: 'Italy', lat: 40.821, lng: 14.426, elevation: 1281, type: 'Stratovolcano', lastEruption: '1944' },
  { name: 'Vulcano', country: 'Italy', lat: 38.404, lng: 14.962, elevation: 500, type: 'Stratovolcano', lastEruption: '1890' },
  { name: 'Merapi', country: 'Indonesia', lat: -7.540, lng: 110.446, elevation: 2910, type: 'Stratovolcano', lastEruption: '2023' },
  { name: 'Krakatoa', country: 'Indonesia', lat: -6.102, lng: 105.423, elevation: 813, type: 'Caldera', lastEruption: '2020' },
  { name: 'Sinabung', country: 'Indonesia', lat: 3.170, lng: 98.392, elevation: 2460, type: 'Stratovolcano', lastEruption: '2021' },
  { name: 'Semeru', country: 'Indonesia', lat: -8.108, lng: 112.922, elevation: 3676, type: 'Stratovolcano', lastEruption: '2024' },
  { name: 'Tambora', country: 'Indonesia', lat: -8.250, lng: 118.000, elevation: 2850, type: 'Stratovolcano', lastEruption: '1967' },
  { name: 'Kelud', country: 'Indonesia', lat: -7.930, lng: 112.308, elevation: 1731, type: 'Stratovolcano', lastEruption: '2014' },
  { name: 'Agung', country: 'Indonesia', lat: -8.343, lng: 115.508, elevation: 2997, type: 'Stratovolcano', lastEruption: '2019' },
  { name: 'Sakurajima', country: 'Japan', lat: 31.585, lng: 130.657, elevation: 1117, type: 'Stratovolcano', lastEruption: '2024' },
  { name: 'Mount Fuji', country: 'Japan', lat: 35.361, lng: 138.728, elevation: 3776, type: 'Stratovolcano', lastEruption: '1708' },
  { name: 'Aso', country: 'Japan', lat: 32.884, lng: 131.104, elevation: 1592, type: 'Caldera', lastEruption: '2021' },
  { name: 'Ontake', country: 'Japan', lat: 35.893, lng: 137.480, elevation: 3067, type: 'Stratovolcano', lastEruption: '2014' },
  { name: 'Popocatepetl', country: 'Mexico', lat: 19.023, lng: -98.622, elevation: 5426, type: 'Stratovolcano', lastEruption: '2024' },
  { name: 'Colima', country: 'Mexico', lat: 19.514, lng: -103.617, elevation: 3850, type: 'Stratovolcano', lastEruption: '2017' },
  { name: 'Paricutin', country: 'Mexico', lat: 19.493, lng: -102.251, elevation: 2800, type: 'Cinder cone', lastEruption: '1952' },
  { name: 'Fuego', country: 'Guatemala', lat: 14.473, lng: -90.880, elevation: 3763, type: 'Stratovolcano', lastEruption: '2024' },
  { name: 'Pacaya', country: 'Guatemala', lat: 14.382, lng: -90.601, elevation: 2552, type: 'Stratovolcano', lastEruption: '2021' },
  { name: 'Santa Maria', country: 'Guatemala', lat: 14.756, lng: -91.552, elevation: 3772, type: 'Stratovolcano', lastEruption: '2020' },
  { name: 'Arenal', country: 'Costa Rica', lat: 10.463, lng: -84.703, elevation: 1670, type: 'Stratovolcano', lastEruption: '2010' },
  { name: 'Poas', country: 'Costa Rica', lat: 10.200, lng: -84.233, elevation: 2708, type: 'Stratovolcano', lastEruption: '2019' },
  { name: 'Villarrica', country: 'Chile', lat: -39.420, lng: -71.930, elevation: 2847, type: 'Stratovolcano', lastEruption: '2024' },
  { name: 'Calbuco', country: 'Chile', lat: -41.330, lng: -72.614, elevation: 2003, type: 'Stratovolcano', lastEruption: '2015' },
  { name: 'Llaima', country: 'Chile', lat: -38.692, lng: -71.729, elevation: 3125, type: 'Stratovolcano', lastEruption: '2009' },
  { name: 'Cotopaxi', country: 'Ecuador', lat: -0.677, lng: -78.436, elevation: 5911, type: 'Stratovolcano', lastEruption: '2023' },
  { name: 'Tungurahua', country: 'Ecuador', lat: -1.467, lng: -78.442, elevation: 5023, type: 'Stratovolcano', lastEruption: '2016' },
  { name: 'Sangay', country: 'Ecuador', lat: -2.005, lng: -78.341, elevation: 5230, type: 'Stratovolcano', lastEruption: '2024' },
  { name: 'Nevado del Ruiz', country: 'Colombia', lat: 4.892, lng: -75.324, elevation: 5321, type: 'Stratovolcano', lastEruption: '2023' },
  { name: 'Galeras', country: 'Colombia', lat: 1.220, lng: -77.359, elevation: 4276, type: 'Stratovolcano', lastEruption: '2014' },
  { name: 'Nyiragongo', country: 'DR Congo', lat: -1.520, lng: 29.250, elevation: 3470, type: 'Stratovolcano', lastEruption: '2021' },
  { name: 'Ol Doinyo Lengai', country: 'Tanzania', lat: -2.764, lng: 35.914, elevation: 2962, type: 'Stratovolcano', lastEruption: '2013' },
  { name: 'Erta Ale', country: 'Ethiopia', lat: 13.600, lng: 40.670, elevation: 613, type: 'Shield', lastEruption: '2023' },
  { name: 'Piton de la Fournaise', country: 'France (Reunion)', lat: -21.244, lng: 55.708, elevation: 2632, type: 'Shield', lastEruption: '2024' },
  { name: 'Mount Cameroon', country: 'Cameroon', lat: 4.203, lng: 9.170, elevation: 4040, type: 'Stratovolcano', lastEruption: '2012' },
  { name: 'Erebus', country: 'Antarctica', lat: -77.530, lng: 167.170, elevation: 3794, type: 'Stratovolcano', lastEruption: '2024' },
  { name: 'Eyjafjallajokull', country: 'Iceland', lat: 63.633, lng: -19.633, elevation: 1651, type: 'Stratovolcano', lastEruption: '2010' },
  { name: 'Grimsvotn', country: 'Iceland', lat: 64.416, lng: -17.330, elevation: 1725, type: 'Caldera', lastEruption: '2011' },
  { name: 'Fagradalsfjall', country: 'Iceland', lat: 63.900, lng: -22.270, elevation: 385, type: 'Shield', lastEruption: '2024' },
  { name: 'Hekla', country: 'Iceland', lat: 63.983, lng: -19.700, elevation: 1491, type: 'Stratovolcano', lastEruption: '2000' },
  { name: 'Pinatubo', country: 'Philippines', lat: 15.130, lng: 120.350, elevation: 1486, type: 'Stratovolcano', lastEruption: '1993' },
  { name: 'Taal', country: 'Philippines', lat: 14.002, lng: 120.993, elevation: 311, type: 'Caldera', lastEruption: '2022' },
  { name: 'Mayon', country: 'Philippines', lat: 13.257, lng: 123.685, elevation: 2462, type: 'Stratovolcano', lastEruption: '2023' },
  { name: 'White Island', country: 'New Zealand', lat: -37.521, lng: 177.182, elevation: 321, type: 'Stratovolcano', lastEruption: '2019' },
  { name: 'Ruapehu', country: 'New Zealand', lat: -39.281, lng: 175.564, elevation: 2797, type: 'Stratovolcano', lastEruption: '2007' },
  { name: 'Klyuchevskoy', country: 'Russia', lat: 56.056, lng: 160.642, elevation: 4750, type: 'Stratovolcano', lastEruption: '2023' },
  { name: 'Shiveluch', country: 'Russia', lat: 56.653, lng: 161.360, elevation: 3283, type: 'Stratovolcano', lastEruption: '2023' },
];

export function createSeismicLayer(earthMesh) {
  const group = new THREE.Group();
  group.visible = false; // off by default; host toggles it on
  earthMesh.add(group);

  // Shared textures (built once, reused by every marker).
  const ringTex = quakeRingTexture('255,90,40'); // red/orange
  const volcanoTex = volcanoTriangleTexture();

  // The volcanoes are static, so they live in their own sub-group built once.
  const volcanoGroup = new THREE.Group();
  group.add(volcanoGroup);

  // Earthquakes are rebuilt on every refresh; we track their markers so we can
  // dispose them cleanly before rebuilding (volcanoes are left untouched).
  let quakeMarkers = []; // { sprite, baseScale, pulseSpeed, phase }
  let clickables = [];   // current array of clickable sprites (quakes+volcanoes)
  let loaded = false;    // becomes true after the first successful refresh
  let freshCb = null;    // host callback fired after fresh quake data lands
  let clock = 0;

  // --- Volcanoes: build once -------------------------------------------------
  function buildVolcanoes() {
    for (const v of VOLCANOES) {
      const mat = new THREE.SpriteMaterial({
        map: volcanoTex,
        transparent: true,
        depthTest: true,  // back-of-globe markers hidden by the opaque Earth
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const s = new THREE.Sprite(mat);
      s.position.copy(localFromLatLng(v.lat, v.lng));
      s.scale.setScalar(0.026);
      s.userData.feature = {
        kind: 'volcano',
        name: v.name,
        country: v.country,
        lat: v.lat,
        lng: v.lng,
        elevation: v.elevation,
        type: v.type,
        lastEruption: v.lastEruption,
      };
      volcanoGroup.add(s);
    }
  }

  // --- Earthquakes: dispose + rebuild ---------------------------------------
  function clearQuakes() {
    for (const m of quakeMarkers) {
      group.remove(m.sprite);
      m.sprite.material.dispose();
    }
    quakeMarkers = [];
  }

  // Magnitude -> on-screen marker size. Small for 2.5, large for 7+.
  function quakeScale(mag) {
    return 0.018 + Math.max(0, mag - 2.5) * 0.012;
  }

  // Magnitude -> pulse speed. Small quakes pulse slowly; big ones beat fast and
  // urgently.
  function quakePulseSpeed(mag) {
    return 1.4 + Math.max(0, mag - 2.5) * 0.55;
  }

  function buildQuakes(features) {
    clearQuakes();
    for (const f of features) {
      const props = f.properties || {};
      const coords = (f.geometry && f.geometry.coordinates) || [];
      const lng = coords[0];
      const lat = coords[1];
      const depthKm = coords[2];
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const mag = typeof props.mag === 'number' ? props.mag : 0;

      const mat = new THREE.SpriteMaterial({
        map: ringTex,
        transparent: true,
        depthTest: true,  // occluded by the opaque Earth when on the far side
        depthWrite: false,
        blending: THREE.AdditiveBlending, // glow stacks against space
      });
      const s = new THREE.Sprite(mat);
      s.position.copy(localFromLatLng(lat, lng));
      const baseScale = quakeScale(mag);
      s.scale.setScalar(baseScale);
      s.userData.feature = {
        kind: 'quake',
        mag,
        place: props.place || 'Unknown location',
        time: props.time || 0,
        depthKm: typeof depthKm === 'number' ? depthKm : null,
      };
      group.add(s);
      quakeMarkers.push({
        sprite: s,
        baseScale,
        pulseSpeed: quakePulseSpeed(mag),
        phase: Math.random() * Math.PI * 2, // desync the pulses
      });
    }
  }

  // Rebuild the flat list of clickable meshes the host raycasts against.
  function rebuildClickables() {
    clickables = [
      ...quakeMarkers.map((m) => m.sprite),
      ...volcanoGroup.children,
    ];
  }

  // --- Public methods --------------------------------------------------------

  // Fetch the latest quakes and rebuild their markers. Never throws: any
  // network/parse failure is swallowed and the existing markers stay put.
  async function refresh() {
    try {
      const res = await fetch(QUAKE_FEED);
      if (!res.ok) throw new Error(`USGS feed ${res.status}`);
      const data = await res.json();
      let features = Array.isArray(data.features) ? data.features : [];
      // Cap to the most significant quakes if the feed is huge.
      if (features.length > MAX_QUAKES) {
        features = features
          .slice()
          .sort((a, b) => (b.properties?.mag || 0) - (a.properties?.mag || 0))
          .slice(0, MAX_QUAKES);
      }
      buildQuakes(features);
      rebuildClickables();
      loaded = true;
      if (freshCb) freshCb();
    } catch (err) {
      // Stay quiet on the globe; just log so it's debuggable.
      console.warn('[seismic] quake refresh failed:', err);
    }
  }

  // Per-frame pulse: each quake ring breathes in scale + opacity at its own
  // magnitude-driven speed, so a big quake throbs urgently and a small one
  // barely shimmers.
  function update(dt) {
    clock += dt;
    for (const m of quakeMarkers) {
      const t = clock * m.pulseSpeed + m.phase;
      const pulse = 1 + Math.sin(t) * 0.35;
      m.sprite.scale.setScalar(m.baseScale * pulse);
      m.sprite.material.opacity = 0.55 + (Math.sin(t) * 0.5 + 0.5) * 0.45;
    }
  }

  function getClickables() {
    return clickables;
  }

  function setVisible(v) {
    group.visible = !!v;
  }

  function onFresh(cb) {
    freshCb = cb;
  }

  function isLoaded() {
    return loaded;
  }

  // Tear everything down: markers, shared textures, and the group itself.
  function dispose() {
    clearQuakes();
    for (const s of volcanoGroup.children) s.material.dispose();
    volcanoGroup.clear();
    ringTex.dispose();
    volcanoTex.dispose();
    if (group.parent) group.parent.remove(group);
    clickables = [];
  }

  // Volcanoes are hardcoded, so build them immediately and make them clickable
  // even before the first quake fetch resolves.
  buildVolcanoes();
  rebuildClickables();

  return {
    group,
    getClickables,
    refresh,
    update,
    setVisible,
    onFresh,
    isLoaded,
    dispose,
  };
}
