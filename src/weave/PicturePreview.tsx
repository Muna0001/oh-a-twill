import { useCallback, useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import type { PictureGrid } from '@/engine';

import { weaveCopy } from './copy';
import { GridView, fitCell, useAvailableWidth } from './GridView';

export type PicturePreviewProps = {
  pic: PictureGrid;
  /** The row being woven (1-based, row 1 is the bottom). `pic.H + 1` means finished. */
  currentRow: number;
  /** Called with the row number (1-based) that was tapped. */
  onJump: (row: number) => void;
  /** Tallest the preview gets before it scrolls. Default 70% of the window height. */
  maxHeight?: number;
  testID?: string;
};

/**
 * The whole picture as it will be woven. The current row is outlined, rows still to weave
 * (above it) are lightened, tapping a row jumps to it, and it keeps the current row in view.
 */
export function PicturePreview({ pic, currentRow, onJump, maxHeight, testID }: PicturePreviewProps) {
  const { W, H } = pic;
  const window = useWindowDimensions();
  const [width, onLayout] = useAvailableWidth();
  const cell = fitCell(width, W, 0, 6, 28);
  const limit = maxHeight ?? Math.round(window.height * 0.7);
  const viewport = Math.min(limit, H * cell);
  const finished = currentRow > H;
  const yCurrent = H - currentRow;

  const colorAt = useCallback((x: number, y: number) => pic.palette[pic.grid[y * pic.W + x]]?.hex ?? '#000000', [pic]);
  const dimRows = useMemo(() => (finished ? undefined : (y: number) => y < yCurrent), [finished, yCurrent]);
  const pressRow = useCallback((y: number) => onJump(H - y), [onJump, H]);
  const rowLabel = useCallback((y: number) => weaveCopy.rowValue(H - y), [H]);

  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    if (finished) return;
    scroller.current?.scrollTo({ y: Math.max(0, yCurrent * cell - viewport / 2), animated: false });
  }, [finished, yCurrent, cell, viewport]);

  const grid = (
    // White underneath, so that the faded rows get lighter in the dark theme too.
    <View style={{ backgroundColor: '#FFFFFF', alignSelf: 'flex-start' }}>
      <GridView
        testID={testID}
        cols={W}
        rows={H}
        colorAt={colorAt}
        cell={cell}
        lines
        highlightRow={finished ? undefined : yCurrent}
        dimRows={dimRows}
        dimOpacity={0.65}
        onPressRow={pressRow}
        rowLabel={rowLabel}
        accessibilityLabel={weaveCopy.previewLabel}
      />
    </View>
  );
  return (
    <View onLayout={onLayout} style={{ alignSelf: 'stretch' }}>
      <ScrollView ref={scroller} nestedScrollEnabled testID={testID ? `${testID}-scroll` : undefined} style={{ maxHeight: limit, borderRadius: 6, alignSelf: 'flex-start', width: Math.min(W * cell, width) }}>
        {W * cell > width ? (
          <ScrollView horizontal nestedScrollEnabled>
            {grid}
          </ScrollView>
        ) : (
          grid
        )}
      </ScrollView>
    </View>
  );
}
