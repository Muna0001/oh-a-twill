import { fireEvent, render, screen } from '@testing-library/react-native';

import { TWILL, picRowInfo, rowInfo, stats, type ColorKey, type PaletteColor, type PatternSetup, type PictureGrid, type Structure } from '@/engine';

import { DirectionPill, Drawdown, EdgeTip, GridView, MathPanel, PicturePreview, PictureStrip, RepeatChips, RepeatList, SectionChips, StepChips, StripScroller, TilePreview, WarpNumbers, WarpStrip, WeaveGallery } from './index';

const A: ColorKey = 0;
const B: ColorKey = 1;
const twill22: Structure = { tile: TWILL };
const hounds: Structure = { tile: TWILL, warp: [A, A, A, A, B, B, B, B], weft: [A, A, A, A, B, B, B, B] };
const setup: PatternSetup = { start: 0, mirror: false, side: 'left' };
const colors: [string, string] = ['#2E4C8F', '#E4DCC8'];

type Json = { type: string; props: Record<string, unknown>; children: (Json | string)[] | null };

/** Counts host nodes whose type matches, anywhere in the rendered tree. */
function countNodes(match: (type: string) => boolean): number {
  const walk = (node: Json | Json[] | string | null): number => {
    if (!node || typeof node === 'string') return 0;
    if (Array.isArray(node)) return node.reduce((sum, n) => sum + walk(n), 0);
    return (match(node.type) ? 1 : 0) + (node.children ?? []).reduce<number>((sum, n) => sum + walk(n), 0);
  };
  return walk(screen.toJSON() as Json | Json[] | null);
}
/** Strips, numbers and drawdown labels are decoration for screen readers, so queries must opt in. */
const hidden = { includeHiddenElements: true };
const isRect = (type: string) => /Rect$/.test(type);
const isShape = (type: string) => /(Rect|Line|Path)$/.test(type);

describe('StepChips', () => {
  it('lists row 1 of 2/2 twill at 24 warps left to right', async () => {
    const info = rowInfo(twill22, setup, 24, 1);
    await render(<StepChips runs={info.runs} row={1} ltr={info.ltr} testID="steps" />);
    const chips = screen.getAllByTestId('steps-step');
    expect(chips).toHaveLength(12);
    expect(chips[0]).toHaveTextContent('Over 2warps 1–2');
    expect(chips[1]).toHaveTextContent('Under 2warps 3–4');
    expect(chips[11]).toHaveTextContent('Under 2warps 23–24');
  });

  it('lists row 2 right to left, starting with a single warp', async () => {
    const info = rowInfo(twill22, setup, 24, 2);
    await render(<StepChips runs={info.runs} row={2} ltr={info.ltr} testID="steps" />);
    const chips = screen.getAllByTestId('steps-step');
    expect(chips[0]).toHaveTextContent('Over 1warp 24');
    expect(chips[1]).toHaveTextContent('Under 2warps 23–22');
    expect(chips[2]).toHaveTextContent('Over 2warps 21–20');
  });

  it('exposes the whole list as one sentence', async () => {
    const info = rowInfo(twill22, setup, 8, 2);
    await render(<StepChips runs={info.runs} row={2} ltr={info.ltr} />);
    expect(screen.getByLabelText('Row 2, right to left: over 1, under 2, over 2, under 2, over 1')).toBeTruthy();
  });

  it('says left to right for row 1', async () => {
    const info = rowInfo(twill22, setup, 8, 1);
    await render(<StepChips runs={info.runs} row={1} ltr={info.ltr} />);
    expect(screen.getByLabelText('Row 1, left to right: over 2, under 2, over 2, under 2')).toBeTruthy();
  });
});

