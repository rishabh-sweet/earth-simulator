// Wanderglobe — hero mini-Earth.
//
// A small, beautiful, self-contained 3D globe for the landing page hero. It is
// deliberately decoupled from the full globe/solar-system app: the ONLY import
// is three.js, and everything it needs (shaders, pin math, textures) is adapted
// inline. The day/night shader is a simplified take on src/earth.js with a
// FIXED sun, and the lat/lng→position math matches src/pins.js exactly.

import * as THREE from 'three';

// The five postcard cities that ride on the spinning globe (lat, lng).
const PINS = [
  { lat: 35.68, lng: 139.65 }, // Tokyo
  { lat: 48.85, lng: 2.35 },   // Paris
  { lat: 40.71, lng: -74.0 },  // New York
  { lat: -8.34, lng: 115.09 }, // Bali
  { lat: -33.92, lng: 18.42 }, // Cape Town
];

// lat/lng (degrees) → a point in the Earth mesh's LOCAL space. This is the exact
// mapping used by the full app (src/pins.js) so a pin lands on the right spot of
// the equirectangular texture.
function localFromLatLng(lat, lng, r) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

// --- Earth day/night shader -------------------------------------------------
// Vertex shader carries the UV and the world-space normal to the fragment
// shader. No logarithmic-depth chunks here: this is a plain standalone scene.
const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// For each point, compare its normal to a FIXED sun direction and cross-fade
// from the daytime photo to the warm night-lights photo across a soft
// terminator — same recipe as src/earth.js, just with a constant sun.
const earthFragment = /* glsl */ `
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec3 sunDirection;

  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vec3 normal = normalize(vWorldNormal);

    // +1 = noon, 0 = sunrise/sunset, -1 = midnight.
    float sun = dot(normal, sunDirection);

    // Soft day/night blend — this is the terminator line.
    float dayAmount = smoothstep(-0.12, 0.28, sun);

    vec3 dayColor = texture2D(dayTexture, vUv).rgb;
    vec3 nightColor = texture2D(nightTexture, vUv).rgb;

    // Lift the day photo back to its true on-screen brightness with a little
    // extra punch, and nudge saturation so it reads vivid.
    dayColor = pow(dayColor, vec3(1.0 / 2.2)) * 1.15;
    float luma = dot(dayColor, vec3(0.299, 0.587, 0.114));
    dayColor = mix(vec3(luma), dayColor, 1.12);

    // Keep the lit half bright, easing into a soft dusk at the terminator.
    float dayShade = mix(0.7, 1.0, smoothstep(-0.05, 0.25, sun));

    // Punchy, warm-tinted city lights on the dark side.
    vec3 cityLights = pow(nightColor, vec3(1.4)) * vec3(1.0, 0.85, 0.45) * 3.5;

    vec3 color = mix(cityLights, dayColor * dayShade, dayAmount);
    gl_FragColor = vec4(color, 1.0);
  }
`;

// --- Atmosphere rim shader --------------------------------------------------
// A slightly larger back-side sphere whose edges glow (Fresnel) — gives the
// globe a soft halo that fades from electric-blue at the rim to coral.
const atmoVertex = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmoFragment = /* glsl */ `
  uniform vec3 cameraPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 viewDir = normalize(cameraPos - vWorldPos);
    // Rim glow: strongest where the surface faces away from the camera.
    float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vWorldNormal))), 2.6);
    vec3 blue = vec3(0.30, 0.62, 1.0);   // electric blue
    vec3 coral = vec3(1.0, 0.45, 0.38);  // warm coral
    vec3 col = mix(coral, blue, fresnel);
    gl_FragColor = vec4(col, fresnel * 0.9);
  }
`;

