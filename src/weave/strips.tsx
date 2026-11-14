import { createContext, memo, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { ScrollView, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Text, useTheme } from '@/ui';

import { useAvailableWidth } from './GridView';
import { mergeRuns, warpNumberLabels, type ColorRun } from './helpers';

/** Height of a full-size strip (3.25rem in the reference). */
const STRIP_HEIGHT = 52;
/** Share of a cell taken by the warp thread. */
const THREAD = 0.58;
const SHADE = 'rgba(0,0,0,0.15)';
/** Room for a three-digit number centred under the first or last warp. */
const EDGE_PAD = 6;

const StripContext = createContext<number | null>(null);

function useStripCell(count: number, cellMin: number, cell?: number): { cell: number; onLayout?: (e: LayoutChangeEvent) => void } {
  const shared = useContext(StripContext);
  const [width, onLayout] = useAvailableWidth();
  if (shared != null) return { cell: shared };
  if (cell != null) return { cell };
  return { cell: Math.max(cellMin, width / Math.max(1, count)), onLayout };
}

export type StripScrollerProps = {
  /** Number of warps. */
  count: number;
  /** Narrowest a warp may get before the strip scrolls sideways instead. Default 10. */
  cellMin?: number;
  /** A strip and its `WarpNumbers`; they share one cell width and scroll together. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Sizes the strips inside it to the available width and scrolls them sideways when 10 px warps do not fit. */
export function StripScroller({ count, cellMin = 10, children, style, testID }: StripScrollerProps) {
  const [width, onLayout] = useAvailableWidth();
  const scrolls = count * cellMin > width;
  const cell = scrolls ? cellMin : width / Math.max(1, count);
  return (
    <View onLayout={onLayout} style={[{ alignSelf: 'stretch' }, style]}>
      <StripContext.Provider value={cell}>
        {scrolls ? (
          <ScrollView horizontal testID={testID} contentContainerStyle={{ paddingHorizontal: EDGE_PAD, paddingBottom: 6 }}>
            <View style={{ width: count * cell }}>{children}</View>
          </ScrollView>
        ) : (
          <View testID={testID}>{children}</View>
        )}
      </StripContext.Provider>
    </View>
  );
}

function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${x + rr} ${y}h${w - 2 * rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${h - 2 * rr}a${rr} ${rr} 0 0 1 ${-rr} ${rr}h${-(w - 2 * rr)}a${rr} ${rr} 0 0 1 ${-rr} ${-rr}v${-(h - 2 * rr)}a${rr} ${rr} 0 0 1 ${rr} ${-rr}z`;
}

type Layer = { fills: { color: string; d: string }[]; shade: string };

/** The threads of one layer (behind or in front of the weft), as one path per colour. */
function threadLayer(front: boolean, over: readonly boolean[], colorOf: (i: number) => string, cell: number, height: number): Layer {
  const byColor = new Map<string, string>();
  let shade = '';
  const w = cell * THREAD;
  const sw = Math.min(2, w / 3);
  const r = Math.min(3, height / 8);
  over.forEach((o, i) => {
    // The weft passes OVER this warp, so the warp is behind; under, the warp is in front.
    if (o === front) return;
    const x = i * cell + (cell - w) / 2;
    const color = colorOf(i);
    byColor.set(color, (byColor.get(color) ?? '') + roundRect(x, 0, w, height, r));
    shade += `M${x + w - sw} ${r / 2}h${sw}v${height - r}h${-sw}z`;
  });
  return { fills: [...byColor].map(([color, d]) => ({ color, d })), shade };
}

type StripSvgProps = {
  cell: number;
  height: number;
  over: readonly boolean[];
  warpColorAt: (i: number) => string;
  shadeColor: string;
  /** Weft colour runs, left to right. */
  weft: ColorRun[];
  /** One rounded yarn with an outline (pattern) or square colour segments with edge lines (picture). */
  framed: boolean;
  testID?: string;
};

const StripSvg = memo(function StripSvg({ cell, height, over, warpColorAt, shadeColor, weft, framed, testID }: StripSvgProps) {
  const count = over.length;
  const width = count * cell;
  const weftH = Math.max(5, Math.round(height * 0.25));
  const weftY = (height - weftH) / 2;
  const back = threadLayer(false, over, warpColorAt, cell, height);
  const front = threadLayer(true, over, warpColorAt, cell, height);
  const layer = (l: Layer, name: string) => (
    <>
      {l.fills.map((f) => (
        <Path key={`${name}-${f.color}`} d={f.d} fill={f.color} />
      ))}
      {l.shade ? <Path d={l.shade} fill={shadeColor} /> : null}
    </>
  );
  return (
    <Svg
      testID={testID}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {layer(back, 'back')}
      {framed ? (
        <Rect x={0.5} y={weftY + 0.5} width={Math.max(0, width - 1)} height={weftH - 1} rx={4} fill={weft[0]?.color ?? 'none'} stroke={SHADE} strokeWidth={1} />
      ) : (
        <>
          {weft.map((r) => (
            <Rect key={r.x} x={r.x * cell} y={weftY} width={r.n * cell} height={weftH} fill={r.color} />
          ))}
          <Path d={`M0 ${weftY + 0.5}H${width}M0 ${weftY + weftH - 0.5}H${width}`} stroke="rgba(0,0,0,0.12)" strokeWidth={1} fill="none" />
        </>
      )}
      {layer(front, 'front')}
    </Svg>
  );
});

export type WarpStripProps = {
  /** Per warp, left to right: true = the weft goes over (weft drawn in front). */
  states: readonly boolean[];
  /** Yarn colour of each warp (see `warpColorsFor`). */
  warpColors: readonly string[];
  weftColor: string;
  /** Narrowest warp when the strip sizes itself. Default 10. Ignored inside a `StripScroller`. */
  cellMin?: number;
  /** Fixed warp width in px, for mini strips. Ignored inside a `StripScroller`. */
  cell?: number;
  /** Default 52. */
  height?: number;
  testID?: string;
};

/** The picture of one pattern row: warp threads with the weft passing over or under each. */
export function WarpStrip({ states, warpColors, weftColor, cellMin = 10, cell: fixed, height = STRIP_HEIGHT, testID }: WarpStripProps) {
  const { cell, onLayout } = useStripCell(states.length, cellMin, fixed);
  const weft = useMemo<ColorRun[]>(() => [{ x: 0, n: states.length, color: weftColor }], [states.length, weftColor]);
  const warpColorAt = useCallback((i: number) => warpColors[i % warpColors.length], [warpColors]);
  const svg = <StripSvg testID={testID} cell={cell} height={height} over={states} warpColorAt={warpColorAt} shadeColor={SHADE} weft={weft} framed />;
  return onLayout ? (
    <View onLayout={onLayout} style={{ alignSelf: 'stretch', overflow: 'hidden' }}>
      {svg}
    </View>
  ) : (
    svg
  );
}

export type PictureStripProps = {
  /** Palette index per warp, left to right. */
  cells: readonly number[];
  /** Per warp: true = the weft goes over. */
  over: readonly boolean[];
  /** Hex colour per palette index. */
  palette: readonly string[];
  cellMin?: number;
  cell?: number;
  height?: number;
  testID?: string;
};

/** The picture of one picture row: neutral warps, with the weft's colour sections over and under them. */
export function PictureStrip({ cells, over, palette, cellMin = 10, cell: fixed, height = STRIP_HEIGHT, testID }: PictureStripProps) {
  const theme = useTheme();
  const { cell, onLayout } = useStripCell(cells.length, cellMin, fixed);
  const weft = useMemo(() => mergeRuns(cells.length, (x) => palette[cells[x]] ?? 'transparent'), [cells, palette]);
  const warp = theme.colors.warp;
  const warpColorAt = useCallback(() => warp, [warp]);
  const svg = <StripSvg testID={testID} cell={cell} height={height} over={over} warpColorAt={warpColorAt} shadeColor={theme.colors.warpShade} weft={weft} framed={false} />;
  return onLayout ? (
    <View onLayout={onLayout} style={{ alignSelf: 'stretch', overflow: 'hidden' }}>
      {svg}
    </View>
  ) : (
    svg
  );
}

export type WarpNumbersProps = {
  /** Number of warps. */
  count: number;
  cellMin?: number;
  cell?: number;
  testID?: string;
};

const NUM_BOX = 30;

/** Warp numbers under a strip: all of them up to 32 warps, otherwise 1, every 5th and the last. */
export function WarpNumbers({ count, cellMin = 10, cell: fixed, testID }: WarpNumbersProps) {
  const { cell, onLayout } = useStripCell(count, cellMin, fixed);
  const labels = useMemo(() => warpNumberLabels(count), [count]);
  return (
    <View
      testID={testID}
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: 16, marginTop: 4, width: onLayout ? undefined : count * cell, alignSelf: onLayout ? 'stretch' : undefined }}>
      {labels.map((n) => (
        <Text
          key={n}
          variant="hint"
          tabular
          align="center"
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
          style={{ position: 'absolute', top: 0, left: (n - 0.5) * cell - NUM_BOX / 2, width: NUM_BOX, fontSize: 11, lineHeight: 16 }}>
          {n}
        </Text>
      ))}
    </View>
  );
}
