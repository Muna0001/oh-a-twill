import { useMemo } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';

import { period, repWidth, rowInfo, type PatternSetup, type Structure } from '@/engine';
import { Text } from '@/ui';

import { weaveCopy } from './copy';
import { repeatRowLabels, warpColorsFor } from './helpers';
import { WarpStrip } from './strips';

const MINI_CELL = 14;
const MINI_HEIGHT = 30;

export type RepeatListProps = {
  stitch: Structure;
  setup: PatternSetup;
  /** [Color A, Color B] yarn colours. */
  colors: readonly [string, string];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Every row of one repeat written out, each with a mini strip one repeat wide. */
export function RepeatList({ stitch, setup, colors, style, testID }: RepeatListProps) {
  const [a, b] = colors;
  const rows = useMemo(() => {
    const pair: [string, string] = [a, b];
    const width = repWidth(stitch);
    const warpColors = warpColorsFor(stitch, width, pair);
    const labels = repeatRowLabels(stitch, setup);
    return Array.from({ length: period(stitch) }, (_, j) => {
      const info = rowInfo(stitch, setup, width, j + 1);
      return { n: j + 1, label: labels[j], states: info.states, weftColor: pair[info.weftKey], warpColors };
    });
  }, [stitch, setup, a, b]);
  // Wide tiles have no short name ("Row 3" says nothing new), so only the strip is shown.
  const named = stitch.tile[0].length <= 6;
  return (
    <View testID={testID} accessibilityRole="list" accessibilityLabel={weaveCopy.repeatLabel} style={[{ gap: 12 }, style]}>
      {rows.map((r) => (
        <View key={r.n} accessible accessibilityLabel={named ? `${r.n}. ${r.label}` : r.label} style={{ gap: 4 }}>
          {named ? (
            <Text>
              <Text weight="semibold" tabular>
                {weaveCopy.repeatRowNumber(r.n)}
              </Text>{' '}
              {r.label}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {named ? null : (
              <Text weight="semibold" tabular style={{ minWidth: 24 }}>
                {weaveCopy.repeatRowNumber(r.n)}
              </Text>
            )}
            <ScrollView horizontal style={{ flexGrow: 0, flexShrink: 1 }}>
              <WarpStrip states={r.states} warpColors={r.warpColors} weftColor={r.weftColor} cell={MINI_CELL} height={MINI_HEIGHT} />
            </ScrollView>
          </View>
        </View>
      ))}
    </View>
  );
}
