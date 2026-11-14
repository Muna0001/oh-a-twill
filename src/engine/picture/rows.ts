import { mod } from '../math';
import type { PicRowInfo, PicWeave, PictureGrid, Section } from '../types';

/** 2/2 twill in the owner's fixed row order: ##.., #..#, ..##, .##. (PLAN.md section 6, item 1). */
const TWILL: readonly (readonly boolean[])[] = [
  [true, true, false, false],
  [true, false, false, true],
  [false, false, true, true],
  [false, true, true, false],
];

/** Whether the weft goes over warp `x` (0-based) on row `r` (1-based). */
export function picOver(weave: PicWeave, x: number, r: number): boolean {
  return weave === 'plain' ? mod(x + r - 1, 2) === 0 : TWILL[mod(r - 1, 4)][mod(x, 4)];
}

/**
 * Everything needed to weave row `r` of a picture. Row 1 is the BOTTOM row of
 * the picture (grid row H - 1). Sections always run left to right.
 * Throws a RangeError outside 1..H; row H + 1 means "finished", check first.
 */
export function picRowInfo(pic: PictureGrid, weave: PicWeave, r: number): PicRowInfo {
  const { W, H, grid } = pic;
  if (!Number.isInteger(r) || r < 1 || r > H) {
    throw new RangeError(`picRowInfo: row ${r} is outside 1..${H}`);
  }
  const y = H - r;
  const cells: number[] = [];
  const over: boolean[] = [];
  for (let x = 0; x < W; x++) {
    cells.push(grid[y * W + x]);
    over.push(picOver(weave, x, r));
  }

  const sections: Section[] = [];
  cells.forEach((color, i) => {
    const last = sections[sections.length - 1];
    if (last && last.color === color) {
      last.n++;
      last.to = i + 1;
    } else {
      sections.push({ color, n: 1, from: i + 1, to: i + 1, startOver: false, startN: 0 });
    }
  });
  for (const s of sections) {
    const o = over[s.from - 1];
    let n = 0;
    while (s.from - 1 + n < s.to && over[s.from - 1 + n] === o) n++;
    s.startOver = o;
    s.startN = n;
  }

  let sameAsPrevious = false;
  if (r > 1) {
    const py = y + 1;
    sameAsPrevious = true;
    for (let x = 0; x < W; x++) {
      if (grid[py * W + x] !== cells[x]) {
        sameAsPrevious = false;
        break;
      }
    }
  }
  return { row: r, cells, over, sections, sameAsPrevious };
}
