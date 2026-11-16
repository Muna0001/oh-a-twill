import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ColorKey } from '@/engine';
import { Swatch, Text, useTheme } from '@/ui';

import { weaveCopy } from './copy';
import { colorOrderParts, describeColorOrder } from './helpers';

export type ColorOrderProps = {
  /** One repeat of the colour order: across the warps, or up the rows (row 1 first). */
  order: readonly ColorKey[];
  /** [Color A, Color B] yarn colours. */
  colors: readonly [string, string];
  /** 'warp' draws upright threads numbered left to right; 'weft' a stack of bands, row 1 at the bottom. */
  kind: 'warp' | 'weft';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Widest a thread or band label column gets. */
const MAX_THREAD = 22;
const THREAD_HEIGHT = 44;
const BAND_HEIGHT = 12;
const BAND_WIDTH = 132;
const LABEL_WIDTH = 22;

/**
 * One repeat of a warp or weft colour order: a small picture in the real yarn colours
 * (decorative, hidden from screen readers) and the grouped wording, which is the accessible content.
 */
export const ColorOrder = memo(function ColorOrder({ order, colors, kind, style, testID }: ColorOrderProps) {
  const theme = useTheme();
  const parts = useMemo(() => colorOrderParts(order, kind), [order, kind]);
  const sentence = useMemo(() => describeColorOrder(order, kind), [order, kind]);
  const repeat = kind === 'warp' ? weaveCopy.colorOrder.repeatWarp : weaveCopy.colorOrder.repeatWeft;
  const outline = { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.stone };

  const picture =
    kind === 'warp' ? (
      <View style={{ flexDirection: 'row', gap: 3, alignSelf: 'stretch' }}>
        {order.map((k, i) => (
          <View key={i} style={{ flexGrow: 1, flexShrink: 1, flexBasis: MAX_THREAD, maxWidth: MAX_THREAD, alignItems: 'center', gap: 4 }}>
            <View style={[{ alignSelf: 'stretch', height: THREAD_HEIGHT, borderRadius: 3, backgroundColor: colors[k] }, outline]} />
            {/* Wider than a narrow thread so "10" never gets cut short; it overhangs both sides evenly. */}
            <Text variant="caption" tabular align="center" maxFontSizeMultiplier={1.2} style={{ width: 24, marginHorizontal: -8, fontSize: 11, lineHeight: 14, letterSpacing: -0.3 }}>
              {i + 1}
            </Text>
          </View>
        ))}
      </View>
    ) : (
      <View style={{ gap: 2, alignSelf: 'flex-start' }}>
        {order
          .map((k, i) => ({ k, row: i + 1 }))
          .reverse()
          .map(({ k, row }) => (
            <View key={row} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text variant="caption" tabular align="right" maxFontSizeMultiplier={1.2} style={{ width: LABEL_WIDTH, fontSize: 11, lineHeight: BAND_HEIGHT + 2 }}>
                {row}
              </Text>
              <View style={[{ width: BAND_WIDTH, height: BAND_HEIGHT, borderRadius: 2, backgroundColor: colors[k] }, outline]} />
            </View>
          ))}
      </View>
    );

  return (
    <View testID={testID} style={[{ gap: theme.spacing.md }, style]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[theme.cards.well, { padding: theme.spacing.md, alignSelf: kind === 'warp' ? 'stretch' : 'flex-start' }]}>
        {picture}
      </View>
      <Text accessibilityLabel={`${sentence}. ${repeat}`}>
        {parts.map((p, i) =>
          'text' in p ? (
            p.text
          ) : (
            <Text key={i} weight="semibold">
              <Swatch color={colors[p.color]} size={14} radius={4} style={{ marginRight: 4, borderColor: theme.colors.stone, transform: [{ translateY: 2 }] }} />
              {weaveCopy.colorName(p.color)}
            </Text>
          ),
        )}
        {`. ${repeat}`}
      </Text>
    </View>
  );
});
