import * as THREE from 'three';

// Earth's cloud layer: a thin shell just above the surface, plus a matching
// shadow shell just below it. The cloud map is a grayscale mask, used here as a
// feathered alpha so clouds are wispy and transparent at the edges (not solid
// white blobs), and they catch the sunlight on the day side.
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

const cloudFragment = /* glsl */ `
  uniform sampler2D cloudTexture;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float mask = texture2D(cloudTexture, vUv).r;
    float sun = dot(normalize(vWorldNormal), sunDirection);
    float day = smoothstep(-0.1, 0.35, sun);
    // feathered alpha: thin cloud stays wispy/faint, thick cloud denser
    float alpha = clamp(pow(mask, 1.3) * 0.95, 0.0, 0.92) * day;
    // catch the sun — bright white on the lit side, a slight emissive lift so
    // dusk clouds still glow faintly
    vec3 col = vec3(1.0) * (0.55 + 0.45 * clamp(sun, 0.0, 1.0)) + 0.05;
    gl_FragColor = vec4(col, alpha);
  }
`;

// A soft dark layer just below the clouds → their shadow on the surface.
const shadowFragment = /* glsl */ `
  uniform sampler2D cloudTexture;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float mask = texture2D(cloudTexture, vUv).r;
    float sun = dot(normalize(vWorldNormal), sunDirection);
    float day = smoothstep(0.0, 0.4, sun); // shadows only where the sun reaches
    float alpha = pow(mask, 1.5) * 0.33 * day;
    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
  }
`;

export function createCloudLayers(maxAnisotropy = 1, manager) {
  const loader = new THREE.TextureLoader(manager);
  const tex = loader.load('/textures/earthcloudmap.jpg');
  tex.colorSpace = THREE.LinearSRGBColorSpace; // a data mask, not a colour photo
  tex.anisotropy = maxAnisotropy;

  const mk = (fragmentShader) =>
    new THREE.ShaderMaterial({
      uniforms: {
        cloudTexture: { value: tex },
        sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false, // never hides the stars; the opaque Earth occludes it
      depthTest: true,
    });

  // shadow just above the surface, clouds just above the shadow — both barely
  // off the surface so the layer reads as hugging the planet
  const shadow = new THREE.Mesh(new THREE.SphereGeometry(1.003, 64, 64), mk(shadowFragment));
  shadow.renderOrder = 1;
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.006, 64, 64), mk(cloudFragment));
  clouds.renderOrder = 2;

  return { clouds, shadow };
}
