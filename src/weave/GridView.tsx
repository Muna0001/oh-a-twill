import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/ui';

import { mergeRuns, type ColorRun } from './helpers';

/** Rows drawn by one memoised band (its own small Svg). */
export const BAND_ROWS = 20;
const LINE_COLOR = 'rgba(0,0,0,0.08)';

export type GridViewProps = {
  cols: number;
  rows: number;
  /**
   * Colour of the cell at column `x`, row `y` (y = 0 is the top row). Keep this function's
   * identity stable (useCallback): a new function redraws every band.
   */
  colorAt: (x: number, y: number) => string;
  /** Cell size in px. Default: fits the available width, between `minCell` and `maxCell`. */
  cell?: number;
  /** Smallest automatic cell size. Default 6. When the grid is wider than the space it scrolls sideways. */
  minCell?: number;
  /** Largest automatic cell size. Default 32. */
  maxCell?: number;
  /** Space between cells in px. Default 0. */
  gap?: number;
  /** Row (y index) framed in the theme's papaya (`mark`): 2 px, radius 4. */
  highlightRow?: number;
  /** Rows drawn at `dimOpacity`. */
  dimRows?: (y: number) => boolean;
  /** Default 0.55. */
  dimOpacity?: number;
  /** Makes rows tappable; called with the y index. */
  onPressRow?: (y: number) => void;
  /** Screen reader text for a row, e.g. "Row 12". Read out as the grid's value for `highlightRow`. */
  rowLabel?: (y: number) => string;
  /** Names the grid for screen readers. */
  accessibilityLabel?: string;
  /** Thin vertical lines between warps. Default false. */
  lines?: boolean;
  testID?: string;
};

type BandProps = {
  y0: number;
  y1: number;
  cols: number;
  cell: number;
  gap: number;
  colorAt: (x: number, y: number) => string;
  /** One character per row: '1' = dimmed. A string so that an unchanged band skips rendering. */
  dimMask: string;
  dimOpacity: number;
  lines: boolean;
};

type RowBlock = { y: number; h: number; runs: ColorRun[]; key: string; dim: boolean };

const runsKey = (runs: ColorRun[]): string => runs.map((r) => `${r.n}${r.color}`).join('|');

/** Rows of one band as blocks; identical neighbouring rows are merged when there is no gap. */
export function bandBlocks(cols: number, y0: number, y1: number, colorAt: (x: number, y: number) => string, dimMask: string, mergeRows: boolean): RowBlock[] {
  const blocks: RowBlock[] = [];
  for (let y = y0; y < y1; y++) {
    const runs = mergeRuns(cols, (x) => colorAt(x, y));
    const key = runsKey(runs);
    const dim = dimMask[y - y0] === '1';
    const last = blocks[blocks.length - 1];
    if (mergeRows && last && last.key === key && last.dim === dim) last.h++;
    else blocks.push({ y, h: 1, runs, key, dim });
  }
  return blocks;
}

const Band = memo(function Band({ y0, y1, cols, cell, gap, colorAt, dimMask, dimOpacity, lines }: BandProps) {
  const pitch = cell + gap;
  const width = cols * pitch - gap;
  const height = (y1 - y0) * pitch;
  const blocks = bandBlocks(cols, y0, y1, colorAt, dimMask, gap === 0);
  const draw = (b: RowBlock): ReactNode[] =>
    b.runs.map((r) => {
      const top = (b.y - y0) * pitch;
      if (gap === 0) return <Rect key={`${b.y}-${r.x}`} x={r.x * cell} y={top} width={r.n * cell} height={b.h * cell} fill={r.color} />;
      // One dashed line per run keeps the gaps between cells without one node per cell.
      const x1 = r.x * pitch;
      return (
        <Line
          key={`${b.y}-${r.x}`}
          x1={x1}
          x2={x1 + r.n * pitch - gap}
          y1={top + cell / 2}
          y2={top + cell / 2}
          stroke={r.color}
          strokeWidth={cell}
          strokeDasharray={r.n > 1 ? [cell, gap] : undefined}
        />
      );
    });
  const plain = blocks.filter((b) => !b.dim);
  const dimmed = blocks.filter((b) => b.dim);
  let linePath = '';
  if (lines) for (let x = 1; x < cols; x++) linePath += `M${x * pitch - gap / 2 + 0.5} 0V${height}`;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {plain.map(draw)}
      {dimmed.length ? <G opacity={dimOpacity}>{dimmed.map(draw)}</G> : null}
      {linePath ? <Path d={linePath} stroke={LINE_COLOR} strokeWidth={1} fill="none" /> : null}
    </Svg>
  );
});

