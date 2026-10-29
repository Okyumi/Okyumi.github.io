// Pixel art for the game touches, drawn as text so it stays easy to edit.
// Each character is one pixel: "." is transparent, other characters map to the palette below.
import zlib from 'node:zlib';

const palette = {
  o: '#20201e', // ink outline
  w: '#ffffff', // glove / highlight
  g: '#c9cfe4', // glove shade
  b: '#284ed1', // blue
  d: '#19399f', // dark blue
  l: '#8ea4ef'  // light blue
};

// The RPG menu pointer: a white glove pointing right, with a blue cuff.
export const hand = [
  '......oooo..........',
  '.....owwwwo.........',
  '.oo.owwwwwwooooooo..',
  'obbowwwwwwwwwwwwwwwo',
  'obbowwwwwwwwgggggggo',
  'obbowwwwwwwoooooooo.',
  'obbowwwwwwwwwwwo....',
  'obbowwwwwwwggggo....',
  'obbowwwwwwoooooo....',
  'obbowwwwwwwwwwo.....',
  'obbogwwwwwgggo......',
  '.oo.ogggggooo.......',
  '.....ooooo..........'
];

// The mouse cursor on game screens: a pixel arrow, blue with an ink outline. Hotspot at the tip (0, 0).
export const arrow = [
  'o..........',
  'oo.........',
  'olo........',
  'olbo.......',
  'olbbo......',
  'olbbbo.....',
  'olbbbbo....',
  'olbbbbbo...',
  'olbbbbbbo..',
  'olbbbbbbbo.',
  'olbbbooooo.',
  'olbobbo....',
  'oloobbo....',
  'oo..obbo...',
  '....obbo...',
  '.....oo....'
];

// A pixel arrow pointing down: over the words on the Personal page, and turned sideways on the arena toggles.
export const pointDown = [
  'ooooooooooo',
  'ollllllllbo',
  '.obbbbbbbo.',
  '..obbbbbo..',
  '...obbbo...',
  '....obo....',
  '.....o.....'
];

const rows = sprite => sprite.map(row => row.padEnd(Math.max(...sprite.map(r => r.length)), '.'));
const size = sprite => ({width: Math.max(...sprite.map(r => r.length)), height: sprite.length});

// Inline SVG, one <rect> per horizontal run of the same colour.
export function toSVG(sprite, {scale = 2, className = '', label = ''} = {}) {
  const {width, height} = size(sprite);
  const rects = [];
  rows(sprite).forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const c = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === c) end++;
      if (c !== '.') rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${palette[c]}"/>`);
      x = end;
    }
  });
  const a11y = label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true" focusable="false"';
  return `<svg xmlns="http://www.w3.org/2000/svg"${className ? ` class="${className}"` : ''} viewBox="0 0 ${width} ${height}" width="${width * scale}" height="${height * scale}" shape-rendering="crispEdges"${a11y}>${rects.join('')}</svg>`;
}

// Minimal PNG encoder (RGBA, no dependencies), for cursor images.
const crcTable = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
export function toPNG(sprite, scale = 2) {
  const {width, height} = size(sprite);
  const w = width * scale, h = height * scale;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  const grid = rows(sprite);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const c = grid[Math.floor(y / scale)][Math.floor(x / scale)];
      if (c === '.') continue;
      const hex = palette[c];
      const i = y * (w * 4 + 1) + 1 + x * 4;
      raw[i] = parseInt(hex.slice(1, 3), 16);
      raw[i + 1] = parseInt(hex.slice(3, 5), 16);
      raw[i + 2] = parseInt(hex.slice(5, 7), 16);
      raw[i + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8; header[9] = 6; header[10] = 0; header[11] = 0; header[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