describe('GridView', () => {
  it('keeps a 120 × 400 banded two-colour grid to a handful of rects', async () => {
    const colorAt = (_x: number, y: number) => (Math.floor(y / 25) % 2 ? '#111111' : '#eeeeee');
    await render(<GridView cols={120} rows={400} cell={6} colorAt={colorAt} />);
    // 16 colour bands of 25 rows, cut again at every 20-row drawing band: far below 48,000 cells.
    const rects = countNodes(isRect);
    expect(rects).toBeGreaterThanOrEqual(16);
    expect(rects).toBeLessThanOrEqual(40);
  });

  it('merges horizontal runs when rows differ', async () => {
    const colorAt = (x: number, y: number) => (x < 60 + (y % 2) ? '#111111' : '#eeeeee');
    await render(<GridView cols={120} rows={40} cell={6} colorAt={colorAt} />);
    expect(countNodes(isRect)).toBe(80);
  });

  it('draws one dashed line per run when there is a gap', async () => {
    await render(<GridView cols={24} rows={4} cell={10} gap={2} colorAt={(x) => (x % 4 < 2 ? '#111111' : '#eeeeee')} />);
    expect(countNodes(isShape)).toBe(4 * 12);
  });

  it('turns a press into a row index and outlines the highlighted row', async () => {
    const onPressRow = jest.fn();
    await render(<GridView testID="grid" cols={4} rows={10} cell={10} colorAt={() => '#111111'} highlightRow={3} onPressRow={onPressRow} />);
    await fireEvent.press(screen.getByTestId('grid-press'), { nativeEvent: { locationY: 57 } });
    expect(onPressRow).toHaveBeenCalledWith(5);
    expect(screen.getByTestId('grid-mark')).toHaveStyle({ top: 30, height: 10 });
  });

  it('fits the available width when no cell size is given', async () => {
    await render(<GridView testID="grid" cols={10} rows={2} colorAt={() => '#111111'} />);
    await fireEvent(screen.getByTestId('grid').parent!, 'layout', { nativeEvent: { layout: { width: 205, height: 0 } } });
    expect(screen.getByTestId('grid')).toHaveStyle({ width: 200, height: 40 });
  });
});

