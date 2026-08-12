/*
 * Renders the app mark to PNG at the sizes manifest.webmanifest asks for.
 *
 * Written by hand rather than pulling in a rasteriser: the mark is four rounded
 * rectangles and a ring, zlib ships with Node, and a build dependency for three
 * static files is a poor trade. Re-run with `npm run icons` if the mark changes.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BG_TOP = [0x16, 0x22, 0x26];
const BG_BOTTOM = [0x0b, 0x10, 0x13];
const CANVAS = [0x07, 0x0b, 0x0d];

// Geometry in the mark's own 64×64 space, straight from ui/Mark.tsx.
const BARS = [
  { x: 12, y: 15, w: 40, h: 8, r: 4, rgb: [0xff, 0x7a, 0x5c] },
  { x: 12, y: 28, w: 27, h: 8, r: 4, rgb: [0xf0, 0xa9, 0x3b] },
  { x: 12, y: 41, w: 16, h: 8, r: 4, rgb: [0x35, 0xd6, 0xa0] },
];
const RING = { cx: 48, cy: 45, r: 5, width: 3, rgb: [0x4f, 0xd1, 0xc5] };
const CORNER = 15;

/** Signed distance to a rounded rectangle; negative inside. */
function sdRoundRect(px, py, x, y, w, h, r) {
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  return Math.hypot(px - cx, py - cy) - r;
}

/** Coverage of a shape at a pixel, antialiased over one unit of distance. */
const cover = (d) => Math.min(1, Math.max(0, 0.5 - d));

function mix(dst, src, a) {
  for (let i = 0; i < 3; i++) dst[i] = Math.round(dst[i] * (1 - a) + src[i] * a);
}

function renderRGBA(size, padPx) {
  const scale = size / 64;
  const inner = size - padPx * 2;
  const px = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Padding is the canvas colour, so a maskable icon keeps its safe zone.
      const out = [...CANVAS];
      let alpha = 255;

      const ux = (x - padPx) / (inner / 64);
      const uy = (y - padPx) / (inner / 64);

      if (padPx === 0) {
        const bgCover = cover(sdRoundRect(ux, uy, 0, 0, 64, 64, CORNER) * scale);
        alpha = Math.round(bgCover * 255);
      }

      // Vertical gradient across the tile.
      const t = Math.min(1, Math.max(0, uy / 64));
      const bg = BG_TOP.map((c, i) => Math.round(c + (BG_BOTTOM[i] - c) * t));
      const inTile = cover(sdRoundRect(ux, uy, 0, 0, 64, 64, CORNER) * scale);
      mix(out, bg, inTile);

      for (const b of BARS) {
        mix(out, b.rgb, cover(sdRoundRect(ux, uy, b.x, b.y, b.w, b.h, b.r) * scale));
      }

      // Ring: the band between two circles.
      const d = Math.hypot(ux - RING.cx, uy - RING.cy);
      const band = Math.abs(d - RING.r) - RING.width / 2;
      mix(out, RING.rgb, cover(band * scale));

      const o = (y * size + x) * 4;
      px[o] = out[0];
      px[o + 1] = out[1];
      px[o + 2] = out[2];
      px[o + 3] = padPx === 0 ? alpha : 255;
    }
  }
  return px;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  // Each scanline is prefixed with its filter type; 0 means none.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size, pad] of [
  ['public/icon-192.png', 192, 0],
  ['public/icon-512.png', 512, 0],
  // Maskable icons are cropped to a circle by the launcher, so the mark is inset.
  ['public/icon-maskable-512.png', 512, 90],
]) {
  const png = encodePNG(size, renderRGBA(size, pad));
  writeFileSync(name, png);
  console.log(`${name}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} kB`);
}
