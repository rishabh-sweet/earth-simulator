#!/usr/bin/env node
// Generates public/icons/icon-192.png and icon-512.png using pure Node.js + zlib.
import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function drawIcon(size) {
  const w = size, h = size;
  // RGBA pixel buffer
  const px = new Uint8Array(w * h * 4);

  // Background: deep purple #0a0015
  for (let i = 0; i < w * h; i++) {
    px[i*4]   = 10;
    px[i*4+1] = 0;
    px[i*4+2] = 21;
    px[i*4+3] = 255;
  }

  const cx = w / 2, cy = h / 2;
  const R  = w * 0.37;

  // Soft additive blend onto RGBA buffer
  function paint(x, y, r, g, b, alpha) {
    const xi = x | 0, yi = y | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = xi + dx, ny = yi + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const d = Math.sqrt(dx*dx + dy*dy);
        const w2 = Math.max(0, 1 - d) * (alpha / 255);
        const i2 = (ny * w + nx) * 4;
        px[i2]   = Math.min(255, px[i2]   + r * w2);
        px[i2+1] = Math.min(255, px[i2+1] + g * w2);
        px[i2+2] = Math.min(255, px[i2+2] + b * w2);
      }
    }
  }

  // Draw an ellipse (cx, cy, rx, ry) clipped to the globe circle
  function ellipse(ex, ey, rx, ry, r, g, b, a) {
    const steps = Math.ceil(Math.max(rx, ry) * 2 * Math.PI * 2);
    for (let i = 0; i <= steps; i++) {
      const t  = (i / steps) * 2 * Math.PI;
      const px2 = ex + rx * Math.cos(t);
      const py2 = ey + ry * Math.sin(t);
      const dx2 = px2 - cx, dy2 = py2 - cy;
      if (dx2*dx2 + dy2*dy2 <= R*R + 2) paint(px2, py2, r, g, b, a);
    }
  }

  // Globe outline (solid ring)
  ellipse(cx, cy, R, R, 110, 179, 255, 230);

  // Latitude rings
  for (const f of [-0.55, -0.28, 0, 0.28, 0.55]) {
    const latY  = cy + f * R;
    const latRx = R * Math.sqrt(Math.max(0, 1 - f*f));
    if (latRx < 2) continue;
    ellipse(cx, latY, latRx, latRx * 0.18, 110, 179, 255, 150);
  }

  // Longitude arcs (3 vertical ellipses)
  for (const f of [-0.5, 0, 0.5]) {
    const rx = R * Math.abs(f) + (f === 0 ? 0.01 : 0);
    ellipse(cx + (f === 0 ? 0 : cx * 0), cy, f === 0 ? 0.01 : R * Math.abs(f), R, 110, 179, 255, 140);
  }
  // Vertical centre line
  ellipse(cx, cy, 0.5, R, 110, 179, 255, 160);

  // Subtle glow in centre
  for (let y = 0; y < h; y++) {
    for (let x2 = 0; x2 < w; x2++) {
      const dx2 = x2 - cx, dy2 = y - cy;
      const dist = Math.sqrt(dx2*dx2 + dy2*dy2);
      if (dist < R * 0.6) {
        const glow = (1 - dist / (R * 0.6)) * 12;
        const i2 = (y * w + x2) * 4;
        px[i2]   = Math.min(255, px[i2]   + glow * 0.4);
        px[i2+1] = Math.min(255, px[i2+1] + glow * 0.2);
        px[i2+2] = Math.min(255, px[i2+2] + glow * 0.8);
      }
    }
  }

  // Convert RGBA → RGB for PNG
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    rgb[i*3]   = px[i*4];
    rgb[i*3+1] = px[i*4+1];
    rgb[i*3+2] = px[i*4+2];
  }
  return rgb;
}

// CRC32 table
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const tb = Buffer.from(type);
  const lb = Buffer.allocUnsafe(4); lb.writeUInt32BE(data.length, 0);
  const cb = Buffer.allocUnsafe(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([lb, tb, data, cb]);
}

function makePNG(size) {
  const rgb = drawIcon(size);
  const w = size, h = size;

  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw scanlines: 1 filter byte + w*3 RGB bytes per row
  const raw = Buffer.allocUnsafe(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w*3)] = 0; // None filter
    for (let x = 0; x < w; x++) {
      const so = (y * w + x) * 3;
      const do2 = y * (1 + w*3) + 1 + x * 3;
      raw[do2] = rgb[so]; raw[do2+1] = rgb[so+1]; raw[do2+2] = rgb[so+2];
    }
  }

  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const idat = deflateSync(raw, { level: 6 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(join(__dirname, '../public/icons'), { recursive: true });
writeFileSync(join(__dirname, '../public/icons/icon-192.png'), makePNG(192));
console.log('✓ icon-192.png');
writeFileSync(join(__dirname, '../public/icons/icon-512.png'), makePNG(512));
console.log('✓ icon-512.png');
