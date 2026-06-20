// Population density heatmap — canvas texture with Gaussian blobs over major population centres.
import * as THREE from 'three';

const W = 2048, H = 1024;

// [lat, lng, weight] — weight 1..10
const CENTERS = [
  // East/South Asia (heaviest)
  [31.2, 121.5, 10], // Shanghai
  [22.3, 114.2, 9],  // Hong Kong / Pearl River Delta
  [39.9, 116.4, 9],  // Beijing
  [28.6, 77.2, 9],   // Delhi
  [19.1, 72.9, 8],   // Mumbai
  [35.7, 139.7, 8],  // Tokyo
  [22.6, 88.4, 8],   // Kolkata
  [23.7, 90.4, 8],   // Dhaka
  [6.5, 3.4, 7],     // Lagos
  [13.1, 80.3, 8],   // Chennai
  [37.6, 127.0, 7],  // Seoul
  [17.4, 78.5, 7],   // Hyderabad
  [12.9, 77.6, 7],   // Bangalore
  [26.8, 80.9, 7],   // Lucknow / Kanpur
  [25.6, 85.1, 7],   // Patna
  [23.0, 72.6, 7],   // Ahmedabad
  [31.5, 74.3, 6],   // Lahore
  [24.9, 67.0, 6],   // Karachi
  [33.7, 73.1, 6],   // Islamabad
  [30.1, 31.2, 6],   // Cairo
  [3.1, 101.7, 6],   // Kuala Lumpur
  [14.1, 100.5, 6],  // Bangkok
  [1.3, 103.8, 6],   // Singapore
  [10.8, 106.7, 6],  // Ho Chi Minh City
  [21.0, 105.8, 6],  // Hanoi
  [23.1, 113.3, 8],  // Guangzhou
  [30.6, 104.1, 7],  // Chengdu
  [29.6, 91.1, 5],   // Lhasa area

  // Europe
  [51.5, -0.1, 7],   // London
  [48.9, 2.3, 7],    // Paris
  [52.5, 13.4, 6],   // Berlin
  [50.1, 14.4, 5],   // Prague / central Europe
  [52.2, 21.0, 5],   // Warsaw
  [55.8, 37.6, 6],   // Moscow
  [50.4, 30.5, 5],   // Kyiv
  [41.0, 29.0, 6],   // Istanbul
  [40.4, -3.7, 5],   // Madrid
  [45.5, 9.2, 6],    // Milan / Po valley
  [48.2, 16.4, 5],   // Vienna
  [47.4, 19.1, 5],   // Budapest
  [41.9, 12.5, 5],   // Rome

  // Americas
  [40.7, -74.0, 8],  // New York
  [34.1, -118.2, 7], // Los Angeles
  [41.8, -87.6, 7],  // Chicago
  [29.8, -95.4, 6],  // Houston
  [33.4, -112.1, 5], // Phoenix
  [19.4, -99.1, 8],  // Mexico City
  [-23.5, -46.6, 8], // São Paulo
  [-22.9, -43.2, 7], // Rio de Janeiro
  [-34.6, -58.4, 6], // Buenos Aires
  [4.7, -74.1, 5],   // Bogotá
  [-12.0, -77.0, 5], // Lima
  [10.5, -66.9, 5],  // Caracas
  [43.7, -79.4, 5],  // Toronto
  [45.5, -73.6, 5],  // Montreal

  // Africa
  [-26.2, 28.0, 6],  // Johannesburg
  [-33.9, 18.4, 5],  // Cape Town
  [15.6, 32.5, 5],   // Khartoum
  [0.3, 32.6, 4],    // Kampala
  [-1.3, 36.8, 4],   // Nairobi
  [11.1, 7.7, 4],    // Kano

  // Middle East
  [24.7, 46.7, 6],   // Riyadh
  [25.2, 55.3, 6],   // Dubai
  [35.7, 51.4, 6],   // Tehran

  // Oceania
  [-33.9, 151.2, 5], // Sydney
  [-37.8, 145.0, 4], // Melbourne
];

function latLngToXY(lat, lng) {
  return [(lng + 180) / 360 * W, (90 - lat) / 180 * H];
}

function buildTexture() {
  const offscreen = document.createElement('canvas');
  offscreen.width = W; offscreen.height = H;
  const ctx = offscreen.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  for (const [lat, lng, weight] of CENTERS) {
    const [x, y] = latLngToXY(lat, lng);
    const r = 18 + weight * 14;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const alpha = 0.08 + weight * 0.055;
    g.addColorStop(0, `rgba(255,200,80,${Math.min(alpha * 2.5, 0.95)})`);
    g.addColorStop(0.3, `rgba(255,120,20,${alpha})`);
    g.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.max(0, x - r), Math.max(0, y - r), r * 2, r * 2);
  }

  return offscreen;
}

export function createPopulationLayer(earthMesh) {
  const texCanvas = buildTexture();
  const tex       = new THREE.CanvasTexture(texCanvas);

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.005, 64, 32),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    })
  );
  mesh.visible = false;
  mesh.renderOrder = 4;
  earthMesh.add(mesh);

  return {
    setVisible(v) { mesh.visible = !!v; },
    update() {},
    dispose() { earthMesh.remove(mesh); tex.dispose(); },
  };
}
