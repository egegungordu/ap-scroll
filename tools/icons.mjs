// Generate PWA icons without any dependency: draws a card-deck glyph and encodes PNG by hand.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const root = path.resolve(import.meta.dirname, '..');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
// signed distance for rounded rect
const sdRR = (px, py, cx, cy, hw, hh, r) => { const dx = Math.abs(px - cx) - hw + r, dy = Math.abs(py - cy) - hh + r; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r; };
const cov = (d) => Math.min(1, Math.max(0, 0.5 - d)); // anti-alias coverage

function draw(size, { maskable }) {
  const img = Buffer.alloc(size * size * 4);
  const S = size, pad = maskable ? 0 : S * 0.0; // full-bleed background in both; iOS masks itself
  const bgR = maskable ? 0 : S * 0.22;
  const c1 = hex('#0b0f1c'), c2 = hex('#1a2246');
  const layers = [ // card deck: three cards with rotation offset
    { col: hex('#f472b6'), dx: 0.10, dy: -0.11, rot: 0.26 },
    { col: hex('#f4b942'), dx: 0.05, dy: -0.03, rot: 0.13 },
    { col: hex('#4cc9f0'), dx: 0.00, dy: 0.06, rot: 0.0 },
  ];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    // background gradient
    const t = (x + y) / (2 * S);
    let r = c1[0] + (c2[0] - c1[0]) * t, g = c1[1] + (c2[1] - c1[1]) * t, b = c1[2] + (c2[2] - c1[2]) * t;
    const bgA = maskable ? 1 : cov(sdRR(x + .5, y + .5, S / 2, S / 2, S / 2 - pad, S / 2 - pad, bgR));
    // cards
    const px = x + .5, py = y + .5;
    for (const L of layers) {
      const cx = S * (0.5 + L.dx), cy = S * (0.55 + L.dy);
      const ca = Math.cos(-L.rot), sa = Math.sin(-L.rot);
      const rx = ca * (px - cx) - sa * (py - cy) + cx, ry = sa * (px - cx) + ca * (py - cy) + cy;
      const a = cov(sdRR(rx, ry, cx, cy, S * 0.27, S * 0.19, S * 0.06));
      if (a > 0) { r = r + (L.col[0] - r) * a; g = g + (L.col[1] - g) * a; b = b + (L.col[2] - b) * a; }
    }
    // glyph on front card: three "text lines" + an up-chevron in dark
    const fx = S * 0.5, fy = S * 0.61; const dark = hex('#0b0f1c');
    const lines = [[fx - S * 0.17, fy - S * 0.09, S * 0.14, S * 0.018], [fx - S * 0.17, fy - S * 0.03, S * 0.10, S * 0.018], [fx - S * 0.17, fy + S * 0.03, S * 0.12, S * 0.018]];
    for (const [lx, ly, hw, hh] of lines) { const a = cov(sdRR(px, py, lx + hw, ly, hw, hh, hh)) * 0.85; if (a > 0) { r += (dark[0] - r) * a; g += (dark[1] - g) * a; b += (dark[2] - b) * a; } }
    // chevron (up arrow) at right of front card
    const ax = fx + S * 0.14, ay = fy - S * 0.01; const d = Math.abs(Math.abs(px - ax) - (py - ay) * 0.95);
    const inChev = (py - ay) > -S * 0.07 && (py - ay) < S * 0.08 && Math.abs(px - ax) < S * 0.075;
    const a2 = inChev ? cov(d - S * 0.016) : 0; if (a2 > 0) { r += (dark[0] - r) * a2; g += (dark[1] - g) * a2; b += (dark[2] - b) * a2; }
    img[i] = r; img[i + 1] = g; img[i + 2] = b; img[i + 3] = Math.round(255 * bgA);
  }
  return png(S, S, img);
}
fs.mkdirSync(path.join(root, 'icons'), { recursive: true });
fs.writeFileSync(path.join(root, 'icons/icon-192.png'), draw(192, { maskable: true }));
fs.writeFileSync(path.join(root, 'icons/icon-512.png'), draw(512, { maskable: true }));
fs.writeFileSync(path.join(root, 'icons/apple-touch-icon.png'), draw(180, { maskable: true }));
console.log('icons written');
