import * as THREE from 'three';

// --- Vertex shader ---
// Same world-normal + logarithmic-depth setup as the Earth shader, so the
// cloud shell's depth lines up with the rest of the scene (no bleed-through).
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
// The cloud map is white clouds on a black background, so its brightness
// doubles as the cloud's opacity. Clouds only catch light on the Sun-facing
// side and fade out across the terminator, so the night side keeps its glowing
// city lights uncovered.
const fragmentShader = /* glsl */ `
  uniform sampler2D cloudTexture;
  uniform vec3 sunDirection;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  #include <logdepthbuf_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    float cloudRaw = texture2D(cloudTexture, vUv).r; // white = thick cloud
    // Boost contrast so only real cloud masses show and thin haze stays clear,
    // keeping the continents and oceans visible underneath.
    float cloud = smoothstep(0.55, 0.96, cloudRaw);

    // Day/night, matched to the Earth's terminator.
    float sun = dot(normalize(vWorldNormal), sunDirection);
    float day = smoothstep(-0.1, 0.3, sun);

    // Bright white in daylight, dimming toward dusk; transparent at night.
    vec3 color = vec3(1.0) * (0.4 + 0.6 * day);
    float alpha = cloud * day * 0.6; // semi-transparent so the surface shows through

    gl_FragColor = vec4(color, alpha);
  }
`;

// A thin shell ~1% larger than the Earth, wrapped in a semi-transparent cloud
// map. It does NOT write depth (so it never hides the stars), but it DOES test
// depth (so the solid Earth hides the clouds on its far side).
export function createClouds(maxAnisotropy = 1, manager) {
  const geometry = new THREE.SphereGeometry(1.01, 64, 64);

  const loader = new THREE.TextureLoader(manager);
  const cloudTexture = loader.load('/textures/earthcloudmap.jpg');
  cloudTexture.colorSpace = THREE.LinearSRGBColorSpace; // a data mask, not a color photo
  cloudTexture.anisotropy = maxAnisotropy;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      cloudTexture: { value: cloudTexture },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false, // keep it out of the depth buffer so stars stay occluded by the Earth
    depthTest: true,
  });

  return new THREE.Mesh(geometry, material);
}
