import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { uiCopy } from './copy';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Defaults to `label`. */
  accessibilityLabel?: string;
};

export type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  /** Called with the pressed option's value (not called for the one already selected). */
  onChange: (value: T) => void;
  /** Names the group for screen readers. */
  accessibilityLabel: string;
  disabled?: boolean;
  /** Stretch to the container width with equal segments. */
  fullWidth?: boolean;
  testID?: string;
};

export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, disabled = false, fullWidth = false, testID }: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        borderWidth: 1,
        borderColor: theme.colors.line,
        borderRadius: theme.radii.button,
        overflow: 'hidden',
        opacity: disabled ? 0.4 : 1,
      }}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ checked: on, disabled }}
            aria-checked={on}
            disabled={disabled}
            onPress={() => {
              if (!on) onChange(option.value);
            }}
            style={({ pressed }) => ({
              flexGrow: fullWidth ? 1 : 0,
              flexBasis: fullWidth ? 0 : 'auto',
              minHeight: theme.minTouch - 2,
              minWidth: theme.minTouch,
              paddingHorizontal: 14,
              paddingVertical: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? theme.colors.btn : 'transparent',
              cursor: disabled ? 'auto' : 'pointer',
              opacity: pressed ? 0.7 : 1,
            })}>
            <Text color={on ? 'btnInk' : 'ink'} weight={on ? 'semibold' : 'regular'} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type StepperProps = {
  value: number;
  min: number;
  max: number;
  /** Amount added or removed per tap. Default 1. */
  step?: number;
  /** Only ever called with an integer inside [min, max] that differs from `value`. */
  onChange: (value: number) => void;
  /** Accessibility label of the number field, e.g. 'Number of warp threads'. */
  accessibilityLabel: string;
  /** Accessibility label of the minus button. Default 'Decrease'. */
  decrementLabel?: string;
  /** Accessibility label of the plus button. Default 'Increase'. */
  incrementLabel?: string;
  disabled?: boolean;
  testID?: string;
};

const REPEAT_DELAY = 400;
const REPEAT_EVERY = 80;

const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

/**
 * −/+ buttons around an editable number. Tap steps once, holding repeats, and a typed number is
 * committed (clamped) when the field loses focus or the keyboard's done key is pressed.
 */
export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  accessibilityLabel,
  decrementLabel = uiCopy.decrease,
  incrementLabel = uiCopy.increase,
  disabled = false,
  testID,
}: StepperProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const latest = useRef({ value, min, max, step, onChange });
  useEffect(() => {
    latest.current = { value, min, max, step, onChange };
  });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const bump = (dir: 1 | -1) => {
    const now = latest.current;
    const next = clampInt(now.value + dir * now.step, now.min, now.max);
    if (next === now.value) {
      stop();
      return;
    }
    // Keeps a held button moving even if the parent has not re-rendered yet.
    latest.current = { ...now, value: next };
    now.onChange(next);
  };

  const startRepeat = (dir: 1 | -1) => {
    stop();
    bump(dir);
    timer.current = setInterval(() => bump(dir), REPEAT_EVERY);
  };

  const commit = () => {
    if (draft === null) return;
    const parsed = parseInt(draft, 10);
    setDraft(null);
    if (Number.isNaN(parsed)) return;
    const next = clampInt(parsed, min, max);
    if (next !== value) onChange(next);
  };

  const side = (dir: 1 | -1, label: string, icon: IconName) => {
    const atEnd = dir === 1 ? value >= max : value <= min;
    const off = disabled || atEnd;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: off }}
        disabled={off}
        onPress={() => bump(dir)}
        delayLongPress={REPEAT_DELAY}
        onLongPress={() => startRepeat(dir)}
        onPressOut={stop}
        style={({ pressed }) => ({
          width: theme.minTouch,
          height: theme.minTouch,
          alignItems: 'center',
          justifyContent: 'center',
          cursor: off ? 'auto' : 'pointer',
          opacity: off ? 0.35 : pressed ? 0.6 : 1,
        })}>
        <Icon name={icon} />
      </Pressable>
    );
  };

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: theme.colors.line,
        borderRadius: theme.radii.button,
      }}>
      {side(-1, decrementLabel, 'minus')}
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={draft ?? String(value)}
        editable={!disabled}
        onChangeText={(text) => setDraft(text.replace(min < 0 ? /[^0-9-]/g : /[^0-9]/g, ''))}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="number-pad"
        inputMode="numeric"
        returnKeyType="done"
        selectTextOnFocus
        maxLength={Math.max(String(min).length, String(max).length)}
        style={[
          {
            width: 56,
            height: theme.minTouch,
            padding: 0,
            textAlign: 'center',
            fontSize: 18,
            color: theme.colors.ink,
            fontVariant: ['tabular-nums'],
            opacity: disabled ? 0.4 : 1,
          },
          theme.fonts.bold,
        ]}
      />
      {side(1, incrementLabel, 'plus')}
    </View>
  );
}

