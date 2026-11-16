import { TWILL, stats, threaded, type ColorKey, type PatternSetup, type Structure } from '@/engine';

import { colorOrderSegments, describeColorOrder, mathItems, mathText, mergeRuns, repeatLabels, repeatRowLabels, warpColorsFor, warpNumberLabels } from './helpers';

const A: ColorKey = 0;
const B: ColorKey = 1;
const twill22: Structure = { tile: TWILL };
const hounds: Structure = { tile: TWILL, warp: [A, A, A, A, B, B, B, B], weft: [A, A, A, A, B, B, B, B] };
const herring: Structure = { tile: threaded([0, 1, 2, 3, 0, 1, 2, 3, 1, 0, 3, 2, 1, 0, 3, 2], [0, 1, 2, 3]) };
const setup: PatternSetup = { start: 0, mirror: false, side: 'left' };

describe('mergeRuns', () => {
  it('merges neighbours of the same colour', () => {
    const row = ['a', 'a', 'b', 'b', 'b', 'a'];
    expect(mergeRuns(row.length, (x) => row[x])).toEqual([
      { x: 0, n: 2, color: 'a' },
      { x: 2, n: 3, color: 'b' },
      { x: 5, n: 1, color: 'a' },
    ]);
  });

  it('returns one run for a plain row and none for an empty one', () => {
    expect(mergeRuns(120, () => '#fff')).toEqual([{ x: 0, n: 120, color: '#fff' }]);
    expect(mergeRuns(0, () => '#fff')).toEqual([]);
  });
});

