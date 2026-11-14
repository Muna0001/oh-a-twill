import type { PictureGrid } from '../types';
import { autoRows, boxAverage, picOver, picRowInfo } from './index';

const pattern = (weave: 'twill22' | 'plain', r: number, n: number): string =>
  Array.from({ length: n }, (_, x) => (picOver(weave, x, r) ? '#' : '.')).join('');

describe('picOver', () => {
  test('2/2 twill keeps the fixed row order and repeats every 4 rows and warps', () => {
    expect([1, 2, 3, 4].map((r) => pattern('twill22', r, 4))).toEqual(['##..', '#..#', '..##', '.##.']);
    expect(pattern('twill22', 5, 8)).toBe('##..##..');
    expect(pattern('twill22', 6, 8)).toBe('#..##..#');
    expect(pattern('twill22', 400, 6)).toBe('.##..#');
  });

  test('plain weave alternates, starting over on row 1', () => {
    expect(pattern('plain', 1, 6)).toBe('#.#.#.');
    expect(pattern('plain', 2, 6)).toBe('.#.#.#');
    expect(pattern('plain', 3, 6)).toBe('#.#.#.');
  });
});

describe('picRowInfo', () => {
  const palette = ['#ffffff', '#ff0000', '#00ff00'].map((hex, i) => ({ rgb: [0, 0, 0] as [number, number, number], hex, name: `C${i}`, count: 0 }));
  // y = 0 is the TOP of the picture; row 1 is the bottom line.
  // prettier-ignore
  const pic: PictureGrid = { W: 8, H: 4, palette, grid: Uint8Array.from([
    2, 2, 2, 2, 2, 2, 2, 2,   // row 4
    0, 1, 1, 1, 1, 1, 2, 0,   // row 3
    0, 1, 1, 1, 1, 1, 2, 0,   // row 2
    0, 0, 0, 1, 1, 2, 2, 2,   // row 1
  ]) };

  test('row 1 is the bottom row of the grid', () => {
    const info = picRowInfo(pic, 'twill22', 1);
    expect(info.row).toBe(1);
    expect(info.cells).toEqual([0, 0, 0, 1, 1, 2, 2, 2]);
    expect(picRowInfo(pic, 'twill22', 4).cells).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
  });

  test('sections run left to right with 1-based warps and how each one starts (twill)', () => {
    // Row 1 twill: ##..##..
    const info = picRowInfo(pic, 'twill22', 1);
    expect(info.over).toEqual([true, true, false, false, true, true, false, false]);
    expect(info.sections).toEqual([
      { color: 0, n: 3, from: 1, to: 3, startOver: true, startN: 2 },
      { color: 1, n: 2, from: 4, to: 5, startOver: false, startN: 1 },
      { color: 2, n: 3, from: 6, to: 8, startOver: true, startN: 1 },
    ]);
  });

  test('sections do not flip on even rows, and a start run stops at the section end', () => {
    // Row 2 twill: #..##..#
    const info = picRowInfo(pic, 'twill22', 2);
    expect(info.cells).toEqual([0, 1, 1, 1, 1, 1, 2, 0]);
    expect(info.sections).toEqual([
      { color: 0, n: 1, from: 1, to: 1, startOver: true, startN: 1 },
      { color: 1, n: 5, from: 2, to: 6, startOver: false, startN: 2 },
      { color: 2, n: 1, from: 7, to: 7, startOver: false, startN: 1 },
      { color: 0, n: 1, from: 8, to: 8, startOver: true, startN: 1 },
    ]);
  });

  test('one section across the whole row', () => {
    // Row 4 twill: .##..##.
    expect(picRowInfo(pic, 'twill22', 4).sections).toEqual([{ color: 2, n: 8, from: 1, to: 8, startOver: false, startN: 1 }]);
  });

  test('plain weave: every section starts with a run of 1', () => {
    const info = picRowInfo(pic, 'plain', 1);
    expect(info.over).toEqual([true, false, true, false, true, false, true, false]);
    expect(info.sections.map((s) => [s.startOver, s.startN])).toEqual([
      [true, 1],
      [false, 1],
      [false, 1],
    ]);
    expect(picRowInfo(pic, 'plain', 2).sections.map((s) => [s.startOver, s.startN])).toEqual([
      [false, 1],
      [true, 1],
      [false, 1],
      [true, 1],
    ]);
  });

  test('sameAsPrevious: false on row 1, true only when the colours repeat', () => {
    expect([1, 2, 3, 4].map((r) => picRowInfo(pic, 'twill22', r).sameAsPrevious)).toEqual([false, false, true, false]);
    const flat: PictureGrid = { W: 4, H: 4, palette, grid: new Uint8Array(16) };
    expect([1, 2, 3, 4].map((r) => picRowInfo(flat, 'plain', r).sameAsPrevious)).toEqual([false, true, true, true]);
  });

  test('throws outside 1..H: row H + 1 means finished and callers check first', () => {
    expect(() => picRowInfo(pic, 'twill22', 5)).toThrow(RangeError);
    expect(() => picRowInfo(pic, 'twill22', 0)).toThrow(RangeError);
    expect(() => picRowInfo(pic, 'twill22', 1.5)).toThrow(RangeError);
    expect(() => picRowInfo(pic, 'twill22', 4)).not.toThrow();
  });
});

