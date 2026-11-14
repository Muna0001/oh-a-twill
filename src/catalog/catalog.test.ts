import fs from 'fs';
import path from 'path';

import { back, cellKey, overAt, rowInfo, stats } from '@/engine';
import type { PatternSetup, Stitch, Tile } from '@/engine/types';
import { DEFAULTS } from '@/engine/types';

import { CATEGORIES, STITCHES, getStitch, listStitches, warpOrderText, weftOrderText } from './index';

const SETUP: PatternSetup = { start: 0, mirror: false, side: 'left' };
const WARPS = 24;
const ROWS = 16;

const REFERENCE_IDS = ['plain', 'basket', 'twill22', 'twill21', 'chevron', 'arrowL', 'arrowR', 'herring', 'diamond', 'hounds', 'logcabin'];
const ADDED_IDS = ['halfbasket', 'twill13', 'twill31', 'broken', 'hairline', 'weftstripes'];

const fixtureDir = path.join(__dirname, '..', '..', 'fixtures', 'pattern');
const readFixture = (name: string) => JSON.parse(fs.readFileSync(path.join(fixtureDir, `${name}.json`), 'utf8'));

const toStrings = (tile: Tile): string[] => tile.map((r) => r.map((c) => (c ? '#' : '.')).join(''));

/** Rows top to bottom, so row 1 is the last line: the way the cloth looks on the loom. */
const block = (s: Stitch, cell: (w: number, r: number) => string): string => {
  const lines: string[] = [];
  for (let r = ROWS; r >= 1; r--) {
    let line = '';
    for (let w = 0; w < WARPS; w++) line += cell(w, r);
    lines.push(line);
  }
  return lines.join('\n');
};
const drawdown = (s: Stitch): string => block(s, (w, r) => (overAt(s, SETUP, w, r) ? '#' : '.'));
/** What the eye sees: 'A' / 'B' for the color on top. */
const colors = (s: Stitch): string => block(s, (w, r) => (cellKey(s, SETUP, w, r) === 0 ? 'A' : 'B'));

/** Longest run of one state down any tile column, wrapping around the repeat. */
const longestWarpFloat = (tile: Tile): number => {
  let best = 0;
  for (let c = 0; c < tile[0].length; c++) {
    const col = tile.map((r) => r[c]);
    const twice = [...col, ...col];
    let run = 1;
    for (let i = 1; i < twice.length; i++) {
      run = twice[i] === twice[i - 1] ? run + 1 : 1;
      best = Math.max(best, run);
    }
  }
  return best;
};

const byId = (id: string): Stitch => {
  const s = getStitch(id);
  if (!s) throw new Error(`no stitch ${id}`);
  return s;
};
const allCopy = (s: Stitch): string => [s.desc, s.goodFor, ...s.tips].join(' ');

