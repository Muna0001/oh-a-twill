import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Stitch } from '@/engine';
import { Icon, Text, useTheme } from '@/ui';
import { TilePreview } from '@/weave';

import { libraryCopy } from './copy';

/** 1–3 filled dots out of 3, announced as "Difficulty n of 3". */
export function DifficultyDots({ level, size = 7, testID }: { level: number; size?: number; testID?: string }) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={libraryCopy.difficulty(level)}
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

export type StitchCardProps = {
  stitch: Stitch;
  colors: readonly [string, string];
  favourite: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** One library card: woven preview, name, two-line description, difficulty, favourite heart. */
export function StitchCard({ stitch, colors, favourite, onPress, style }: StitchCardProps) {
  const theme = useTheme();
  return (
    <Pressable
      testID={`stitch-card-${stitch.id}`}
      accessibilityRole="button"
      accessibilityLabel={libraryCopy.cardLabel(stitch.name, stitch.desc)}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.line,
          borderRadius: theme.radii.panel,
          padding: 10,
          gap: 8,
          cursor: 'pointer',
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}>
      <TilePreview stitch={stitch} colors={colors} cols={12} rows={10} />
      <View style={{ gap: 2, flex: 1 }}>
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
      <DifficultyDots level={stitch.difficulty} />
    </Pressable>
  );
}