describe('autoRows', () => {
  test('keeps the picture shape, rounded', () => {
    expect(autoRows(24, 100, 100)).toBe(24);
    expect(autoRows(24, 300, 400)).toBe(32);
    expect(autoRows(24, 640, 827)).toBe(31);
    expect(autoRows(120, 3, 4)).toBe(160);
    expect(autoRows(5, 2, 1)).toBe(4); // 2.5 rounds up to 3, then the floor of 4 applies
    expect(autoRows(25, 10, 3)).toBe(8); // 7.5 rounds up
  });

  test('never fewer than 4 rows', () => {
    expect(autoRows(24, 1000, 10)).toBe(4);
    expect(autoRows(4, 100, 100)).toBe(4);
  });
});

describe('boxAverage', () => {
  const rgba = (...pixels: [number, number, number, number][]): Uint8Array => Uint8Array.from(pixels.flat());

  test('averages factor x factor blocks of opaque pixels', () => {
    // 4 x 2 source, factor 2 -> 2 x 1.
    const src = rgba(
      [10, 20, 30, 255], [20, 30, 40, 255], [0, 0, 0, 255], [255, 255, 255, 255],
      [30, 40, 50, 255], [41, 51, 61, 255], [0, 0, 0, 255], [0, 0, 1, 255],
    );
    const out = boxAverage(src, 4, 2, 2);
    expect(out).toBeInstanceOf(Float32Array);
    expect(Array.from(out)).toEqual([25.25, 35.25, 45.25, 63.75, 63.75, 64]);
  });

  test('matches the reference sum / 16 exactly for opaque pixels at factor 4', () => {
    let s = 99;
    const rnd = (): number => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) >>> 24;
    const W = 3;
    const H = 2;
    const f = 4;
    const src = new Uint8Array(W * f * H * f * 4);
    for (let i = 0; i < src.length; i++) src[i] = i % 4 === 3 ? 255 : rnd();
    const want = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        for (let ch = 0; ch < 3; ch++) {
          let sum = 0;
          for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) sum += src[((y * f + dy) * W * f + x * f + dx) * 4 + ch];
          want[(y * W + x) * 3 + ch] = sum / 16;
        }
      }
    }
    expect(boxAverage(src, W * f, H * f, f)).toStrictEqual(want);
  });

  test('a transparent pixel becomes white, whatever colour is stored under it', () => {
    expect(Array.from(boxAverage(rgba([0, 0, 0, 0]), 1, 1, 1))).toEqual([255, 255, 255]);
    expect(Array.from(boxAverage(rgba([200, 10, 90, 0]), 1, 1, 1))).toEqual([255, 255, 255]);
  });

  test('half alpha blends half way to white', () => {
    const out = boxAverage(rgba([0, 255, 100, 128]), 1, 1, 1);
    expect(out[0]).toBeCloseTo(255 * (1 - 128 / 255), 4); // 127
    expect(out[1]).toBe(255);
    expect(out[2]).toBeCloseTo(100 * (128 / 255) + 255 * (1 - 128 / 255), 4);
  });

  test('mixes transparent and opaque pixels inside one block', () => {
    // Black, transparent, black, transparent -> half way between black and white.
    const out = boxAverage(rgba([0, 0, 0, 255], [9, 9, 9, 0], [0, 0, 0, 255], [9, 9, 9, 0]), 2, 2, 2);
    expect(Array.from(out)).toEqual([127.5, 127.5, 127.5]);
  });

  test('ignores a partial block at the right and bottom edges', () => {
    const src = new Uint8Array(5 * 3 * 4).fill(255);
    expect(boxAverage(src, 5, 3, 2)).toHaveLength(2 * 1 * 3);
  });

  test('accepts canvas-style Uint8ClampedArray data and rejects a short buffer', () => {
    expect(Array.from(boxAverage(new Uint8ClampedArray([1, 2, 3, 255]), 1, 1, 1))).toEqual([1, 2, 3]);
    expect(() => boxAverage(new Uint8Array(8), 2, 2, 1)).toThrow(RangeError);
  });
});