describe('catalog', () => {
  it('has the 11 reference stitches and the 6 additions, 2/2 twill first, then plain', () => {
    const ids = STITCHES.map((s) => s.id);
    expect(ids.slice(0, 2)).toEqual(['twill22', 'plain']);
    expect([...ids].sort()).toEqual([...REFERENCE_IDS, ...ADDED_IDS].sort());
    expect(ids[0]).toBe(DEFAULTS.stitchId);
  });

  it('has unique ids', () => {
    expect(new Set(STITCHES.map((s) => s.id)).size).toBe(STITCHES.length);
  });

  it('keeps each category together after the two leading stitches', () => {
    const order = CATEGORIES.map((c) => c.id);
    const rest = STITCHES.slice(2).map((s) => order.indexOf(s.category));
    expect(rest).toEqual([...rest].sort((a, b) => a - b));
  });

  describe.each(STITCHES.map((s) => [s.id, s] as const))('%s', (_id, s) => {
    it('has a rectangular tile of at least 2 × 2', () => {
      expect(s.tile.length).toBeGreaterThanOrEqual(2);
      expect(s.tile[0].length).toBeGreaterThanOrEqual(2);
      for (const row of s.tile) expect(row).toHaveLength(s.tile[0].length);
    });

    it('interlaces every thread: no row or column is all over or all under', () => {
      for (const row of s.tile) {
        expect(row.some(Boolean)).toBe(true);
        expect(row.every(Boolean)).toBe(false);
      }
      for (let c = 0; c < s.tile[0].length; c++) {
        const col = s.tile.map((r) => r[c]);
        expect(col.some(Boolean)).toBe(true);
        expect(col.every(Boolean)).toBe(false);
      }
    });

    it('keeps floats to 4 or less at 24 warps', () => {
      // PLAN.md allows a longer float when a tip explains it. No stitch needs that today.
      const st = stats(s, SETUP, WARPS);
      const longest = Math.max(st.longestOver, st.longestUnder);
      if (longest > 4) expect(s.tips.some((t) => /float/i.test(t))).toBe(true);
      else expect(longest).toBeLessThanOrEqual(4);
    });

    it('explains any float of 3 or more, across or up the cloth', () => {
      const st = stats(s, SETUP, WARPS);
      if (Math.max(st.longestOver, st.longestUnder) >= 3) expect(s.tips.some((t) => /float/i.test(t))).toBe(true);
      if (longestWarpFloat(s.tile) >= 3) expect(s.tips.some((t) => /3 (warps|rows)/.test(t))).toBe(true);
    });

    it('has complete copy', () => {
      for (const text of [s.name, s.desc, s.goodFor, ...s.tips]) expect(text.trim()).not.toBe('');
      expect(s.tips.length).toBeGreaterThanOrEqual(2);
      expect(s.tips.length).toBeLessThanOrEqual(4);
      expect([1, 2, 3]).toContain(s.difficulty);
      expect(CATEGORIES.map((c) => c.id)).toContain(s.category);
      expect(Array.isArray(s.aliases)).toBe(true);
    });

    it('uses typographic apostrophes, US spelling and sentence case', () => {
      for (const text of [s.name, s.desc, s.goodFor, ...s.tips, ...s.aliases]) {
        expect(text).not.toMatch(/['"]/);
        expect(text).not.toMatch(/colour/i);
        expect(text[0]).toBe(text[0].toUpperCase());
        expect(text).toBe(text.trim());
      }
      for (const text of [s.desc, s.goodFor, ...s.tips]) expect(text).toMatch(/\.$/);
    });

    it('quotes a repeat size that matches the tile', () => {
      const st = stats(s, SETUP, WARPS);
      const text = allCopy(s);
      for (const m of text.matchAll(/divides by (\d+)/g)) expect(st.repWidth % Number(m[1]) === 0 || Number(m[1]) % st.repWidth === 0).toBe(true);
      for (const m of text.matchAll(/repeat is (\d+) warps (?:wide )?and (\d+) rows/g)) {
        expect(Number(m[1])).toBe(st.repWidth);
        expect(Number(m[2])).toBe(st.period);
      }
      for (const m of text.matchAll(/repeat is (\d+) warps wide[.:]/g)) expect(Number(m[1])).toBe(st.repWidth);
      for (const m of text.matchAll(/repeat is (\d+) rows long/g)) expect(Number(m[1])).toBe(st.period);
    });

    it('draws the same front as the committed snapshot (24 × 16, row 1 at the bottom)', () => {
      expect('\n' + drawdown(s) + '\n').toMatchSnapshot();
    });
  });
});

describe('reference stitches', () => {
  it('are the ones the reference dump lists', () => {
    expect(readFixture('index').patterns).toEqual(REFERENCE_IDS);
  });

  it.each(REFERENCE_IDS)('%s has the reference tile and color orders', (id) => {
    const f = readFixture(id);
    const s = byId(id);
    expect(toStrings(s.tile)).toEqual(f.tile);
    expect(s.warp ?? null).toEqual(f.warp);
    expect(s.weft ?? null).toEqual(f.weft);
  });

  it('keep the reference names and descriptions', () => {
    expect(REFERENCE_IDS.map((id) => [id, byId(id).name, byId(id).desc])).toEqual([
      ['plain', 'Plain weave', 'Over 1, under 1. The simplest, sturdiest cloth.'],
      ['basket', 'Basket weave', 'Over 2, under 2, with each row woven twice before it switches.'],
      ['twill22', '2/2 twill', 'Over 2, under 2, shifting one warp each row to make a diagonal.'],
      ['twill21', '2/1 twill', 'Over 2, under 1. A steeper diagonal with more weft showing.'],
      ['chevron', 'Chevron', '2/2 twill that turns back and forth across the warps, making zigzags.'],
      ['arrowL', 'Arrow left', '2/2 twill that turns back every 5 rows, making arrows that point left.'],
      ['arrowR', 'Arrow right', '2/2 twill that turns back every 5 rows, making arrows that point right.'],
      ['herring', 'Herringbone', '2/2 twill that flips direction with a clean break, like fish bones.'],
      ['diamond', 'Diamond', 'A chevron that also turns back up the rows, making diamonds.'],
      ['hounds', 'Houndstooth', '2/2 twill with 4 of one color, 4 of the other, in both warp and weft.'],
      ['logcabin', 'Log cabin', 'Plain weave with alternating colors that switch every 6 threads, making blocks of lines.'],
    ]);
  });

  it('2/2 twill keeps its fixed row order', () => {
    expect(toStrings(byId('twill22').tile)).toEqual(['##..', '#..#', '..##', '.##.']);
  });
});

describe('the additions do what their names say', () => {
  it('half basket is plain weave over pairs of warps', () => {
    expect(toStrings(byId('halfbasket').tile)).toEqual(['##..', '..##']);
  });

  it('3/1 twill shows mostly weft on the front and 1/3 mostly warp; each is the other’s back', () => {
    const t31 = byId('twill31');
    const t13 = byId('twill13');
    expect(stats(t31, SETUP, WARPS)).toMatchObject({ weftPct: 75, longestOver: 3, longestUnder: 1 });
    expect(stats(t13, SETUP, WARPS)).toMatchObject({ weftPct: 25, longestOver: 1, longestUnder: 3 });
    expect(stats(back(t13), SETUP, WARPS).weftPct).toBe(75);
    // The back of 1/3 twill has the rows of 3/1 twill: over 3, under 1, moving one warp per row.
    expect(toStrings(back(t13).tile).sort()).toEqual(toStrings(t31.tile).sort());
  });

  it('2/1 twill shows two-thirds weft on the front', () => {
    expect(stats(byId('twill21'), SETUP, WARPS).weftPct).toBe(67);
    expect(stats(back(byId('twill21')), SETUP, WARPS).weftPct).toBe(33);
  });

  it('broken twill has no diagonal longer than 3 cells, where 2/2 twill never stops', () => {
    // Follow a weft-over cell diagonally; in a straight twill the line never ends.
    const longestDiagonal = (tile: Tile): number => {
      const T = tile.length;
      const W = tile[0].length;
      let best = 0;
      for (const dir of [1, -1]) {
        for (let r = 0; r < T; r++) {
          for (let c = 0; c < W; c++) {
            let n = 0;
            while (n < 3 * T && tile[(r + n) % T][(((c + dir * n) % W) + W) % W]) n++;
            best = Math.max(best, n);
          }
        }
      }
      return best;
    };
    expect(longestDiagonal(byId('twill22').tile)).toBe(12);
    expect(longestDiagonal(byId('broken').tile)).toBe(3);
    const twill = toStrings(byId('twill22').tile);
    expect(toStrings(byId('broken').tile)).toEqual([twill[0], twill[1], twill[3], twill[2]]);
  });

  it('hairline stripes draws vertical lines one warp wide', () => {
    const lines = colors(byId('hairline')).split('\n');
    for (const line of lines) expect(line).toBe('AB'.repeat(WARPS / 2));
  });

  it('weft stripes draws bands across: 2 dotted rows, then 2 rows of solid Color B', () => {
    const lines = colors(byId('weftstripes')).split('\n').reverse();
    expect(lines.slice(0, 4)).toEqual(['AB'.repeat(12), 'BA'.repeat(12), 'B'.repeat(24), 'B'.repeat(24)]);
    for (let i = 4; i < lines.length; i++) expect(lines[i]).toBe(lines[i - 4]);
  });

  it('basket weave needs the edge wrap its tip describes', () => {
    const s = byId('basket');
    expect([1, 2, 3, 4].map((r) => rowInfo(s, SETUP, WARPS, r).edgeWarp)).toEqual([null, 24, null, 24]);
  });

  it('the arrows keep every row at over 2, under 2 but hold a warp for 3 rows at the turns', () => {
    for (const id of ['arrowL', 'arrowR']) {
      const s = byId(id);
      expect(stats(s, SETUP, WARPS)).toMatchObject({ longestOver: 2, longestUnder: 2, period: 10 });
      expect(longestWarpFloat(s.tile)).toBe(3);
    }
  });
});

describe('getStitch', () => {
  it('finds a stitch by id', () => {
    expect(getStitch('twill22')?.name).toBe('2/2 twill');
    expect(getStitch('weftstripes')?.name).toBe('Weft stripes');
  });
  it('returns undefined for an unknown id', () => {
    expect(getStitch('wefstripes')).toBeUndefined();
    expect(getStitch('')).toBeUndefined();
  });
});

describe('CATEGORIES', () => {
  it('lists the four categories with their labels', () => {
    expect(CATEGORIES).toEqual([
      { id: 'basics', label: 'Basics' },
      { id: 'twills', label: 'Twills' },
      { id: 'pointed', label: 'Pointed twills' },
      { id: 'color', label: 'Color and weave' },
    ]);
  });
  it('every category has at least one stitch', () => {
    for (const c of CATEGORIES) expect(listStitches({ category: c.id }).length).toBeGreaterThan(0);
  });
});

describe('listStitches', () => {
  const ids = (list: Stitch[]) => list.map((s) => s.id);

  it('returns the whole catalog in order by default, and for "all"', () => {
    expect(listStitches()).toEqual(STITCHES);
    expect(listStitches({})).toEqual(STITCHES);
    expect(listStitches({ category: 'all', query: '  ' })).toEqual(STITCHES);
  });

  it('filters by category', () => {
    expect(ids(listStitches({ category: 'basics' }))).toEqual(['plain', 'basket', 'halfbasket']);
    expect(ids(listStitches({ category: 'twills' }))).toEqual(['twill22', 'twill21', 'twill31', 'twill13', 'broken']);
    expect(ids(listStitches({ category: 'pointed' }))).toEqual(['chevron', 'herring', 'arrowL', 'arrowR', 'diamond']);
    expect(ids(listStitches({ category: 'color' }))).toEqual(['hounds', 'logcabin', 'hairline', 'weftstripes']);
  });

  it('searches names, ignoring case and outer spaces', () => {
    expect(ids(listStitches({ query: 'TWILL' }))).toEqual(['twill22', 'twill21', 'twill31', 'twill13', 'broken', 'chevron', 'herring', 'diamond']);
    expect(ids(listStitches({ query: ' arrow ' }))).toEqual(['arrowL', 'arrowR']);
    expect(ids(listStitches({ query: '2/2' }))).toEqual(['twill22', 'broken']);
  });

  it('searches aliases', () => {
    expect(ids(listStitches({ query: 'tabby' }))).toEqual(['plain']);
    expect(ids(listStitches({ query: 'dogtooth' }))).toEqual(['hounds']);
    expect(ids(listStitches({ query: 'point' }))).toEqual(['chevron']);
  });

  it('does not search descriptions or tips', () => {
    expect(listStitches({ query: 'sturdiest' })).toEqual([]);
  });

  it('returns nothing when nothing matches', () => {
    expect(listStitches({ query: 'zzz' })).toEqual([]);
  });

  it('keeps only favourites when a list is given, in catalog order', () => {
    expect(ids(listStitches({ favourites: ['logcabin', 'plain', 'nope'] }))).toEqual(['plain', 'logcabin']);
    expect(listStitches({ favourites: [] })).toEqual([]);
  });

  it('combines the filters', () => {
    expect(ids(listStitches({ category: 'twills', query: 'twill', favourites: ['twill31', 'chevron', 'twill22'] }))).toEqual(['twill22', 'twill31']);
    expect(listStitches({ category: 'basics', query: 'twill' })).toEqual([]);
  });
});

describe('warpOrderText and weftOrderText', () => {
  it('are null when the threads are all one color', () => {
    expect(warpOrderText(byId('twill22'))).toBeNull();
    expect(weftOrderText(byId('twill22'))).toBeNull();
    expect(warpOrderText(byId('weftstripes'))).toBeNull();
  });

  it('run-length the color order, as the reference does', () => {
    expect(warpOrderText(byId('hounds'))).toBe('4 Color A, 4 Color B');
    expect(weftOrderText(byId('hounds'))).toBe('4 Color A, 4 Color B');
    expect(warpOrderText(byId('logcabin'))).toBe(
      '1 Color A, 1 Color B, 1 Color A, 1 Color B, 1 Color A, 2 Color B, 1 Color A, 1 Color B, 1 Color A, 1 Color B, 1 Color A',
    );
    expect(warpOrderText(byId('hairline'))).toBe('1 Color A, 1 Color B');
    expect(weftOrderText(byId('weftstripes'))).toBe('2 Color A, 2 Color B');
  });
});
