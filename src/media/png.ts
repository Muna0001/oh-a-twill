import { decode } from 'fast-png';

export interface RgbaImage {
  width: number;
  height: number;
  /** 8-bit RGBA, not premultiplied. */
  data: Uint8Array;
}

/**
 * Decodes a PNG to 8-bit RGBA. Handles everything PNG allows: greyscale,
 * RGB and palette images, with or without alpha (alpha channel or tRNS),
 * at 1, 2, 4, 8 or 16 bits per sample.
 */
export function decodePngToRgba(bytes: Uint8Array | ArrayBuffer): RgbaImage {
  const png = decode(bytes);
  const { width, height, depth, channels, data, palette, transparency } = png;
  const n = width * height;
  const out = new Uint8Array(n * 4);
  const max = (1 << depth) - 1;

  // Reads sample `c` of pixel (x, y) at the file's bit depth. Below 8 bits the
  // samples are packed, most significant bit first, and each row starts on a byte.
  const rowBytes = Math.ceil((width * channels * depth) / 8);
  const sample =
    depth >= 8
      ? (x: number, y: number, c: number) => data[(y * width + x) * channels + c]
      : (x: number, y: number, c: number) => {
          const bit = (x * channels + c) * depth;
          return (data[y * rowBytes + (bit >> 3)] >> (8 - depth - (bit & 7))) & max;
        };
  // Scales a sample to 0..255.
  const to8 = depth === 8 ? (v: number) => v : depth === 16 ? (v: number) => v >> 8 : (v: number) => Math.round((v * 255) / max);

  if (palette) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const entry = palette[sample(x, y, 0)];
        if (!entry) throw new RangeError('PNG palette index out of range');
        const o = (y * width + x) * 4;
        out[o] = entry[0];
        out[o + 1] = entry[1];
        out[o + 2] = entry[2];
        out[o + 3] = entry.length > 3 ? entry[3] : 255;
      }
    }
    return { width, height, data: out };
  }

  const color = channels >= 3;
  const hasAlpha = channels === 2 || channels === 4;
  // tRNS on a greyscale or RGB image names one fully transparent colour.
  const key = !hasAlpha && transparency && transparency.length >= (color ? 3 : 1) ? transparency : null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r = sample(x, y, 0);
      const g = color ? sample(x, y, 1) : r;
      const b = color ? sample(x, y, 2) : r;
      const o = (y * width + x) * 4;
      out[o] = to8(r);
      out[o + 1] = to8(g);
      out[o + 2] = to8(b);
      if (hasAlpha) out[o + 3] = to8(sample(x, y, channels - 1));
      else if (key && r === key[0] && (!color || (g === key[1] && b === key[2]))) out[o + 3] = 0;
      else out[o + 3] = 255;
    }
  }
  return { width, height, data: out };
}
