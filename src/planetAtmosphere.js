import * as THREE from 'three';

// A soft additive rim of light around a planet — its atmosphere seen at the
// limb. A slightly larger back-facing sphere with a Fresnel falloff, tinted per
// planet. (Includes the logarithmic-depth chunks so it sorts correctly.)
const vertexShader = /* glsl */ `
  varying vec3 vViewNormal;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 glowColor;
  uniform float intensity;
  varying vec3 vViewNormal;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float rim = pow(0.72 - dot(vViewNormal, vec3(0.0, 0.0, 1.0)), 3.0);
    rim = clamp(rim, 0.0, 1.0);
    gl_FragColor = vec4(glowColor, 1.0) * rim * intensity;
  }
`;

export function createPlanetGlow(radius, colorHex, intensity = 1.0, scale = 1.16) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(colorHex) },
      intensity: { value: intensity },
    },
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 48, 48), mat);
}