describe('warpNumberLabels', () => {
  it('shows every number up to 32 warps', () => {
    expect(warpNumberLabels(24)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(warpNumberLabels(32)).toHaveLength(32);
  });

  it('shows 1, every 5th and the last above 32', () => {
    expect(warpNumberLabels(33)).toEqual([1, 5, 10, 15, 20, 25, 30, 33]);
    const at120 = warpNumberLabels(120);
    expect(at120).toHaveLength(25);
    expect(at120.slice(0, 3)).toEqual([1, 5, 10]);
    expect(at120[at120.length - 1]).toBe(120);
  });
});

describe('warpColorsFor', () => {
  it('is all Color B without a warp colour order', () => {
    expect(warpColorsFor(twill22, 5, ['#aaa', '#bbb'])).toEqual(['#bbb', '#bbb', '#bbb', '#bbb', '#bbb']);
  });

  it('repeats the colour order across the warps', () => {
    expect(warpColorsFor(hounds, 10, ['#aaa', '#bbb'])).toEqual(['#aaa', '#aaa', '#aaa', '#aaa', '#bbb', '#bbb', '#bbb', '#bbb', '#aaa', '#aaa']);
  });
});

describe('repeatLabels', () => {
  it('names the four rows of 2/2 twill in the fixed order', () => {
    expect(repeatLabels(twill22, setup, 1)).toEqual(['Over 2, under 2', 'Over 1, under 2, over 1', 'Under 2, over 2', 'Under 1, over 2, under 1']);
  });

  it('starts from the chosen start row', () => {
    expect(repeatLabels(twill22, { ...setup, start: 2 }, 7)?.[0]).toBe('Under 2, over 2');
  });

  it('adds the weft colour for colour-and-weave stitches', () => {
    const labels = repeatLabels(hounds, setup, 11);
    expect(labels).toHaveLength(8);
    expect(labels?.[0]).toBe('Over 2, under 2 in Color A');
    expect(labels?.[3]).toBe('Under 1, over 2, under 1 in Color A');
    expect(labels?.[4]).toBe('Over 2, under 2 in Color B');
  });

  it('uses "Row k" for tiles wider than 6', () => {
    expect(repeatLabels(herring, setup, 1)).toEqual(['Row 1', 'Row 2', 'Row 3', 'Row 4']);
  });

  it('is null when the period is 1 or more than 12', () => {
    expect(repeatLabels({ tile: [[true, false]] }, setup, 1)).toBeNull();
    const long: Structure = { tile: Array.from({ length: 13 }, (_, i) => [i % 2 === 0, i % 2 === 1]) };
    expect(repeatLabels(long, setup, 1)).toBeNull();
    expect(repeatRowLabels(long, setup)).toHaveLength(13);
  });
});

describe('mathItems', () => {
  const text = (s: Structure, warps: number) => mathItems(stats(s, setup, warps), warps, s.warp?.length).map((i) => [i.title, mathText(i)]);
  const bold = (s: Structure, warps: number) =>
    mathItems(stats(s, setup, warps), warps, s.warp?.length).map((i) =>
      i.parts
        .filter((p) => p.bold)
        .map((p) => p.text)
        .join(' | '),
    );

  it('matches the reference for 2/2 twill at 24 warps', () => {
    expect(text(twill22, 24)).toEqual([
      ['Pattern width', '4 warps per repeat.'],
      ['Across your 24 warps', '24 ÷ 4 = 6 full repeats, nothing left over. Both edges finish cleanly.'],
      ['Rows before it repeats', '4 rows. Row 5 is the same as row 1.'],
      ['Which side shows more', 'Balanced. Weft is on top half the time, so warp and weft show equally.'],
      ['Longest float', 'Weft skips up to 2 warps on top and 2 underneath.'],
    ]);
    expect(bold(twill22, 24)).toEqual(['4 warps', '6 full repeats', '4 rows', 'Balanced.', '2 warps | 2']);
  });

  it('matches the reference for 2/2 twill at 26 warps', () => {
    const items = text(twill22, 26);
    expect(items[1]).toEqual([
      'Across your 26 warps',
      '26 ÷ 4 = 6 full repeats with 2 warps left over. The pattern carries on into those, so the two edges won’t match. For even repeats you’d want 24 or 28 warps.',
    ]);
    expect(bold(twill22, 26)[1]).toBe('6 full repeats with 2 warps left over');
  });

  it('matches the reference for houndstooth at 24 warps', () => {
    const items = text(hounds, 24);
    expect(items[0]).toEqual(['Pattern width', 'The weave repeats every 4 warps and the colors every 8, so the full pattern is 8 warps wide.']);
    expect(items[1]).toEqual(['Across your 24 warps', '24 ÷ 8 = 3 full repeats, nothing left over. Both edges finish cleanly.']);
    expect(items[2]).toEqual(['Rows before it repeats', '8 rows. Row 9 is the same as row 1.']);
    expect(bold(hounds, 24)[0]).toBe('8 warps');
  });

  it('handles singular forms, uneven sides and long floats', () => {
    const base = { tileWidth: 4, repWidth: 4, period: 1, fullRepeats: 1, remainder: 1, nearestCleanWarps: [4, 8], longestOver: 1, longestUnder: 4 };
    const weft = mathItems({ ...base, weftPct: 75 }, 5).map(mathText);
    expect(weft[1]).toBe('5 ÷ 4 = 1 full repeat with 1 warp left over. The pattern carries on into those, so the two edges won’t match. For even repeats you’d want 4 or 8 warps.');
    expect(weft[2]).toBe('1 row. Row 2 is the same as row 1.');
    expect(weft[3]).toBe('Weft shows more on the side facing you, about 75%. The back will be mostly warp.');
    expect(weft[4]).toBe('Weft skips up to 1 warp on top and 4 underneath. Floats of 4 or more can snag; fine for a wall hanging, risky for something worn.');
    const warp = mathItems({ ...base, weftPct: 33 }, 5).map(mathText);
    expect(warp[3]).toBe('Warp shows more on the side facing you. Weft is on top about 33% of the time.');
    const one = mathItems({ ...base, remainder: 0, nearestCleanWarps: [], weftPct: 50 }, 4).map(mathText);
    expect(one[1]).toBe('4 ÷ 4 = 1 full repeat, nothing left over. Both edges finish cleanly.');
  });
});

describe('describeColorOrder', () => {
  it('houndstooth: two solid blocks', () => {
    expect(describeColorOrder([A, A, A, A, B, B, B, B])).toBe('4 Color A, then 4 Color B');
  });

  it('log cabin: two alternations of 6, the second starting with B', () => {
    const logcabin: ColorKey[] = [A, B, A, B, A, B, B, A, B, A, B, A];
    expect(colorOrderSegments(logcabin)).toEqual([
      { kind: 'alternate', start: 0, n: 6 },
      { kind: 'alternate', start: 6, n: 6 },
    ]);
    expect(describeColorOrder(logcabin)).toBe(
      '6 threads alternating Color A and Color B, starting with A, then 6 threads alternating Color B and Color A, starting with B',
    );
    expect(describeColorOrder(logcabin, 'weft')).toBe(
      '6 rows alternating Color A and Color B, starting with A, then 6 rows alternating Color B and Color A, starting with B',
    );
  });

  it('hairline: a repeat that is one alternation reads as "Alternate"', () => {
    expect(describeColorOrder([A, B])).toBe('Alternate Color A and Color B');
    expect(describeColorOrder([B, A], 'weft')).toBe('Alternate Color B and Color A');
  });

  it('weft stripes: two solid pairs', () => {
    expect(describeColorOrder([A, A, B, B], 'weft')).toBe('2 Color A, then 2 Color B');
  });

  it('mixes solid runs and alternations, and ends on a single thread', () => {
    expect(describeColorOrder([A, A, B, A, B, B])).toBe('2 Color A, then 3 threads alternating Color B and Color A, starting with B, then 1 Color B');
    expect(describeColorOrder([A])).toBe('1 Color A');
  });
});
