// Time-zone overlay — colours the globe by UTC offset, plus a world-clock DOM widget.
import * as THREE from 'three';

const W = 2048, H = 1024;

// UTC offset → hue (blue at -12, green at 0, red at +12)
function offsetHue(utcOffset) {
  const t = (utcOffset + 12) / 24; // 0..1
  if (t < 0.5) {
    // blue (240°) → green (120°)
    return 240 - t * 2 * 120;
  } else {
    // green (120°) → red (0°)
    return 120 - (t - 0.5) * 2 * 120;
  }
}

// Rough UTC offset from longitude (ignores DST / political boundaries, but looks great)
function lngToOffset(lng) {
  return Math.round(lng / 15);
}

function buildTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Draw vertical bands, one per 15° longitude column
  for (let offset = -12; offset <= 14; offset++) {
    const lngStart = offset * 15;
    const lngEnd   = lngStart + 15;
    const xStart   = Math.round((lngStart + 180) / 360 * W);
    const xEnd     = Math.round((lngEnd   + 180) / 360 * W);
    const hue      = offsetHue(offset);
    ctx.fillStyle  = `hsla(${hue}, 80%, 55%, 0.32)`;
    ctx.fillRect(xStart, 0, xEnd - xStart, H);
  }

  // Thin separator lines between zones
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth   = 1;
  for (let offset = -12; offset <= 14; offset++) {
    const lngStart = offset * 15;
    const x        = Math.round((lngStart + 180) / 360 * W);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }

  return canvas;
}

export function createTimeZoneLayer(earthMesh) {
  const texCanvas = buildTexture();
  const tex       = new THREE.CanvasTexture(texCanvas);

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.004, 64, 32),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: THREE.NormalBlending, side: THREE.FrontSide,
    })
  );
  mesh.visible = false;
  mesh.renderOrder = 3;
  earthMesh.add(mesh);

  // ── World clock DOM widget ─────────────────────────────────────────────────
  const widget = document.getElementById('world-clock');
  let clockTick = null;

  function fmtTime(date) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  function localInTZ(tz) {
    try {
      return new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch { return '—'; }
  }

  function updateClock() {
    const now = new Date();
    const localEl  = document.getElementById('wc-local');
    const utcEl    = document.getElementById('wc-utc');
    const tokyoEl  = document.getElementById('wc-tokyo');
    const nyEl     = document.getElementById('wc-newyork');
    if (localEl)  localEl.textContent  = fmtTime(now);
    if (utcEl)    utcEl.textContent    = now.toUTCString().slice(-12, -7) + ':' + String(now.getUTCSeconds()).padStart(2, '0');
    if (tokyoEl)  tokyoEl.textContent  = localInTZ('Asia/Tokyo');
    if (nyEl)     nyEl.textContent     = localInTZ('America/New_York');
  }

  return {
    setVisible(v) {
      mesh.visible = !!v;
      if (widget) widget.hidden = !v;
      if (v) {
        updateClock();
        clockTick = setInterval(updateClock, 1000);
      } else {
        clearInterval(clockTick);
      }
    },

    // Returns current local-time string for a given UTC offset (used by country tooltip)
    getLocalTime(utcOffset) {
      const now = new Date();
      const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      const local = new Date(utcMs + utcOffset * 3600000);
      return fmtTime(local);
    },

    update() {},
    dispose() { earthMesh.remove(mesh); tex.dispose(); clearInterval(clockTick); },
  };
}
