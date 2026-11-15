import { memo, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { back, cellKey, type PatternSetup, type Structure } from '@/engine';
import { radii } from '@/ui';

import { mergeRuns } from './helpers';

/** Units per cell in the viewBox, as in the reference's previewSVG. */
const S = 6;

export type TilePreviewProps = {
  stitch: Structure;
  /** [Color A (weft), Color B (warp)] yarn colours. */
  colors: readonly [string, string];
  /** Default 12. */
  cols?: number;
  /** Default 10. */
  rows?: number;
  /** 'back' shows the cloth from behind: every cell inverted. Default 'front'. */
  face?: 'front' | 'back';
  /** Reverse every tile row. Default false. */
  mirror?: boolean;
  /** Size it here (e.g. a width); the height follows from cols : rows. Default: full width. */
  style?: StyleProp<ViewStyle>;
  /** Set to have screen readers announce the preview; otherwise it is hidden from them. */
  accessibilityLabel?: string;
  testID?: string;
};

/** The woven thumbnail of a stitch. Always starts at tile row 0, with row 1 at the bottom. */
export const TilePreview = memo(function TilePreview({ stitch, colors, cols = 12, rows = 10, face = 'front', mirror = false, style, accessibilityLabel, testID }: TilePreviewProps) {
  const [a, b] = colors;
  const { rects, grid } = useMemo(() => {
    const s = face === 'back' ? back(stitch) : stitch;
    const setup: PatternSetup = { start: 0, mirror, side: 'left' };
    const pair = [a, b];
    const out: { key: string; x: number; y: number; w: number; fill: string }[] = [];
    for (let r = 0; r < rows; r++) {
      for (const run of mergeRuns(cols, (w) => pair[cellKey(s, setup, w, r + 1)])) {
        out.push({ key: `${r}-${run.x}`, x: run.x * S, y: (rows - 1 - r) * S, w: run.n * S, fill: run.color });
      }
    }
    let d = '';
    for (let x = 1; x < cols; x++) d += `M${x * S} 0V${rows * S}`;
    for (let y = 1; y < rows; y++) d += `M0 ${y * S}H${cols * S}`;
    return { rects: out, grid: d };
  }, [stitch, a, b, cols, rows, face, mirror]);
  return (
    <View
      testID={testID}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      style={[{ width: '100%', aspectRatio: cols / rows, borderRadius: radii.frame, overflow: 'hidden' }, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${cols * S} ${rows * S}`} preserveAspectRatio="none">
        {rects.map((r) => (
          <Rect key={r.key} x={r.x} y={r.y} width={r.w} height={S} fill={r.fill} />
        ))}
        <Path d={grid} stroke="rgba(0,0,0,0.16)" strokeWidth={0.5} fill="none" />
        <Rect x={0.25} y={0.25} width={cols * S - 0.5} height={rows * S - 0.5} stroke="rgba(0,0,0,0.16)" strokeWidth={0.5} fill="none" />
      </Svg>
    </View>
  );
});