export type RowPressOverlayProps = {
  rows: number;
  /** Height of one row including the gap. */
  pitch: number;
  onPressRow: (y: number) => void;
  /** Row the screen reader's increment / decrement actions step from. */
  currentRow?: number;
  rowLabel?: (y: number) => string;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * One transparent layer over a grid that turns a press into a row index, instead of a
 * pressable per row. Screen readers get an adjustable: increment moves up a row.
 */
export function RowPressOverlay({ rows, pitch, onPressRow, currentRow, rowLabel, accessibilityLabel, testID }: RowPressOverlayProps) {
  const press = useCallback(
    (e: GestureResponderEvent) => {
      // Native gives locationY; on web a press is a click, which carries offsetY instead.
      const native = e.nativeEvent as { locationY?: number; offsetY?: number };
      const y = Math.floor((native.locationY ?? native.offsetY ?? NaN) / pitch);
      if (Number.isFinite(y)) onPressRow(Math.min(rows - 1, Math.max(0, y)));
    },
    [pitch, rows, onPressRow],
  );
  const hasCurrent = currentRow != null && currentRow >= 0 && currentRow < rows;
  return (
    <Pressable
      testID={testID}
      onPress={press}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={hasCurrent && rowLabel ? { text: rowLabel(currentRow) } : undefined}
      accessibilityActions={hasCurrent ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
      onAccessibilityAction={(e) => {
        if (!hasCurrent) return;
        const next = currentRow + (e.nativeEvent.actionName === 'increment' ? -1 : 1);
        if (next >= 0 && next < rows) onPressRow(next);
      }}
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, cursor: 'pointer' }}
    />
  );
}

/** A guess at the usable width before the first layout pass (screen minus screen and panel padding). */
export function useAvailableWidth(): [number, (e: LayoutChangeEvent) => void] {
  const { width: windowWidth } = useWindowDimensions();
  const theme = useTheme();
  const [measured, setMeasured] = useState<number | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 0) setMeasured((prev) => (prev === w ? prev : w));
  }, []);
  // Screen gutters, card padding and a strip or grid well's padding.
  const guess = Math.max(120, Math.min(windowWidth, theme.maxContentWidth) - 2 * (theme.spacing.gutter + theme.spacing.card + 12) - 2);
  return [measured ?? guess, onLayout];
}

/** Whole-pixel cell size that fits `cols` cells (and their gaps) into `width`. */
export function fitCell(width: number, cols: number, gap: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor((width - (cols - 1) * gap) / cols)));
}

type GridBodyProps = Omit<GridViewProps, 'cell' | 'minCell' | 'maxCell'> & { cell: number };

const GridBody = memo(function GridBody({ cols, rows, colorAt, cell, gap = 0, highlightRow, dimRows, dimOpacity = 0.55, onPressRow, rowLabel, accessibilityLabel, lines = false, testID }: GridBodyProps) {
  const theme = useTheme();
  const pitch = cell + gap;
  const width = cols * pitch - gap;
  const height = rows * pitch - gap;
  const bands = useMemo(() => {
    const out: { y0: number; y1: number; dimMask: string }[] = [];
    for (let y0 = 0; y0 < rows; y0 += BAND_ROWS) {
      const y1 = Math.min(rows, y0 + BAND_ROWS);
      let dimMask = '';
      if (dimRows) for (let y = y0; y < y1; y++) dimMask += dimRows(y) ? '1' : '0';
      out.push({ y0, y1, dimMask });
    }
    return out;
  }, [rows, dimRows]);
  const showMark = highlightRow != null && highlightRow >= 0 && highlightRow < rows;
  return (
    <View
      testID={testID}
      accessibilityRole={onPressRow ? undefined : 'image'}
      accessibilityLabel={onPressRow ? undefined : accessibilityLabel}
      style={{ width, height, overflow: 'hidden' }}>
      {bands.map((b) => (
        <Band key={b.y0} y0={b.y0} y1={b.y1} cols={cols} cell={cell} gap={gap} colorAt={colorAt} dimMask={b.dimMask} dimOpacity={dimOpacity} lines={lines} />
      ))}
      {showMark ? (
        <View
          testID={testID ? `${testID}-mark` : undefined}
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: highlightRow * pitch, width, height: cell, borderWidth: 2, borderColor: theme.colors.papaya, borderRadius: Math.min(4, cell / 2) }}
        />
      ) : null}
      {onPressRow ? (
        <RowPressOverlay
          testID={testID ? `${testID}-press` : undefined}
          rows={rows}
          pitch={pitch}
          onPressRow={onPressRow}
          currentRow={highlightRow}
          rowLabel={rowLabel}
          accessibilityLabel={accessibilityLabel}
        />
      ) : null}
    </View>
  );
});

/**
 * A grid of coloured cells drawn with react-native-svg. Equal neighbours in a row become one
 * rect, equal neighbouring rows become one taller rect, and rows are drawn in memoised bands
 * so a 120 × 400 picture stays a few hundred nodes.
 */
export function GridView({ cell, minCell = 6, maxCell = 32, ...rest }: GridViewProps) {
  if (cell != null) return <GridBody {...rest} cell={cell} />;
  return <FittedGrid {...rest} minCell={minCell} maxCell={maxCell} />;
}

function FittedGrid({ minCell, maxCell, ...rest }: Omit<GridViewProps, 'cell'> & { minCell: number; maxCell: number }) {
  const [width, onLayout] = useAvailableWidth();
  const gap = rest.gap ?? 0;
  const cell = fitCell(width, rest.cols, gap, minCell, maxCell);
  const scrolls = rest.cols * (cell + gap) - gap > width;
  const body = <GridBody {...rest} cell={cell} />;
  return (
    <View onLayout={onLayout} style={{ alignSelf: 'stretch' }}>
      {scrolls ? (
        <ScrollView horizontal nestedScrollEnabled>
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </View>
  );
}