export type ChipProps = {
  label: string;
  /**
   * 'neutral' (under-chip background, muted text), 'over' (over-chip background, ink semibold:
   * the direction pill), 'weft' (weft background), 'outline' (surface with a line border).
   * Default 'neutral'.
   */
  tone?: 'neutral' | 'over' | 'weft' | 'outline';
  /** Filled with the button colour ("now" / active filter). */
  selected?: boolean;
  /** Makes the chip a button. */
  onPress?: () => void;
  icon?: IconName;
  /** 'md' is 44 pt tall for tappable filters; 'sm' is the compact read-only pill. Default: 'md' with `onPress`, else 'sm'. */
  size?: 'sm' | 'md';
  /** Defaults to `label`. */
  accessibilityLabel?: string;
  /**
   * With `onPress`: 'button' (default) reports `selected`; 'radio' reports `checked`, for one
   * choice out of several inside an `accessibilityRole="radiogroup"` view.
   */
  accessibilityRole?: 'button' | 'radio';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Chip({ label, tone = 'neutral', selected = false, onPress, icon, size, accessibilityLabel, accessibilityRole = 'button', style, testID }: ChipProps) {
  const theme = useTheme();
  const { colors } = theme;
  const big = (size ?? (onPress ? 'md' : 'sm')) === 'md';
  const bg = selected ? colors.btn : tone === 'over' ? colors.overChip : tone === 'weft' ? colors.weft : tone === 'outline' ? colors.surface : colors.underChip;
  const ink = selected ? colors.btnInk : tone === 'weft' ? colors.weftInk : tone === 'neutral' ? colors.muted : colors.ink;
  const strong = selected || tone === 'over' || tone === 'weft';
  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    // Never wider than its row: with the text zoomed far up the label wraps instead.
    maxWidth: '100%',
    gap: 6,
    borderRadius: theme.radii.chip,
    backgroundColor: bg,
    borderWidth: 1,
    borderColor: tone === 'outline' && !selected ? colors.line : bg,
    paddingHorizontal: big ? 14 : 10,
    paddingVertical: big ? 8 : 3,
    minHeight: big ? (onPress ? theme.minTouch : 36) : undefined,
  };
  const content = (
    <>
      {icon ? <Icon name={icon} color={ink} size={big ? 20 : 16} /> : null}
      <Text variant={big ? 'body' : 'hint'} color={ink} weight={strong ? 'semibold' : big ? 'medium' : 'regular'} style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </>
  );
  if (!onPress) {
    return (
      <View testID={testID} accessibilityLabel={accessibilityLabel} style={[base, style]}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={accessibilityRole === 'radio' ? { checked: selected } : { selected }}
      aria-checked={accessibilityRole === 'radio' ? selected : undefined}
      aria-selected={accessibilityRole === 'radio' ? undefined : selected}
      onPress={onPress}
      style={({ pressed }) => [base, { cursor: 'pointer', opacity: pressed ? 0.7 : 1 }, style]}>
      {content}
    </Pressable>
  );
}

export type CheckboxProps = {
  checked: boolean;
  /** Called with the new state. */
  onChange: (checked: boolean) => void;
  label: string;
  /** Muted line under the label. */
  hint?: string;
  disabled?: boolean;
  /** Defaults to `label`. */
  accessibilityLabel?: string;
  testID?: string;
};

export function Checkbox({ checked, onChange, label, hint, disabled = false, accessibilityLabel, testID }: CheckboxProps) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: theme.minTouch,
        cursor: disabled ? 'auto' : 'pointer',
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: checked ? 0 : 1.5,
          borderColor: theme.colors.muted,
          backgroundColor: checked ? theme.colors.weft : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {checked ? <Icon name="check" size={16} color="weftInk" strokeWidth={2.4} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text>{label}</Text>
        {hint ? <Text variant="hint">{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

export type TipProps = {
  /** A string, or `Text` elements for mixed emphasis. */
  children: ReactNode;
  /** Default 'exclamation-triangle'. */
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Warning box (warn on warnBg). Announced as an alert. */
export function Tip({ children, icon = 'exclamation-triangle', style, testID }: TipProps) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 9,
          backgroundColor: theme.colors.warnBg,
          borderRadius: theme.radii.button,
          paddingVertical: 10,
          paddingHorizontal: 12,
        },
        style,
      ]}>
      <View style={{ marginTop: 1 }}>
        <Icon name={icon} color="warn" />
      </View>
      <Text color="warn" style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>
        {children}
      </Text>
    </View>
  );
}

export type SwatchProps = {
  /** Yarn colour (content, never themed). */
  color: string;
  /** Default 16. */
  size?: number;
  /** Corner radius. Default a quarter of `size`. */
  radius?: number;
  /** Set to have screen readers announce the swatch. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Swatch({ color, size = 16, radius, accessibilityLabel, style, testID }: SwatchProps) {
  return (
    <View
      testID={testID}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius ?? size / 4,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.18)',
          flexShrink: 0,
        },
        style,
      ]}
    />
  );
}

export type SearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Default 'Search'. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SearchField({ value, onChangeText, placeholder, accessibilityLabel = uiCopy.search, style, testID }: SearchFieldProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: theme.minTouch,
          paddingLeft: 12,
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.line,
          borderRadius: theme.radii.button,
        },
        style,
      ]}>
      <Icon name="magnifying-glass" color="muted" />
      <TextInput
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        inputMode="search"
        style={[{ flex: 1, minWidth: 0, height: theme.minTouch - 2, padding: 0, fontSize: 16, color: theme.colors.ink }, theme.fonts.regular]}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={uiCopy.clearSearch}
          onPress={() => onChangeText('')}
          style={({ pressed }) => ({
            width: theme.minTouch,
            height: theme.minTouch - 2,
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            opacity: pressed ? 0.6 : 1,
          })}>
          <Icon name="x-mark" color="muted" />
        </Pressable>
      ) : (
        <View style={{ width: 4 }} />
      )}
    </View>
  );
}
