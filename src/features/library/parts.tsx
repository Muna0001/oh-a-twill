import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Stitch } from '@/engine';
import { Icon, Text, useTheme } from '@/ui';
import { TilePreview } from '@/weave';

import { libraryCopy } from './copy';

/** 1–3 filled dots out of 3. Decorative: `Difficulty` carries the words. */
export function DifficultyDots({ level, size = 7 }: { level: number; size?: number }) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: n <= level ? theme.colors.weft : 'transparent',
            borderWidth: 1.25,
            borderColor: n <= level ? theme.colors.weft : theme.colors.muted,
          }}
        />
      ))}
    </View>
  );
}

/** "Difficulty ●●○ Intermediate", announced as "Difficulty: Intermediate, 2 of 3". */
export function Difficulty({ level, testID }: { level: number; testID?: string }) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={libraryCopy.difficulty(level)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: theme.spacing.sm, rowGap: 2 }}>
      <Text variant="label">{libraryCopy.difficultyLabel}</Text>
      <DifficultyDots level={level} size={9} />
      <Text weight="medium">{libraryCopy.difficultyName(level)}</Text>
    </View>
  );
}

export type StitchCardProps = {
  stitch: Stitch;
  colors: readonly [string, string];
  favourite: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** One library card: woven preview, name, two-line description, favourite heart. */
export function StitchCard({ stitch, colors, favourite, onPress, style }: StitchCardProps) {
  const theme = useTheme();
  return (
    <Pressable
      testID={`stitch-card-${stitch.id}`}
      accessibilityRole="button"
      accessibilityLabel={libraryCopy.cardLabel(stitch.name, stitch.desc)}
      onPress={onPress}
      style={(state) => {
        const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
        return [
          theme.cards.card,
          { padding: theme.spacing.md, gap: theme.spacing.md, cursor: 'pointer' },
          // Lifts a little on web hover and on press.
          pressed || hovered ? [theme.shadows.lift, { transform: [{ translateY: pressed ? 0 : -1 }] }] : null,
          style,
        ];
      }}>
      <TilePreview stitch={stitch} colors={colors} cols={12} rows={10} style={{ borderRadius: theme.radii.field }} />
      <View style={{ gap: 2, flex: 1, paddingHorizontal: theme.spacing.xs, paddingBottom: theme.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
            {stitch.name}
          </Text>
          {favourite ? <Icon name="heart" filled color="weft" size={18} accessibilityLabel={libraryCopy.favorite} /> : null}
        </View>
        <Text variant="hint" numberOfLines={2}>
          {stitch.desc}
        </Text>
      </View>
    </Pressable>
  );
}
