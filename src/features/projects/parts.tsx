import type { ReactNode } from 'react';
import { TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

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

export type TextFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  accessibilityLabel: string;
  placeholder?: string;
  onSubmit?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  testID?: string;
};

/** A single-line text field drawn like the colour sheet's hex field. */
export function TextField({ value, onChangeText, accessibilityLabel, placeholder, onSubmit, onBlur, autoFocus, testID }: TextFieldProps) {
  const theme = useTheme();
  return (
    <TextInput
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.muted}
      autoFocus={autoFocus}
      autoCorrect={false}
      returnKeyType="done"
      maxLength={80}
      style={[
        {
          flex: 1,
          minWidth: 0,
          height: theme.minTouch,
          paddingHorizontal: 12,
          paddingVertical: 0,
          fontSize: 16,
          color: theme.colors.ink,
          backgroundColor: theme.colors.bg,
          borderWidth: 1,
          borderColor: theme.colors.line,
          borderRadius: theme.radii.button,
        },
        theme.fonts.regular,
      ]}
    />
  );
}
