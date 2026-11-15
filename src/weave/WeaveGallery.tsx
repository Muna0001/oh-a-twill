import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { TWILL, picRowInfo, rowInfo, stats, threaded, type ColorKey, type PaletteColor, type PatternSetup, type PictureGrid, type Structure } from '@/engine';
import { Button, Chip, Collapsible, Panel, Text, useTheme } from '@/ui';

import { DirectionPill, EdgeTip, RepeatChips, SectionChips, StepChips, WeftTag } from './chips';
import { weaveCopy } from './copy';
import { Drawdown } from './Drawdown';
import { repeatLabels, warpColorsFor } from './helpers';
import { MathPanel } from './MathPanel';
import { PicturePreview } from './PicturePreview';
import { RepeatList } from './RepeatList';
import { PictureStrip, StripScroller, WarpNumbers, WarpStrip } from './strips';
import { TilePreview } from './TilePreview';

const A: ColorKey = 0;
const B: ColorKey = 1;

/** Defined here, as in the reference, so the gallery does not depend on the catalog. */
const twill22: Structure = { tile: TWILL };
const hounds: Structure = { tile: TWILL, warp: [A, A, A, A, B, B, B, B], weft: [A, A, A, A, B, B, B, B] };
const herring: Structure = { tile: threaded([0, 1, 2, 3, 0, 1, 2, 3, 1, 0, 3, 2, 1, 0, 3, 2], [0, 1, 2, 3]) };

const colors: [string, string] = ['#2E4C8F', '#E4DCC8'];
const setup: PatternSetup = { start: 0, mirror: false, side: 'left' };

const palette: PaletteColor[] = [
  { rgb: [228, 220, 200], hex: '#E4DCC8', name: 'Cream', count: 0 },
  { rgb: [178, 58, 72], hex: '#B23A48', name: 'Red', count: 0 },
  { rgb: [63, 107, 61], hex: '#3F6B3D', name: 'Green', count: 0 },
  { rgb: [217, 165, 33], hex: '#D9A521', name: 'Yellow', count: 0 },
];

/** A flower, drawn by hand: '.' cream, 'r' red, 'g' green, 'y' yellow. Top row first. */
const flower = [
  '........................',
  '.........rrrrrr.........',
  '.......rrrrrrrrrr.......',
  '......rrrrrrrrrrrr......',
  '.....rrrrryyyyrrrrr.....',
  '.....rrrryyyyyyrrrr.....',
  '.....rrrryyyyyyrrrr.....',
  '.....rrrrryyyyrrrrr.....',
  '......rrrrrrrrrrrr......',
  '.......rrrrrrrrrr.......',
  '.........rrrrrr.........',
  '...........gg...........',
  '...........gg...........',
  '....ggg....gg...........',
  '...ggggggg.gg....ggg....',
  '....ggggggggg.ggggggg...',
  '......gggggggggggggg....',
  '...........ggggggg......',
  '...........gg...........',
  '...........gg...........',
];

function pictureFrom(rows: string[]): PictureGrid {
  const W = rows[0].length;
  const grid = new Uint8Array(W * rows.length);
  rows.forEach((s, y) => [...s].forEach((c, x) => (grid[y * W + x] = Math.max(0, '.rgy'.indexOf(c)))));
  return { W, H: rows.length, grid, palette };
}

/** 120 × 400 bands and blocks: the largest picture allowed, to watch GridView under load. */
function bigPicture(): PictureGrid {
  const W = 120;
  const H = 400;
  const grid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const band = Math.floor(y / 25) % 4;
      const wave = Math.floor((x + Math.floor(y / 5) * 3) / 30) % 2;
      grid[y * W + x] = (band + wave) % 4;
    }
  }
  return { W, H, grid, palette };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Panel>
      <Text variant="heading" style={{ marginBottom: theme.spacing.md }}>
        {title}
      </Text>
      <View style={{ gap: theme.spacing.md }}>{children}</View>
    </Panel>
  );
}

