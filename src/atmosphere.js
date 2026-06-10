import * as THREE from 'three';

// --- Vertex shader ---
// The fragment shader needs two normals: one in view space (to find the
// glowing rim at the planet's edge) and one in world space (to tell which
// side of the planet faces the Sun).
const vertexShader = /* glsl */ `
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;

  void main() {
    vViewNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// --- Fragment shader ---
// A soft blue halo that is strongest right at the planet's edge and fades
// outward, and that glows brighter on the daylit side than the night side.
const fragmentShader = /* glsl */ `
  uniform vec3 sunDirection;

  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;

  void main() {
    // Fresnel-style rim: brightest where the surface grazes the camera.
    float rim = pow(0.65 - dot(vViewNormal, vec3(0.0, 0.0, 1.0)), 4.0);
    rim = max(rim, 0.0);

    // Dim the half of the halo that faces away from the Sun.
    float sun = dot(normalize(vWorldNormal), sunDirection);
    float dayside = smoothstep(-0.4, 0.5, sun);

    float glow = rim * mix(0.2, 1.0, dayside);
    gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * glow;
  }
`;

// A slightly larger sphere, drawn inside-out, that surrounds the globe.
// The opaque Earth hides its bright center, leaving only the glowing rim.
export function createAtmosphere() {
  const geometry = new THREE.SphereGeometry(1.15, 64, 64);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      // Kept in sync with the Earth's Sun direction (see main.js).
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
    },
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,             // show the inner faces so the glow wraps the globe
    blending: THREE.AdditiveBlending, // add light onto the black sky
    transparent: true,
    depthWrite: false,                // never hide objects behind the glow
  });

  return new THREE.Mesh(geometry, material);
}
