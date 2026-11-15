import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Text, useTheme } from '@/ui';

/** A labelled group of controls: muted label, then the control, then an optional hint. */
export function Field({ label, hint, children, style }: { label: string; hint?: ReactNode; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[{ gap: theme.spacing.sm }, style]}>
      <Text variant="label">{label}</Text>
      {children}
      {typeof hint === 'string' ? <Text variant="hint">{hint}</Text> : hint}
    </View>
  );
}
