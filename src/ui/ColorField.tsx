import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button } from './Button';
import { Swatch } from './controls';
import { uiCopy } from './copy';
import { Icon } from './Icon';
import { Sheet } from './layout';
import { Text } from './Text';
import { luminance, normalizeHex, useTheme } from './theme';

export type ColorPreset = { name: string; hex: string };

/** Yarn-shop colours. Content, not theme: the same in light and dark. */
export const yarnPresets: readonly ColorPreset[] = [
  { name: 'Indigo', hex: '#2e4c8f' },
  { name: 'Natural', hex: '#e4dcc8' },
  { name: 'Cream', hex: '#f4efe2' },
  { name: 'Oatmeal', hex: '#cfc3a8' },
  { name: 'Sand', hex: '#b89f7a' },
  { name: 'Walnut', hex: '#6b4a32' },
  { name: 'Charcoal', hex: '#33373f' },
  { name: 'Black', hex: '#17181c' },
  { name: 'Brick', hex: '#a8432f' },
  { name: 'Madder red', hex: '#c0392b' },
  { name: 'Rust', hex: '#c4622d' },
  { name: 'Terracotta', hex: '#d08a5b' },
  { name: 'Mustard', hex: '#d9a521' },
  { name: 'Straw', hex: '#e6cf7a' },
  { name: 'Moss', hex: '#6b7a3a' },
  { name: 'Sage', hex: '#9db09a' },
  { name: 'Forest', hex: '#2f5d46' },
  { name: 'Teal', hex: '#2b7a78' },
  { name: 'Sky', hex: '#8fb7d9' },
  { name: 'Denim', hex: '#4a6fa5' },
  { name: 'Navy', hex: '#1c2f5c' },
  { name: 'Plum', hex: '#6d3b6a' },
  { name: 'Heather', hex: '#a995c2' },
  { name: 'Rose', hex: '#d9919b' },
];

export type ColorFieldProps = {
  /** Shown next to the swatch and used as the sheet title, e.g. 'Weft'. */
  label: string;
  /** Current colour as hex. */
  value: string;
  /** Called with a normalised lowercase `#rrggbb`. Never called with an invalid value. */
  onChange: (hex: string) => void;
  /** Default `yarnPresets`. */
  presets?: readonly ColorPreset[];
  disabled?: boolean;
  testID?: string;
};

/** A swatch + label that opens a sheet of yarn presets and a hex field. */
export function ColorField({ label, value, onChange, presets = yarnPresets, disabled = false, testID }: ColorFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState('');
  const [error, setError] = useState(false);
  const current = normalizeHex(value);

  const show = () => {
    setHex((current ?? value).toUpperCase());
    setError(false);
    setOpen(true);
  };
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  const applyHex = () => {
    const next = normalizeHex(hex);
    if (!next) {
      setError(true);
      return;
    }
    pick(next);
  };

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={uiCopy.changeColor(label, (current ?? value).toUpperCase())}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={show}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: theme.spacing.sm,
          minHeight: theme.minTouch,
          cursor: disabled ? 'auto' : 'pointer',
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        })}>
        <View style={{ padding: 2, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radii.field }}>
          <Swatch color={value} size={36} radius={5} />
        </View>
        <Text>{label}</Text>
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={`${uiCopy.colorSheetTitle}: ${label}`}>
        <Text variant="label" style={{ marginBottom: theme.spacing.sm }}>
          {uiCopy.colorPresets}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {presets.map((preset) => {
            const on = current === normalizeHex(preset.hex);
            return (
              <Pressable
                key={preset.hex}
                accessibilityRole="button"
                accessibilityLabel={preset.name}
                accessibilityState={{ selected: on }}
                aria-selected={on}
                onPress={() => pick(normalizeHex(preset.hex) ?? preset.hex)}
                style={({ pressed }) => ({
                  width: theme.minTouch,
                  height: theme.minTouch,
                  borderRadius: theme.radii.button,
                  padding: 3,
                  borderWidth: 2,
                  borderColor: on ? theme.colors.ink : 'transparent',
                  cursor: 'pointer',
                  opacity: pressed ? 0.7 : 1,
                })}>
                <View
                  style={{
                    flex: 1,
                    borderRadius: 6,
                    backgroundColor: preset.hex,
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {on ? <Icon name="check" size={18} strokeWidth={2.4} color={luminance(preset.hex) > 0.4 ? '#1C2333' : '#FFFFFF'} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text variant="label" style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
          {uiCopy.hexLabel}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Swatch color={normalizeHex(hex) ?? 'transparent'} size={36} radius={6} />
          <TextInput
            accessibilityLabel={uiCopy.hexLabel}
            value={hex}
            onChangeText={(text) => {
              setHex(text);
              setError(false);
            }}
            onSubmitEditing={applyHex}
            placeholder={uiCopy.hexPlaceholder}
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            returnKeyType="done"
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
                borderColor: error ? theme.colors.warn : theme.colors.line,
                borderRadius: theme.radii.button,
                fontVariant: ['tabular-nums'],
              },
              theme.fonts.medium,
            ]}
          />
          <Button variant="primary" label={uiCopy.hexApply} onPress={applyHex} />
        </View>
        {error ? (
          <Text variant="hint" color="warn" accessibilityRole="alert" style={{ marginTop: theme.spacing.sm }}>
            {uiCopy.hexError}
          </Text>
        ) : null}
      </Sheet>
    </>
  );
}