function RowButtons({ row, setRow }: { row: number; setRow: (row: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Button icon="chevron-left" label="Back" disabled={row <= 1} onPress={() => setRow(row - 1)} />
      <Button variant="primary" label="Row done" trailingIcon="chevron-right" onPress={() => setRow(row + 1)} />
    </View>
  );
}

function PatternDemo({ name, stitch, warps, startRow = 2, full = true }: { name: string; stitch: Structure; warps: number; startRow?: number; full?: boolean }) {
  const [row, setRow] = useState(startRow);
  const info = rowInfo(stitch, setup, warps, row);
  const st = useMemo(() => stats(stitch, setup, warps), [stitch, warps]);
  const warpColors = useMemo(() => warpColorsFor(stitch, warps, colors), [stitch, warps]);
  const labels = repeatLabels(stitch, setup, row);
  const weftColor = colors[info.weftKey];
  return (
    <Section title={`${name}, ${warps} warps`}>
      {full ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <TilePreview stitch={stitch} colors={colors} style={{ width: 108 }} />
          <TilePreview stitch={stitch} colors={colors} cols={24} rows={18} style={{ width: 96 }} />
          <TilePreview stitch={stitch} colors={colors} cols={24} rows={18} face="back" style={{ width: 96 }} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="rowNumber">Row {row}</Text>
        <DirectionPill ltr={info.ltr} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {st.period > 1 ? (
          <Text color="muted">
            Row {info.repeatRow} of the {st.period}-row repeat.
          </Text>
        ) : null}
        <WeftTag color={weftColor} label={weaveCopy.weft(weaveCopy.colorName(info.weftKey))} />
      </View>
      {labels ? <RepeatChips labels={labels} current={info.repeatRow} /> : null}
      <StripScroller count={warps}>
        <WarpStrip states={info.states} warpColors={warpColors} weftColor={weftColor} />
        <WarpNumbers count={warps} />
      </StripScroller>
      {full ? <StepChips runs={info.runs} row={row} ltr={info.ltr} weftColor={stitch.weft ? weftColor : undefined} /> : null}
      {info.edgeWarp != null ? <EdgeTip warp={info.edgeWarp} /> : null}
      <RowButtons row={row} setRow={setRow} />
      <Text variant="label">Drawdown</Text>
      <Drawdown stitch={stitch} setup={setup} warps={warps} colors={colors} currentRow={row} onJump={setRow} />
      {full ? (
        <>
          <Collapsible title="The math" defaultOpen>
            <MathPanel stats={st} warps={warps} colorWarpLength={stitch.warp?.length} />
          </Collapsible>
          <Text variant="label">The repeat</Text>
          <RepeatList stitch={stitch} setup={setup} colors={colors} />
        </>
      ) : null}
    </Section>
  );
}

function PictureDemo({ title, pic, startRow, maxHeight }: { title: string; pic: PictureGrid; startRow: number; maxHeight?: number }) {
  const [row, setRow] = useState(startRow);
  const hexes = useMemo(() => pic.palette.map((p) => p.hex), [pic]);
  const info = row <= pic.H ? picRowInfo(pic, 'twill22', row) : null;
  return (
    <Section title={title}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
        <Text variant="display">{info ? `Row ${row}` : 'Finished'}</Text>
        {info ? (
          <Text color="muted" weight="medium">
            of {pic.H}
          </Text>
        ) : (
          <Chip label="Finished" tone="mint" icon="check" size="md" />
        )}
      </View>
      {info ? (
        <>
          <StripScroller count={pic.W}>
            <PictureStrip cells={info.cells} over={info.over} palette={hexes} />
            <WarpNumbers count={pic.W} />
          </StripScroller>
          <SectionChips sections={info.sections} palette={pic.palette} row={row} />
        </>
      ) : null}
      <RowButtons row={row} setRow={(r) => setRow(Math.min(pic.H + 1, r))} />
      <Text variant="label">Woven preview</Text>
      <PicturePreview pic={pic} currentRow={row} onJump={setRow} maxHeight={maxHeight} />
    </Section>
  );
}

/** Dev page content: every weave component, for three stitches and two pictures. Mounted on /gallery. */
export function WeaveGallery() {
  const theme = useTheme();
  const small = useMemo(() => pictureFrom(flower), []);
  const big = useMemo(() => bigPicture(), []);
  return (
    <View testID="weave-gallery" style={{ backgroundColor: theme.colors.bg }}>
      <View style={{ width: '100%', maxWidth: theme.maxContentWidth, alignSelf: 'center', paddingHorizontal: theme.spacing.gutter, paddingTop: theme.spacing.xl }}>
        <Text variant="title" style={{ marginBottom: theme.spacing.xl }}>
          Weave components
        </Text>
        <PatternDemo name="2/2 twill" stitch={twill22} warps={24} />
        <PatternDemo name="Houndstooth" stitch={hounds} warps={24} startRow={6} />
        <PatternDemo name="Herringbone" stitch={herring} warps={24} startRow={12} />
        <PatternDemo name="Herringbone" stitch={herring} warps={120} startRow={3} full={false} />
        <PictureDemo title="Picture, 24 warps by 20 rows" pic={small} startRow={5} />
        <PictureDemo title="Picture, finished" pic={small} startRow={small.H + 1} />
        <PictureDemo title="Picture, 120 warps by 400 rows" pic={big} startRow={120} maxHeight={320} />
      </View>
    </View>
  );
}
