import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { PaletteColor, Run, Section } from '@/engine';
import { Chip, Icon, Swatch, Text, Tip, useTheme } from '@/ui';

import { weaveCopy } from './copy';
import { stepsSentence } from './helpers';

const listStyle: ViewStyle = { flexDirection: 'row', flexWrap: 'wrap', gap: 8 };
/** Steps and sections: radius 14 (not pills), so they read as steps. */
const boxStyle: ViewStyle = { alignItems: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, minWidth: 76 };

export type StepChipsProps = {
  /** In travel order (`RowInfo.runs`). */
  runs: readonly Run[];
  /** Row number, for the screen reader sentence. */
  row: number;
  /** Direction, for the screen reader sentence. */
  ltr: boolean;
  /** Yarn colour of this row's weft; shown as a small swatch on the "Over" chips. */
  weftColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** What to do across the row, in the order you weave it. Read by screen readers as one sentence. */
export function StepChips({ runs, row, ltr, weftColor, style, testID }: StepChipsProps) {
  const { colors } = useTheme();
  const sentence = stepsSentence(runs, row, ltr);
  return (
    <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={sentence} style={[listStyle, style]}>
      {runs.map((x) => {
        const ink = x.over ? colors.weftInk : colors.ink;
        return (
          <View
            key={x.from}
            testID={testID ? `${testID}-step` : undefined}
            style={[boxStyle, { backgroundColor: x.over ? colors.weft : colors.underChip, borderColor: x.over ? colors.weft : colors.line }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {x.over && weftColor ? <Swatch color={weftColor} size={12} style={{ borderColor: colors.weftInk }} /> : null}
              <Text weight="semibold" color={ink} style={{ fontSize: 17, lineHeight: 24, letterSpacing: -0.2 }}>
                {weaveCopy.word(x.over, x.n)}
              </Text>
            </View>
            <Text variant="caption" tabular color={ink} style={{ opacity: 0.8 }}>
              {weaveCopy.warpRange(x.from, x.to)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export type SectionChipsProps = {
  sections: readonly Section[];
  palette: readonly PaletteColor[];
  /** Row number, for the list's screen reader label. */
  row?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** The colour sections of a picture row, left to right: swatch, colour name, warps and how to start. */
export function SectionChips({ sections, palette, row, style, testID }: SectionChipsProps) {
  const { colors } = useTheme();
  return (
    <View testID={testID} accessibilityRole="list" accessibilityLabel={row == null ? weaveCopy.sectionsLabelNoRow : weaveCopy.sectionsLabel(row)} style={[listStyle, style]}>
      {sections.map((s) => {
        const color = palette[s.color];
        const name = color?.name ?? '';
        const detail = weaveCopy.sectionDetail(weaveCopy.warpRange(s.from, s.to), weaveCopy.word(s.startOver, s.startN).toLowerCase());
        return (
          <View
            key={s.from}
            accessible
            accessibilityLabel={`${name}, ${detail}`}
            testID={testID ? `${testID}-section` : undefined}
            style={[boxStyle, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Swatch color={color?.hex ?? 'transparent'} />
              <Text weight="semibold" style={{ fontSize: 17, lineHeight: 24, letterSpacing: -0.2 }}>
                {name}
              </Text>
            </View>
            <Text variant="caption" tabular color="graphite">
              {detail}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export type RepeatChipsProps = {
  /** One label per row of the repeat (see `repeatLabels`); the chips add "1. ", "2. " … */
  labels: readonly string[];
  /** Which row of the repeat is being woven, 1-based (`RowInfo.repeatRow`). */
  current: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** The rows of the repeat as small pills: the current one marigold, the others outlined. */
export function RepeatChips({ labels, current, style, testID }: RepeatChipsProps) {
  return (
    <View testID={testID} accessibilityRole="list" accessibilityLabel={weaveCopy.repeatLabel} style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, style]}>
      {labels.map((label, j) => (
        <Chip key={j} label={`${weaveCopy.repeatRowNumber(j + 1)} ${label}`} tone={j + 1 === current ? 'marigold' : 'outline'} />
      ))}
    </View>
  );
}

export type DirectionPillProps = {
  /** true = this row is woven left to right. */
  ltr: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** "Left to right →" or "← Right to left": a periwinkle pill with `pastelInk` text. */
export function DirectionPill({ ltr, style, testID }: DirectionPillProps) {
  const theme = useTheme();
  const label = ltr ? weaveCopy.leftToRight : weaveCopy.rightToLeft;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={[
        { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingVertical: 7, paddingHorizontal: 14, borderRadius: theme.radii.pill, backgroundColor: theme.colors.overChip },
        style,
      ]}>
      {ltr ? null : <Icon name="arrow-long-left" size={22} color="pastelInk" />}
      <Text weight="semibold" color="pastelInk" style={{ fontSize: 17, lineHeight: 24, letterSpacing: -0.2 }}>
        {label}
      </Text>
      {ltr ? <Icon name="arrow-long-right" size={22} color="pastelInk" /> : null}
    </View>
  );
}

export type EdgeTipProps = {
  /** The edge warp (1-based) the weft would miss (`RowInfo.edgeWarp`). */
  warp: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** The edge-check warning. */
export function EdgeTip({ warp, style, testID }: EdgeTipProps) {
  return (
    <Tip style={style} testID={testID}>
      {weaveCopy.edgeTip(warp)}
    </Tip>
  );
}

export type WeftTagProps = {
  /** Yarn colour. */
  color: string;
  /** e.g. "Weft: Color A". */
  label: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** A swatch and a short label for the yarn used in this row. */
export function WeftTag({ color, label, style, testID }: WeftTagProps) {
  return (
    <View testID={testID} style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6 }, style]}>
      <Swatch color={color} size={18} radius={6} />
      <Text weight="semibold">{label}</Text>
    </View>
  );
}
