// Postcard generator — renders a 2160×2160 canvas postcard from a pin and shows a preview modal.

const CANVAS_SIZE = 2160; // rendered at 2x, displayed at 1080

// Default trip-colour → gradient map
const GRADIENT_PRESETS = {
  '#e74c3c': ['#1a0008', '#3d0020', '#e74c3c', '#ff9f43'],
  '#e67e22': ['#1a0800', '#3d1800', '#e67e22', '#f9ca24'],
  '#f1c40f': ['#1a1400', '#3d3000', '#c0922a', '#f9ca24'],
  '#2ecc71': ['#001a0c', '#003d1a', '#2ecc71', '#00d2d3'],
  '#1abc9c': ['#001a16', '#003d30', '#1abc9c', '#48dbfb'],
  '#3498db': ['#00061a', '#001040', '#3498db', '#a29bfe'],
  '#9b59b6': ['#0d0018', '#1e0038', '#9b59b6', '#fd79a8'],
  '#e91e63': ['#1a0010', '#3d0028', '#e91e63', '#fd79a8'],
};
const DEFAULT_GRADIENT = ['#060018', '#0d0040', '#1a0060', '#3d1a8c'];

function tripGradient(tripColor) {
  return GRADIENT_PRESETS[tripColor] || DEFAULT_GRADIENT;
}

function fmtCoords(lat, lng) {
  const ns = lat >= 0 ? 'N' : 'S', ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns}  ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Draw scattered star dots
function drawStars(ctx, w, h, seed) {
  const rng = (() => { let s = seed; return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; }; })();
  ctx.save();
  for (let i = 0; i < 80; i++) {
    const x = rng() * w, y = rng() * h * 0.68;
    const r = rng() * 1.8 + 0.4;
    const a = rng() * 0.5 + 0.1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fill();
  }
  ctx.restore();
}

