import { boxAverage } from '@/engine/picture';

import { decodePngToRgba } from './png';
import { base64ToBytes } from './shared';
import { PNGS } from './testPngs';

const rgba = (name: keyof typeof PNGS) => {
  const png = decodePngToRgba(base64ToBytes(PNGS[name]));
  return { size: [png.width, png.height], data: Array.from(png.data) };
};

describe('decodePngToRgba', () => {
  it('decodes 8-bit RGBA and keeps the alpha', () => {
    expect(rgba('rgba8')).toEqual({
      size: [2, 2],
      data: [255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 255, 255, 255, 255],
    });
  });

  it('adds opaque alpha to RGB', () => {
    expect(rgba('rgb8')).toEqual({ size: [2, 1], data: [10, 20, 30, 255, 200, 100, 50, 255] });
  });

  it('expands a packed 2-bit palette with a transparent entry', () => {
    const red = [255, 0, 0, 255];
    const blue = [0, 0, 255, 255];
    const clearGreen = [0, 255, 0, 0];
    const dark = [9, 9, 9, 255];
    expect(rgba('palette')).toEqual({ size: [3, 2], data: [...red, ...blue, ...clearGreen, ...dark, ...clearGreen, ...red] });
  });

  it('reduces 16-bit samples to 8 bits', () => {
    expect(rgba('gray16')).toEqual({ size: [2, 1], data: [255, 255, 255, 255, 128, 128, 128, 255] });
    expect(rgba('rgba16')).toEqual({ size: [1, 1], data: [255, 128, 0, 127] });
  });

  it('unpacks 1-bit greyscale rows that end mid-byte', () => {
    const { size, data } = rgba('gray1');
    expect(size).toEqual([10, 2]);
    const bits = [];
    for (let i = 0; i < 20; i++) {
      expect(data.slice(i * 4, i * 4 + 4)).toEqual(data[i * 4] ? [255, 255, 255, 255] : [0, 0, 0, 255]);
      bits.push(data[i * 4] ? 1 : 0);
    }
    expect(bits.join('')).toBe('10101010110000000001');
  });

  it('decodes grey with alpha', () => {
    expect(rgba('grayAlpha')).toEqual({ size: [2, 1], data: [100, 100, 100, 255, 50, 50, 50, 0] });
  });

  it('applies a tRNS colour key on RGB', () => {
    expect(rgba('rgbKey')).toEqual({ size: [2, 2], data: [1, 2, 3, 0, 40, 50, 60, 255, 1, 2, 4, 255, 1, 2, 3, 0] });
  });

  it('throws on bytes that are not a PNG', () => {
    expect(() => decodePngToRgba(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow();
  });

  it('flattens transparency onto white when averaged', () => {
    const png = decodePngToRgba(base64ToBytes(PNGS.rgba8));
    // One pixel per source pixel: transparent blue becomes white, half green becomes pale green.
    const px = Array.from(boxAverage(png.data, 2, 2, 1));
    expect(px.slice(0, 3)).toEqual([255, 0, 0]);
    expect(px[3]).toBeCloseTo(255 - 128, 5);
    expect(px[4]).toBeCloseTo(255, 5);
    expect(px[5]).toBeCloseTo(255 - 128, 5);
    expect(px.slice(6, 9)).toEqual([255, 255, 255]);
    expect(px.slice(9, 12)).toEqual([255, 255, 255]);
    // All four averaged into one square.
    const one = Array.from(boxAverage(png.data, 2, 2, 2));
    expect(one[0]).toBeCloseTo((255 + 127 + 255 + 255) / 4, 4);
    expect(one[1]).toBeCloseTo((0 + 255 + 255 + 255) / 4, 4);
    expect(one[2]).toBeCloseTo((0 + 127 + 255 + 255) / 4, 4);
  });
});
