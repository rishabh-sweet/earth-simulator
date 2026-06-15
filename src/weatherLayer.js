import * as THREE from 'three';

// Live precipitation/cloud radar overlay wrapping the Earth, fed by the free
// RainViewer global radar tiles (https://www.rainviewer.com/api.html — no key,
// no signup). It rides the Earth mesh as a child (like the pins) so it stays
// geo-aligned with the globe, and it refreshes itself every 10 minutes.
//
// Everything that touches the network or a canvas is wrapped in try/catch: if
// ANYTHING goes wrong (fetch fails, a tile errors, the canvas is CORS-tainted)
// the overlay simply hides itself and the app's static cloud layer carries on.

// --- geometry / shader -------------------------------------------------------

const WEATHER_R = 1.012; // sit just above the static cloud shell at 1.006

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

// The sphere has equirectangular UVs but the RainViewer tiles are stitched in
// Web-Mercator, so we can't sample them with vUv.y directly. We turn vUv.y into
// a real latitude, then into a normalised Mercator row, and sample there.
const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D radarTexture;
  uniform float opacity;
  varying vec2 vUv;
  #include <logdepthbuf_pars_fragment>

  const float PI = 3.141592653589793;
  // Web-Mercator can only represent up to ~85.051129° before tan() blows up.
  const float MAX_LAT = 1.484422229745332; // 85.051129° in radians

  void main() {
    #include <logdepthbuf_fragment>

    // vUv.y = 1 → north pole (+90°), vUv.y = 0 → south pole (−90°), matching the
    // day texture's orientation.
    float lat = (vUv.y - 0.5) * PI;

    // Beyond the Mercator limit the tiles have no data → fully transparent.
    if (abs(lat) > MAX_LAT) discard;

    // latitude → normalised Mercator [0..1], 0 at the top (north).
    float merc01 = 0.5 - log(tan(PI / 4.0 + lat / 2.0)) / (2.0 * PI);

    // CanvasTexture defaults to flipY = true, so the canvas top (north) ends up
    // at v = 1. Sampling at (1.0 - merc01) puts north-up. x passes straight
    // through (longitude is linear in both projections).
    vec4 tile = texture2D(radarTexture, vec2(vUv.x, 1.0 - merc01));

    float a = tile.a * opacity;
    if (a < 0.01) discard; // skip the empty (no-rain) pixels entirely
    gl_FragColor = vec4(tile.rgb, a);
  }
`;

// --- RainViewer constants ----------------------------------------------------

const MAPS_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const ZOOM = 2;                         // 4×4 = 16 tiles
const TILES = 1 << ZOOM;                // 4 tiles per side
const TILE_PX = 256;
const SIZE = TILE_PX * TILES;           // 1024×1024 stitched canvas
const COLOR = 2;                        // RainViewer "Universal Blue" palette
const OPTIONS = '1_1';                  // smooth=1, snow=1
const REFRESH_MS = 10 * 60 * 1000;      // re-poll every 10 minutes

// Load one tile as an Image. ALWAYS resolves — a failed/blocked tile resolves
// with null so one bad tile never sinks the whole frame.
function loadTile(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // required so the canvas stays untainted
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function createWeatherLayer(earthMesh, onFresh) {
  const geometry = new THREE.SphereGeometry(WEATHER_R, 64, 64);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      radarTexture: { value: null },
      opacity: { value: 0.6 }, // semi-transparent overlay
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false, // never hides the stars; the opaque Earth occludes it
    depthTest: true,
    blending: THREE.NormalBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;   // stay hidden until real data lands
  mesh.renderOrder = 3;   // draw after the static cloud/shadow shells (1, 2)
  earthMesh.add(mesh);    // child of the Earth → rotates and geo-aligns with it

  let texture = null;     // the live CanvasTexture (replaced each refresh)
  let timer = null;       // setTimeout handle for the polling chain
  let disposed = false;

  // Swap in a fresh texture and dispose the old one.
  function setTexture(next) {
    if (texture) texture.dispose();
    texture = next;
    material.uniforms.radarTexture.value = texture;
  }

  // Fetch the latest radar frame and stitch its 16 tiles onto one canvas.
  async function refresh() {
    if (disposed) return;
    try {
      const res = await fetch(MAPS_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('weather-maps fetch failed');
      const data = await res.json();

      const host = data && data.host;
      const radar = data && data.radar;
      if (!host || !radar) throw new Error('unexpected weather-maps shape');

      // Prefer the freshest nowcast frame, else the most recent past frame.
      const nowcast = radar.nowcast || [];
      const past = radar.past || [];
      const frame = nowcast[nowcast.length - 1] || past[past.length - 1];
      if (!frame || !frame.path) throw new Error('no radar frame available');

      // Build all 16 tile URLs and load them in parallel.
      const jobs = [];
      for (let x = 0; x < TILES; x++) {
        for (let y = 0; y < TILES; y++) {
          const url = `${host}${frame.path}/${TILE_PX}/${ZOOM}/${x}/${y}/${COLOR}/${OPTIONS}.png`;
          jobs.push(loadTile(url).then((img) => ({ x, y, img })));
        }
      }
      const tiles = await Promise.all(jobs);
      if (disposed) return;

      // Draw every tile that loaded onto the offscreen canvas. Tile (x, y) at
      // zoom 2 places x left→right (west→east) and y top→bottom (north→south),
      // which is exactly Mercator row order.
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      let drew = 0;
      for (const t of tiles) {
        if (!t.img) continue;
        ctx.drawImage(t.img, t.x * TILE_PX, t.y * TILE_PX, TILE_PX, TILE_PX);
        drew++;
      }
      if (drew === 0) throw new Error('no tiles loaded');

      // CORS taint check: if any tile slipped through without proper headers,
      // reading a pixel throws a SecurityError → bail out to the fallback.
      ctx.getImageData(0, 0, 1, 1);

      const next = new THREE.CanvasTexture(canvas);
      next.colorSpace = THREE.SRGBColorSpace;
      next.minFilter = THREE.LinearFilter; // non-power-of-two-safe + smooth
      next.magFilter = THREE.LinearFilter;
      next.generateMipmaps = false;
      next.wrapS = THREE.RepeatWrapping;   // longitude wraps around the globe
      next.needsUpdate = true;

      setTexture(next);
      mesh.visible = true;
      if (typeof onFresh === 'function') onFresh();
    } catch (err) {
      // Any failure → quietly hide and let the static cloud layer stand in.
      mesh.visible = false;
      // (No re-throw: this function must never throw.)
    }
  }

  // Kick off the first load, then chain a refresh every 10 minutes. We use a
  // setTimeout chain (not setInterval) so a slow refresh can't stack up. Network
  // polling like this is fine on a timer — it isn't per-frame animation.
  function scheduleNext() {
    if (disposed) return;
    timer = setTimeout(() => {
      refresh().finally(scheduleNext);
    }, REFRESH_MS);
  }
  refresh().finally(scheduleNext);

  // Per-frame hook. Kept deliberately cheap: a faint breathing of the overlay
  // opacity so live weather reads as "alive" without distracting.
  let clock = 0;
  function update(dt) {
    if (!mesh.visible) return;
    clock += dt || 0;
    material.uniforms.opacity.value = 0.6 + Math.sin(clock * 1.2) * 0.06;
  }

  function dispose() {
    disposed = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (mesh.parent) mesh.parent.remove(mesh);
    geometry.dispose();
    material.dispose();
    if (texture) {
      texture.dispose();
      texture = null;
    }
  }

  return { mesh, update, refresh, dispose };
}
