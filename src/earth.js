import * as THREE from 'three';

// --- Vertex shader ---
// Pass the texture coordinate and the world-space surface normal (the normal
// rotated to follow the spinning globe) along to the fragment shader.
// The logdepthbuf includes make this custom shader write the SAME depth values
// as three.js' built-in materials when the renderer uses a logarithmic depth
// buffer — without them the Earth's depth wouldn't match the starfield's, and
// stars would punch through the globe.
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

// --- Fragment shader ---
// For every point on the globe, compare its normal to the Sun direction and
// blend between the daytime photo and the night-lights photo accordingly.
const fragmentShader = /* glsl */ `
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec3 sunDirection;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  #include <logdepthbuf_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    vec3 normal = normalize(vWorldNormal);

    // How directly this point faces the Sun: +1 = noon, 0 = sunrise/sunset, -1 = midnight.
    float sun = dot(normal, sunDirection);

    // Soft transition from night (0) to day (1) — this is the terminator line.
    float dayAmount = smoothstep(-0.12, 0.28, sun);

    vec3 dayColor = texture2D(dayTexture, vUv).rgb;
    vec3 nightColor = texture2D(nightTexture, vUv).rgb;

    // The day photo is sampled in dark "linear" space, so lift it back to its
    // true on-screen brightness and add a little extra punch for a vivid,
    // daytime-satellite look.
    dayColor = pow(dayColor, vec3(1.0 / 2.2)) * 1.15;

    // Nudge the colors to be a touch more saturated so they read as vivid.
    float luma = dot(dayColor, vec3(0.299, 0.587, 0.114));
    dayColor = mix(vec3(luma), dayColor, 1.12);

    // Keep the whole lit half bright: stay near full brightness across most of
    // the curve and only ease into a soft dusk right at the terminator.
    float dayShade = mix(0.7, 1.0, smoothstep(-0.05, 0.25, sun));

    // Boost contrast (so faint areas stay dark) and tint the lights warm yellow.
    vec3 cityLights = pow(nightColor, vec3(1.4)) * vec3(1.0, 0.85, 0.45) * 3.5;

    // Day photo where it's lit, glowing cities where it's dark.
    vec3 color = mix(cityLights, dayColor * dayShade, dayAmount);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Build the Earth: a sphere driven by the custom day/night shader above.
// `maxAnisotropy` (from the renderer) keeps the textures sharp at grazing
// angles near the horizon instead of looking blocky or seamed.
export function createEarth(maxAnisotropy = 1, manager) {
  const geometry = new THREE.SphereGeometry(1, 128, 128);
  const loader = new THREE.TextureLoader(manager);

  // Daytime "Blue Marble" photo. It's a color image, so decode it from sRGB.
  // NASA 8K — falls back to local if unreachable
  const dayTexture = loader.load(
    'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73776/world.topo.bathy.200412.3x5400x2700.jpg',
    undefined,
    undefined,
    () => { loader.load('/textures/earth_daymap.jpg', (t) => { dayTexture.image = t.image; dayTexture.needsUpdate = true; }); }
  );
  dayTexture.colorSpace = THREE.SRGBColorSpace;
  dayTexture.anisotropy = maxAnisotropy;
  dayTexture.minFilter = THREE.LinearMipmapLinearFilter;
  dayTexture.magFilter = THREE.LinearFilter;
  dayTexture.generateMipmaps = true;

  // Night-time "Black Marble" city lights, same projection so it lines up.
  const nightTexture = loader.load('/textures/earth_nightmap.jpg');
  nightTexture.colorSpace = THREE.SRGBColorSpace;
  nightTexture.anisotropy = maxAnisotropy;
  nightTexture.minFilter = THREE.LinearMipmapLinearFilter;
  nightTexture.magFilter = THREE.LinearFilter;
  nightTexture.generateMipmaps = true;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      dayTexture: { value: dayTexture },
      nightTexture: { value: nightTexture },
      // Updated every frame from the real clock (see main.js).
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
    },
    vertexShader,
    fragmentShader,
    transparent: false, // the globe is fully opaque...
    depthWrite: true,   // ...and writes to the depth buffer, so it always
    depthTest: true,    //    occludes the starfield sitting far behind it.
  });

  return new THREE.Mesh(geometry, material);
}
