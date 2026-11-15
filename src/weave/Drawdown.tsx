import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';

import { cellKey, type PatternSetup, type Structure } from '@/engine';
import { Text, useTheme } from '@/ui';

import { weaveCopy } from './copy';
import { GridView, RowPressOverlay, fitCell, useAvailableWidth } from './GridView';

/** Width of the row-number column (fits "120"). */
const LABELS = 28;
const GAP = 2;
/** Room around the rows for the current-row outline. */
const PAD = 3;
/**
 * Inside padding of the `surfaceAlt` well: roomy above and below; at the sides the label column
 * and PAD give the inset, so 24 warps still fit a 390 pt phone without scrolling.
 */
const WELL_PAD = { paddingVertical: 8, paddingHorizontal: 2 } as const;

export type DrawdownProps = {
  stitch: Structure;
  setup: PatternSetup;
  warps: number;
  /** [Color A, Color B] yarn colours. */
  colors: readonly [string, string];
  /** The row being woven (1-based). */
  currentRow: number;
  /** Called with the row number (1-based) that was tapped. */
  onJump: (row: number) => void;
  /** Rows shown. Default 16. */
  windowSize?: number;
  testID?: string;
};

/**
 * The cloth around the current row: 16 rows starting 9 below it, row 1 at the bottom, in a
 * `surfaceAlt` well. The current row is framed in papaya, rows already woven are faded, and
 * tapping a row jumps to it.
 */
export function Drawdown({ stitch, setup, warps, colors, currentRow, onJump, windowSize = 16, testID }: DrawdownProps) {
  const theme = useTheme();
  const [width, onLayout] = useAvailableWidth();
  const [a, b] = colors;
  const start = Math.max(1, currentRow - 9);
  const end = start + windowSize - 1;
  const cell = fitCell(width - LABELS - 2 * PAD, warps, GAP, 9, 28);
  const pitch = cell + GAP;
  const gridWidth = warps * pitch - GAP;
  const height = windowSize * pitch - GAP;

  const colorAt = useCallback((x: number, y: number) => (cellKey(stitch, setup, x, end - y) === 0 ? a : b), [stitch, setup, a, b, end]);
  const dimRows = useCallback((y: number) => end - y < currentRow, [end, currentRow]);
  const pressRow = useCallback((y: number) => onJump(end - y), [onJump, end]);
  const rowLabel = useCallback((y: number) => weaveCopy.rowValue(end - y), [end]);

  const yCurrent = end - currentRow;
  const labelSize = Math.min(11.5, cell + 1);
  return (
    <View style={[{ alignSelf: 'stretch' }, WELL_PAD, theme.cards.well]}>
      <View onLayout={onLayout} style={{ alignSelf: 'stretch' }}>
        <ScrollView horizontal contentContainerStyle={{ padding: PAD }}>
          <View style={{ flexDirection: 'row', width: LABELS + gridWidth, height }}>
            <View style={{ width: LABELS }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {Array.from({ length: windowSize }, (_, y) => {
                const r = end - y;
                const current = r === currentRow;
                return (
                  <Text
                    key={r}
                    tabular
                    allowFontScaling={false}
                    numberOfLines={1}
                    align="right"
                    color={current ? 'ink' : 'muted'}
                    weight={current ? 'semibold' : 'regular'}
                    style={{ position: 'absolute', top: y * pitch, right: 4, left: 0, height: cell, fontSize: labelSize, lineHeight: cell }}>
                    {r}
                  </Text>
                );
              })}
            </View>
            <GridView testID={testID ? `${testID}-grid` : undefined} cols={warps} rows={windowSize} colorAt={colorAt} cell={cell} gap={GAP} dimRows={dimRows} dimOpacity={0.55} />
            {yCurrent >= 0 && yCurrent < windowSize ? (
              <View
                testID={testID ? `${testID}-current` : undefined}
                pointerEvents="none"
                style={{ position: 'absolute', left: -2, right: -2, top: yCurrent * pitch - 2, height: cell + 4, borderWidth: 2, borderColor: theme.colors.papaya, borderRadius: theme.radii.frame }}
              />
            ) : null}
            <RowPressOverlay testID={testID} rows={windowSize} pitch={pitch} onPressRow={pressRow} currentRow={yCurrent} rowLabel={rowLabel} accessibilityLabel={weaveCopy.drawdownLabel} />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
