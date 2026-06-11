import * as THREE from 'three';

// Scatter N stars across a big sphere that sits far behind everything: the
// stars are at radius 400 while the Earth is radius 1, so the globe is always
// well in front of them. depthTest is on so the solid Earth occludes any star
// behind it — no star ever shows through the planet.
export function createStarfield(count = 8000) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  const r = 400; // far behind the Earth, but still inside the camera's far plane
  for (let i = 0; i < count; i++) {
    // Evenly distributed direction on the sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.5,
    sizeAttenuation: true,
    depthTest: true,   // respect depth so the opaque Earth hides stars behind it
    depthWrite: false, // stars needn't occlude each other
  });

  return new THREE.Points(geometry, material);
}
