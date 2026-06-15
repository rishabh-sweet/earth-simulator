import * as THREE from 'three';

// --- Vertex shader ---
// Pass the texture coordinate and the world-space surface normal (the normal
// rotated to follow the spinning globe) along to the fragment shader. The
// world normal lets us decide, per point, whether this part of the cap is on
// the Sun-lit half or the dark half of the planet.
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// --- Fragment shader ---
// Paint flowing vertical "curtains" of light over the polar cap. The pattern
// is built from layered sine waves so it ripples and drifts over time, and it
// only shows on the night side of the Earth (just like real aurorae, which are
// washed out by daylight).
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSun;

  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    // uv.x runs 0..1 around the pole (longitude), uv.y runs 0..1 across the
    // cap (0 = edge near 60deg, 1 = the pole itself, depending on the cap).
    float around = vUv.x;
    float across = vUv.y;

    // --- Build the curtains ---
    // Several octaves of sine waves wrapping around the pole, each drifting at
    // a different speed so the bands shimmer and never quite repeat. We feed in
    // "across" too so the curtains lean and waver as they rise.
    float c1 = sin(around * 18.0 + uTime * 0.8 + across * 4.0);
    float c2 = sin(around * 34.0 - uTime * 1.3 + across * 7.0);
    float c3 = sin(around * 60.0 + uTime * 2.1 - across * 3.0);
    float c4 = cos(around * 9.0 + uTime * 0.5);

    // Combine the octaves into a single 0..1 brightness field. Weighting the
    // higher frequencies less keeps broad sheets of glow with finer streaks on
    // top, rather than a noisy mess.
    float curtains = 0.5 + 0.5 * (c1 * 0.5 + c2 * 0.3 + c3 * 0.15 + c4 * 0.2);

    // Raise to a power so the bright streaks stay narrow and the gaps go soft
    // and dark — that "rayed curtain" look, with no hard edges.
    curtains = pow(clamp(curtains, 0.0, 1.0), 2.5);

    // A slow, whole-sky breathing pulse so the aurora gently brightens and dims.
    float pulse = 0.7 + 0.3 * sin(uTime * 0.6);
    float intensity = curtains * pulse;

    // --- Colour ramp ---
    // Walk electric green -> cyan -> purple across the curtains using a smooth
    // mixing value driven by position and a slow time drift.
    vec3 green  = vec3(0.0, 1.0, 0.533); // #00ff88
    vec3 cyan   = vec3(0.0, 1.0, 1.0);   // #00ffff
    vec3 purple = vec3(0.533, 0.0, 1.0); // #8800ff

    float ramp = 0.5 + 0.5 * sin(around * 6.0 + across * 3.0 + uTime * 0.4);
    vec3 color = mix(green, cyan, smoothstep(0.0, 0.5, ramp));
    color = mix(color, purple, smoothstep(0.5, 1.0, ramp));

    // --- Night-side mask ---
    // How directly this point faces the Sun: +1 = noon, -1 = midnight. Reuse
    // the same terminator falloff as the Earth shader so the aurora fades out
    // right where the planet turns to day.
    float day = smoothstep(-0.12, 0.28, dot(normalize(vWorldNormal), uSun));
    float night = 1.0 - day;

    // --- Edge fade ---
    // Fade the glow toward the 60deg edge of the cap so there's no visible
    // boundary where the geometry stops. Both caps have uv.y ~0 at the equatorward
    // edge and ~1 at the pole; smoothstep gives a gentle ramp up from the rim.
    float edge = smoothstep(0.0, 0.35, across);

    // Keep the peak alpha moderate so stars still twinkle through the glow.
    float alpha = intensity * night * edge * 0.6;

    gl_FragColor = vec4(color * intensity, alpha);
  }
`;

// Shared material configuration for both caps. Additive blending makes the
// overlapping curtains glow and stack like real light; double-sided so the cap
// reads correctly however we view the pole; no depth writes so it never
// occludes the stars or the globe behind it.
function createAuroraMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: new THREE.Vector3(1, 0, 0) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// Build the aurora rig: two glowing polar caps that hover just above the
// atmosphere. Off by default — a UI toggle flips it on via setVisible().
export function createAurora(scene) {
  const group = new THREE.Group();

  // Both caps sit at radius 1.06 — just outside the ~1.05 atmosphere shell.
  const RADIUS = 1.06;
  const CAP_ANGLE = (Math.PI * 30) / 180; // 30deg of polar angle = latitudes beyond +/-60deg.

  // North cap: a dome from the north pole (polar angle 0) down to 60degN.
  const northGeo = new THREE.SphereGeometry(RADIUS, 96, 48, 0, Math.PI * 2, 0, CAP_ANGLE);

  // South cap: the matching dome from 60degS down to the south pole.
  const southGeo = new THREE.SphereGeometry(
    RADIUS,
    96,
    48,
    0,
    Math.PI * 2,
    Math.PI - CAP_ANGLE,
    CAP_ANGLE
  );

  // Each cap gets its own material instance so their uniforms are independent
  // objects (we still keep both in sync every frame in update()).
  const northMat = createAuroraMaterial();
  const southMat = createAuroraMaterial();

  const north = new THREE.Mesh(northGeo, northMat);
  const south = new THREE.Mesh(southGeo, southMat);

  // Draw after the opaque globe and atmosphere so the additive glow lands on top.
  north.renderOrder = 5;
  south.renderOrder = 5;

  group.add(north);
  group.add(south);
  group.visible = false; // off until the toggle turns it on
  scene.add(group);

  const materials = [northMat, southMat];

  return {
    group,

    // Advance the animation and feed in the current Sun direction. Called every
    // frame; written defensively so a missing sunDir or dt never throws.
    update(sunDir, dt) {
      const step = typeof dt === 'number' && isFinite(dt) ? dt : 0;
      for (const mat of materials) {
        mat.uniforms.uTime.value += step;
        if (sunDir) {
          mat.uniforms.uSun.value.copy(sunDir).normalize();
        }
      }
    },

    // Flip the whole rig on or off.
    setVisible(v) {
      group.visible = !!v;
    },

    // Free GPU resources for both caps.
    dispose() {
      northGeo.dispose();
      southGeo.dispose();
      northMat.dispose();
      southMat.dispose();
      scene.remove(group);
    },
  };
}
