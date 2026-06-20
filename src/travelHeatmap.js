// Personal travel heatmap — warm gold glow based on the user's visited pins.
import * as THREE from 'three';

const W = 2048, H = 1024;
const AUTO_ON_THRESHOLD = 3;

function latLngToXY(lat, lng) {
  return [(lng + 180) / 360 * W, (90 - lat) / 180 * H];
}

function buildTexture(pins) {
  const offscreen = document.createElement('canvas');
  offscreen.width = W; offscreen.height = H;
  const ctx = offscreen.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  if (!pins.length) return offscreen;

  // Count pins by rough region to determine intensity
  const visited = pins.filter((p) => p.type === 'visited');
  const CLUSTER_DEG = 12; // group within ~12° radius
  const clusters = [];

  for (const pin of visited) {
    let added = false;
    for (const cl of clusters) {
      const dlat = cl.lat - pin.lat, dlng = cl.lng - pin.lng;
      if (Math.sqrt(dlat * dlat + dlng * dlng) < CLUSTER_DEG) {
        cl.count++;
        cl.lat = (cl.lat + pin.lat) / 2;
        cl.lng = (cl.lng + pin.lng) / 2;
        added = true; break;
      }
    }
    if (!added) clusters.push({ lat: pin.lat, lng: pin.lng, count: 1 });
  }

  for (const cl of clusters) {
    const [x, y] = latLngToXY(cl.lat, cl.lng);
    const intensity = Math.min(cl.count / 5, 1);
    const r = 20 + intensity * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const alpha = 0.12 + intensity * 0.45;
    g.addColorStop(0, `rgba(255,215,0,${Math.min(alpha * 2, 0.9)})`);
    g.addColorStop(0.35, `rgba(255,165,0,${alpha})`);
    g.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.max(0, x - r - 5), Math.max(0, y - r - 5), (r + 5) * 2, (r + 5) * 2);
  }

  return offscreen;
}

export function createTravelHeatmap(earthMesh, { getPins }) {
  let tex = new THREE.CanvasTexture(document.createElement('canvas'));

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.006, 64, 32),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    })
  );
  mesh.visible = false;
  mesh.renderOrder = 5;
  earthMesh.add(mesh);

  let manuallyToggled = false;

  function rebuild() {
    const pins = getPins();
    const visited = pins.filter((p) => p.type === 'visited');

    const newCanvas = buildTexture(pins);
    const newTex    = new THREE.CanvasTexture(newCanvas);
    mesh.material.map = newTex;
    mesh.material.needsUpdate = true;
    tex.dispose();
    tex = newTex;

    // Auto-on when threshold reached (and user hasn't manually toggled)
    if (!manuallyToggled && visited.length >= AUTO_ON_THRESHOLD) {
      if (!mesh.visible) {
        mesh.visible = true;
        // signal main.js to update the switch UI
        document.dispatchEvent(new CustomEvent('heatmap-auto-on'));
      }
    }
  }

  return {
    setVisible(v, manual = false) {
      if (manual) manuallyToggled = true;
      mesh.visible = !!v;
    },
    isVisible: () => mesh.visible,
    rebuild,
    update() {},
    dispose() { earthMesh.remove(mesh); tex.dispose(); },
  };
}
