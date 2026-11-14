import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { PatternStats } from '@/engine';
import { Text, useTheme } from '@/ui';

import { mathItems, mathText } from './helpers';

export type MathPanelProps = {
  stats: PatternStats;
  /** The warp count the stats were worked out for. */
  warps: number;
  /** Length of the stitch's warp colour order (`stitch.warp?.length`); needed for colour-and-weave stitches. */
  colorWarpLength?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** "The math": five short facts about the pattern at this warp count. Put it inside a `Collapsible`. */
export function MathPanel({ stats, warps, colorWarpLength, style, testID }: MathPanelProps) {
  const theme = useTheme();
  const items = mathItems(stats, warps, colorWarpLength);
  return (
    <View testID={testID} style={[{ gap: 14 }, style]}>
      {items.map((item) => (
        <View key={item.title} accessible accessibilityLabel={`${item.title}. ${mathText(item)}`} style={{ borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 12 }}>
          <Text weight="semibold">{item.title}</Text>
          <Text color="muted" style={{ marginTop: 2 }}>
            {item.parts.map((p, i) =>
              p.bold ? (
                <Text key={i} weight="semibold" color="ink">
                  {p.text}
                </Text>
              ) : (
                p.text
              ),
            )}
          </Text>
        </View>
      ))}
    </View>
  );
}