describe('WarpNumbers', () => {
  const shown = () => screen.getAllByText(/^\d+$/, hidden).map((n) => Number(n.props.children));

  it('shows every warp number at 24', async () => {
    await render(<WarpNumbers count={24} cell={12} />);
    expect(shown()).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it('shows 1, every 5th and the last at 33', async () => {
    await render(<WarpNumbers count={33} cell={10} />);
    expect(shown()).toEqual([1, 5, 10, 15, 20, 25, 30, 33]);
  });

  it('shows 1, every 5th and the last at 120, centred under their warps', async () => {
    await render(<WarpNumbers count={120} cell={10} />);
    expect(shown()).toEqual([1, ...Array.from({ length: 24 }, (_, i) => (i + 1) * 5)]);
    // Warp 5 spans 40–50 px; its 30 px box is centred on 45.
    expect(screen.getByText('5', hidden)).toHaveStyle({ left: 30, width: 30 });
  });
});

describe('strips', () => {
  it('draws a pattern strip and its numbers at the shared cell width', async () => {
    const info = rowInfo(twill22, setup, 120, 1);
    await render(
      <StripScroller count={120} testID="scroller">
        <WarpStrip testID="strip" states={info.states} warpColors={[colors[1]]} weftColor={colors[0]} />
        <WarpNumbers count={120} />
      </StripScroller>,
    );
    // 120 warps never fit: cells stay 10 px and the strip scrolls.
    expect(screen.getByTestId('strip', hidden)).toBeTruthy();
    expect(screen.getByText('120', hidden)).toHaveStyle({ left: 1180 });
  });

  it('draws a picture strip', async () => {
    await render(<PictureStrip testID="pstrip" cells={[0, 0, 1, 1]} over={[true, true, false, false]} palette={['#ffffff', '#000000']} cell={12} />);
    expect(screen.getByTestId('pstrip', hidden)).toBeTruthy();
  });
});

describe('Drawdown', () => {
  it('shows 16 rows from 9 below the current row and jumps to the pressed row', async () => {
    const onJump = jest.fn();
    await render(<Drawdown testID="dd" stitch={twill22} setup={setup} warps={24} colors={colors} currentRow={12} onJump={onJump} />);
    // Rows 3–18, row 18 at the top.
    expect(screen.getByText('18', hidden)).toBeTruthy();
    expect(screen.getByText('3', hidden)).toBeTruthy();
    expect(screen.queryByText('2', hidden)).toBeNull();
    expect(screen.queryByText('19', hidden)).toBeNull();
    const pitch = (screen.getByTestId('dd-current').props.style.height as number) - 4 + 2;
    await fireEvent.press(screen.getByTestId('dd'), { nativeEvent: { locationY: 0.5 * pitch } });
    expect(onJump).toHaveBeenLastCalledWith(18);
    await fireEvent.press(screen.getByTestId('dd'), { nativeEvent: { locationY: 6.5 * pitch } });
    expect(onJump).toHaveBeenLastCalledWith(12);
    await fireEvent.press(screen.getByTestId('dd'), { nativeEvent: { locationY: 15.5 * pitch } });
    expect(onJump).toHaveBeenLastCalledWith(3);
  });

  it('starts at row 1 near the beginning', async () => {
    const onJump = jest.fn();
    await render(<Drawdown testID="dd" stitch={twill22} setup={setup} warps={24} colors={colors} currentRow={1} onJump={onJump} />);
    expect(screen.getByText('1', hidden)).toBeTruthy();
    expect(screen.getByText('16', hidden)).toBeTruthy();
    expect(screen.queryByText('17', hidden)).toBeNull();
  });
});

describe('PicturePreview', () => {
  const palette: PaletteColor[] = [
    { rgb: [255, 255, 255], hex: '#ffffff', name: 'White', count: 6 },
    { rgb: [0, 0, 128], hex: '#000080', name: 'Dark blue', count: 6 },
  ];
  // 4 wide, 3 high. Top row first.
  const pic: PictureGrid = { W: 4, H: 3, grid: Uint8Array.from([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0]), palette };

  it('jumps to the row that was pressed (row 1 is the bottom)', async () => {
    const onJump = jest.fn();
    await render(<PicturePreview testID="pv" pic={pic} currentRow={1} onJump={onJump} />);
    const cell = screen.getByTestId('pv-mark').props.style.height as number;
    expect(screen.getByTestId('pv-mark')).toHaveStyle({ top: 2 * cell });
    await fireEvent.press(screen.getByTestId('pv-press'), { nativeEvent: { locationY: cell / 2 } });
    expect(onJump).toHaveBeenLastCalledWith(3);
    await fireEvent.press(screen.getByTestId('pv-press'), { nativeEvent: { locationY: 2.5 * cell } });
    expect(onJump).toHaveBeenLastCalledWith(1);
  });

  it('outlines nothing when finished', async () => {
    await render(<PicturePreview testID="pv" pic={pic} currentRow={4} onJump={() => {}} />);
    expect(screen.queryByTestId('pv-mark')).toBeNull();
  });

  it('writes the sections with how each starts', async () => {
    const info = picRowInfo(pic, 'twill22', 1);
    await render(<SectionChips sections={info.sections} palette={palette} row={1} testID="sections" />);
    const chips = screen.getAllByTestId('sections-section');
    expect(chips[0]).toHaveTextContent('Dark bluewarps 1–3, start over 2');
    expect(chips[1]).toHaveTextContent('Whitewarp 4, start under 1');
    expect(screen.getByLabelText('Color sections for row 1, left to right')).toBeTruthy();
  });
});

describe('small pieces', () => {
  it('EdgeTip names the warp twice, in the reference sentence', async () => {
    await render(<EdgeTip warp={24} />);
    expect(
      screen.getByText('Edge check: this row starts the same way the last row ended, so warp 24 won’t get caught. Wrap the weft once around warp 24 before you start.'),
    ).toBeTruthy();
  });

  it('DirectionPill says which way the row goes', async () => {
    await render(<DirectionPill ltr />);
    expect(screen.getByText('Left to right')).toBeTruthy();
    await render(<DirectionPill ltr={false} />);
    expect(screen.getByText('Right to left')).toBeTruthy();
  });

  it('RepeatChips numbers the labels', async () => {
    await render(<RepeatChips labels={['Over 2, under 2', 'Under 2, over 2']} current={2} />);
    expect(screen.getByText('1. Over 2, under 2')).toBeTruthy();
    expect(screen.getByText('2. Under 2, over 2')).toBeTruthy();
  });

  it('MathPanel renders the five items', async () => {
    await render(<MathPanel stats={stats(hounds, setup, 24)} warps={24} colorWarpLength={8} />);
    for (const title of ['Pattern width', 'Across your 24 warps', 'Rows before it repeats', 'Which side shows more', 'Longest float']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    expect(screen.getByText('8 warps')).toBeTruthy();
  });

  it('RepeatList writes out one repeat', async () => {
    await render(<RepeatList stitch={hounds} setup={setup} colors={colors} />);
    expect(screen.getByLabelText('1. Over 2, under 2 in Color A')).toBeTruthy();
    expect(screen.getByLabelText('8. Under 1, over 2, under 1 in Color B')).toBeTruthy();
  });

  it('TilePreview merges runs: 2/2 twill 12 × 10 is 60 rects plus the frame', async () => {
    await render(<TilePreview stitch={twill22} colors={colors} />);
    // Rows alternate between 6 and 7 runs.
    expect(countNodes(isRect)).toBe(5 * 6 + 5 * 7 + 1);
  });
});

describe('WeaveGallery', () => {
  it('renders every component without crashing', async () => {
    await render(<WeaveGallery />);
    expect(screen.getByText('Weave components')).toBeTruthy();
    expect(screen.getAllByText('Left to right').length + screen.getAllByText('Right to left').length).toBe(4);
  });
});