// Draw a simple wire-globe watermark
function drawGlobeWatermark(ctx, cx, cy, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = r * 0.045;

  // Outer circle
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

  // Latitude lines
  for (const f of [-0.55, -0.28, 0, 0.28, 0.55]) {
    const ly = cy + f * r;
    const lrx = r * Math.sqrt(Math.max(0, 1 - f*f));
    ctx.beginPath();
    ctx.ellipse(cx, ly, lrx, lrx * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Longitude arcs
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.5, r, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();

  ctx.restore();
}

export function generatePostcard(pin, trip) {
  const S = CANVAS_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');

  const colors = tripGradient(trip?.color || null);

  // ── Background gradient ──────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, S * 0.6, S);
  bg.addColorStop(0,    colors[0]);
  bg.addColorStop(0.35, colors[1]);
  bg.addColorStop(0.72, colors[2] + 'cc');
  bg.addColorStop(1,    colors[3] + '99');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // Diagonal accent sweep
  const sweep = ctx.createLinearGradient(S, 0, 0, S);
  sweep.addColorStop(0, 'rgba(255,255,255,0.04)');
  sweep.addColorStop(0.5, 'rgba(255,255,255,0)');
  sweep.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, S, S);

  drawStars(ctx, S, S, 42);

  const PHOTO_H = S * 0.60;

  // ── Photo or abstract placeholder ───────────────────────────────────────────
  if (pin.photoBase64) {
    const img = new Image();
    img.src = pin.photoBase64;

    // Draw synchronously (image is already in memory as base64)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, S, PHOTO_H + 40);
    ctx.clip();
    ctx.drawImage(img, 0, 0, S, PHOTO_H + 80);
    ctx.restore();

    // Vignette at photo bottom
    const vig = ctx.createLinearGradient(0, PHOTO_H - S * 0.22, 0, PHOTO_H + 60);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, colors[0] + 'ff');
    ctx.fillStyle = vig;
    ctx.fillRect(0, PHOTO_H - S * 0.22, S, S * 0.22 + 60);
  } else {
    // Abstract globe watermark in photo area
    ctx.save();
    ctx.globalAlpha = 0.12;
    const radGrad = ctx.createRadialGradient(S*0.5, PHOTO_H*0.45, 0, S*0.5, PHOTO_H*0.45, S*0.42);
    radGrad.addColorStop(0, '#ffffff');
    radGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, S, PHOTO_H);
    ctx.restore();

    drawGlobeWatermark(ctx, S * 0.5, PHOTO_H * 0.44, S * 0.22, 0.14);
  }

  // ── Bottom glassmorphism panel ───────────────────────────────────────────────
  const PANEL_Y = PHOTO_H - 20;
  const PANEL_H = S - PANEL_Y;
  const CORNER  = 60;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(CORNER, PANEL_Y);
  ctx.lineTo(S - CORNER, PANEL_Y);
  ctx.quadraticCurveTo(S, PANEL_Y, S, PANEL_Y + CORNER);
  ctx.lineTo(S, S);
  ctx.lineTo(0, S);
  ctx.lineTo(0, PANEL_Y + CORNER);
  ctx.quadraticCurveTo(0, PANEL_Y, CORNER, PANEL_Y);
  ctx.closePath();

  // Panel fill (approximation of glassmorphism)
  const panelBg = ctx.createLinearGradient(0, PANEL_Y, 0, S);
  panelBg.addColorStop(0, 'rgba(8,4,20,0.88)');
  panelBg.addColorStop(1, 'rgba(4,2,12,0.95)');
  ctx.fillStyle = panelBg;
  ctx.fill();

  // Top border shimmer
  ctx.beginPath();
  ctx.moveTo(CORNER, PANEL_Y + 1.5);
  ctx.lineTo(S - CORNER, PANEL_Y + 1.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // ── Text ─────────────────────────────────────────────────────────────────────
  const PAD = S * 0.072;
  let textY = PANEL_Y + S * 0.062;

  // Place name — bold, large
  ctx.font = `700 ${S * 0.072}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 20;
  // Truncate if too long
  let name = pin.name || 'Unnamed Place';
  while (ctx.measureText(name).width > S - PAD * 2 && name.length > 4) {
    name = name.slice(0, -2) + '…';
  }
  ctx.fillText(name, PAD, textY);
  ctx.shadowBlur = 0;
  textY += S * 0.086;

  // Coordinates — monospace
  ctx.font = `400 ${S * 0.032}px "Courier New", Courier, monospace`;
  ctx.fillStyle = 'rgba(180,200,255,0.7)';
  ctx.fillText(fmtCoords(pin.lat, pin.lng), PAD, textY);
  textY += S * 0.052;

  // Note — italic
  if (pin.note) {
    ctx.font = `italic 400 ${S * 0.038}px Georgia, "Times New Roman", serif`;
    ctx.fillStyle = 'rgba(233,238,252,0.78)';
    const words = pin.note.split(' ');
    const maxW = S - PAD * 2;
    let line = '';
    let lines = [];
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line); line = word;
        if (lines.length >= 2) break; // max 2 lines
      } else line = test;
    }
    if (lines.length < 2 && line) lines.push(line);
    for (const l of lines) {
      ctx.fillText('“' + (l === lines[0] ? '' : '') + l + (l === lines[lines.length-1] ? '”' : ''), PAD, textY);
      textY += S * 0.052;
    }
  }

  // ── Bottom branding row ───────────────────────────────────────────────────────
  const BRAND_Y = S - S * 0.065;

  // Globe icon (small)
  drawGlobeWatermark(ctx, PAD + S * 0.032, BRAND_Y, S * 0.032, 0.7);

  // "wanderglobe.app" text
  ctx.font = `600 ${S * 0.034}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = 'rgba(180,200,255,0.55)';
  ctx.fillText('wanderglobe.app', PAD + S * 0.075, BRAND_Y + S * 0.013);

  // Date & trip on the right
  if (pin.dateAdded || trip) {
    const rightText = [fmtDate(pin.dateAdded), trip ? `${trip.emoji || ''} ${trip.name}`.trim() : ''].filter(Boolean).join('  ·  ');
    ctx.font = `400 ${S * 0.028}px "Courier New", Courier, monospace`;
    ctx.fillStyle = 'rgba(180,200,255,0.4)';
    const tw = ctx.measureText(rightText).width;
    ctx.fillText(rightText, S - PAD - tw, BRAND_Y + S * 0.013);
  }

  return canvas;
}

// ── Modal preview ─────────────────────────────────────────────────────────────

export function showPostcardModal(pin, trip) {
  // Lazily draw the card — if photo is base64, Image() is sync
  const canvas = generatePostcard(pin, trip);

  const modal = document.getElementById('postcard-modal');
  const preview = document.getElementById('postcard-preview');
  const dlBtn = document.getElementById('postcard-download');
  const cpBtn = document.getElementById('postcard-copy');
  const shBtn = document.getElementById('postcard-share');
  const closeBtn = document.getElementById('postcard-close');

  // Scale to 1080 display
  preview.width  = 1080;
  preview.height = 1080;
  const dCtx = preview.getContext('2d');
  dCtx.drawImage(canvas, 0, 0, 1080, 1080);

  const slug = (pin.name || 'place').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  dlBtn.onclick = () => {
    const a = document.createElement('a');
    a.download = `wanderglobe-${slug}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  cpBtn.onclick = async () => {
    try {
      canvas.toBlob(async (blob) => {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        cpBtn.textContent = 'Copied!';
        setTimeout(() => { cpBtn.textContent = 'Copy'; }, 2000);
      }, 'image/png');
    } catch {
      cpBtn.textContent = 'Copy failed';
      setTimeout(() => { cpBtn.textContent = 'Copy'; }, 2000);
    }
  };

  if (navigator.share && navigator.canShare) {
    shBtn.style.display = '';
    shBtn.onclick = () => {
      canvas.toBlob(async (blob) => {
        const file = new File([blob], `wanderglobe-${slug}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Wanderglobe — ${pin.name}` });
        }
      }, 'image/png');
    };
  } else {
    shBtn.style.display = 'none';
  }

  closeBtn.onclick = () => modal.classList.remove('open');
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); }, { once: true });

  modal.classList.add('open');
}