// A glowing gold dot drawn on a canvas, used as the pin sprite's texture.
function goldPinTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,205,90,1)');
  g.addColorStop(0.55, 'rgba(255,180,60,0.55)');
  g.addColorStop(1.0, 'rgba(255,170,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Entry point. `canvas` is an already-in-DOM <canvas> sized by CSS to fill its
// container. The page MUST give the canvas a CSS width/height. Safe to call
// with a missing canvas (returns silently).
export function initMiniGlobe(canvas) {
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Transparent clear so the page's gradient shows through behind the globe.
  renderer.setClearColor(0x000000, 0);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();

  // Camera framing a radius-1 Earth with a little breathing room, looking at
  // the equator from straight on.
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 3.4);
  camera.lookAt(0, 0, 0);

  // The Earth group is what spins; the ~23° tilt is purely for beauty.
  const earthGroup = new THREE.Group();
  earthGroup.rotation.z = THREE.MathUtils.degToRad(23.4);
  scene.add(earthGroup);

  // --- Earth mesh -----------------------------------------------------------
  const loader = new THREE.TextureLoader();
  const dayTexture = loader.load('/textures/earth_daymap.jpg');
  dayTexture.colorSpace = THREE.SRGBColorSpace;
  dayTexture.anisotropy = maxAniso;
  const nightTexture = loader.load('/textures/earth_nightmap.jpg');
  nightTexture.colorSpace = THREE.SRGBColorSpace;
  nightTexture.anisotropy = maxAniso;

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTexture },
        nightTexture: { value: nightTexture },
        sunDirection: { value: new THREE.Vector3(1.0, 0.35, 0.55).normalize() },
      },
      vertexShader: earthVertex,
      fragmentShader: earthFragment,
    })
  );
  earthGroup.add(earth);

  // --- Atmosphere halo ------------------------------------------------------
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: { cameraPos: { value: camera.position } },
      vertexShader: atmoVertex,
      fragmentShader: atmoFragment,
      side: THREE.BackSide,        // glow on the far shell, around the rim
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  );
  atmosphere.scale.setScalar(1.15);
  earthGroup.add(atmosphere);

  // --- Pins -----------------------------------------------------------------
  // Glowing gold sprites parented to the Earth mesh so they spin with it. They
  // sit just above the surface and depth-test against the opaque globe, so pins
  // on the far hemisphere are correctly hidden.
  const pinTexture = goldPinTexture();
  const pinSprites = PINS.map(({ lat, lng }) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: pinTexture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    sprite.position.copy(localFromLatLng(lat, lng, 1.02));
    sprite.scale.setScalar(0.07);
    earth.add(sprite);
    return sprite;
  });

  // --- Sizing ---------------------------------------------------------------
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();

  window.addEventListener('resize', resize);
  // ResizeObserver also catches container-driven size changes (e.g. layout
  // shifts) that don't fire a window resize event.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(canvas);
  }

  // --- Scroll: fade and gently shrink the canvas as the hero scrolls away ---
  // This is a CSS transform on the <canvas> element and does NOT touch the
  // WebGL render — it just animates the whole canvas cheaply.
  canvas.style.transformOrigin = 'center center';
  function onScroll() {
    const progress = Math.min(Math.max(window.scrollY / (window.innerHeight * 0.8), 0), 1);
    canvas.style.opacity = String(1 - progress);
    canvas.style.transform = `scale(${1 - progress * 0.22})`;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // --- Animation loop -------------------------------------------------------
  const clock = new THREE.Clock();
  let rafId = null;

  function frame() {
    rafId = requestAnimationFrame(frame);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    // Slow, endless auto-rotation; pins ride along since they're children.
    earthGroup.rotation.y += dt * 0.12;

    // Gentle synchronized pulse on the pins.
    const pulse = 0.07 * (1 + Math.sin(t * 2.4) * 0.18);
    for (const sprite of pinSprites) sprite.scale.setScalar(pulse);

    renderer.render(scene, camera);
  }

  function start() {
    if (rafId == null) {
      clock.getDelta(); // drop the long pause so rotation doesn't jump
      frame();
    }
  }
  function stop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // Pause when the tab is hidden to save battery; resume when it returns.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  start();
}
