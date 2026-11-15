import { useContext, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { CompactBarContext } from './barContext';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

export type ButtonVariant = 'default' | 'primary' | 'link';

export type ButtonProps = {
  /** Visible text. Omit for an icon-only button (then `accessibilityLabel` is required). */
  label?: string;
  onPress?: () => void;
  /**
   * Default 'default' (secondary: radius 14, surface, `line` border). 'primary' is the ink pill
   * that lifts on hover and press; 'link' is underlined ink text.
   */
  variant?: ButtonVariant;
  /** Icon before the label. */
  icon?: IconName;
  /** Icon after the label. Left out of an `lg` button in a BottomBar under 360 pt wide (it is decoration). */
  trailingIcon?: IconName;
  disabled?: boolean;
  /** Toggle state: draws the filled style and reports `selected` to screen readers. */
  selected?: boolean;
  /**
   * Default 'button'. 'radio' is for one choice out of several inside an
   * `accessibilityRole="radiogroup"` view: `selected` is then reported as `checked`.
   */
  accessibilityRole?: 'button' | 'radio';
  /** 'lg' is the bottom-bar size (52 pt). Default 'md' (48 pt primary, 44 pt otherwise). */
  size?: 'md' | 'lg';
  /** Stretch to the container width. */
  fullWidth?: boolean;
  /** Defaults to `label`. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
  /** The pressable's host view, e.g. to move keyboard focus to it. */
  ref?: Ref<ComponentRef<typeof Pressable>>;
};

type WebPressState = { pressed: boolean; hovered?: boolean };

export function Button({
  label,
  onPress,
  variant = 'default',
  icon,
  trailingIcon,
  disabled = false,
  selected,
  size = 'md',
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  style,
  testID,
  children,
  ref,
}: ButtonProps) {
  const theme = useTheme();
  const { colors } = theme;
  const isPrimary = variant === 'primary';
  const isLink = variant === 'link';
  const filled = isPrimary || (variant === 'default' && selected === true);
  const ink = filled ? colors.btnInk : colors.ink;
  const minHeight = size === 'lg' ? 52 : isPrimary ? 48 : theme.minTouch;
  const iconOnly = !label && !children;
  // In a narrow bottom bar, `lg` buttons give up padding and the trailing chevron so the row label fits.
  const compact = useContext(CompactBarContext) && size === 'lg';
  const showTrailing = !!trailingIcon && !(compact && !iconOnly);

  return (
    <Pressable
      ref={ref}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...(selected === undefined ? null : accessibilityRole === 'radio' ? { checked: selected } : { selected }) }}
      // react-native-web reads the aria-* props, not accessibilityState.
      aria-checked={accessibilityRole === 'radio' ? selected : undefined}
      aria-selected={accessibilityRole === 'radio' ? undefined : selected}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={(state) => {
        const { pressed, hovered } = state as WebPressState;
        const active = !disabled && (pressed || !!hovered);
        return [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minHeight,
            minWidth: theme.minTouch,
            borderRadius: isPrimary ? theme.radii.pill : theme.radii.button,
            cursor: disabled ? 'auto' : 'pointer',
            opacity: disabled ? 0.4 : 1,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
            maxWidth: '100%',
          },
          isLink
            ? { paddingHorizontal: 8, backgroundColor: active ? colors.cloud : 'transparent' }
            : {
                paddingVertical: 8,
                paddingHorizontal: iconOnly ? 8 : compact ? 12 : isPrimary ? (size === 'lg' ? 24 : 20) : 14,
                borderWidth: 1,
                backgroundColor: filled ? colors.btn : active ? colors.cloud : colors.surface,
                borderColor: filled ? colors.btn : colors.line,
              },
          // The primary pill lifts on web hover and on press.
          isPrimary && active ? [theme.shadows.lift, { transform: [{ translateY: pressed ? 0 : -1 }] }] : null,
          filled && !isPrimary && pressed ? { opacity: 0.85 } : null,
          style,
        ];
      }}>
      {icon ? <Icon name={icon} color={ink} /> : null}
      {label ? (
        // Wraps (rather than cutting the label short) only when the text is zoomed far up.
        <Text color={ink} weight={filled || isLink ? 'semibold' : 'medium'} align="center" style={[{ flexShrink: 1 }, isLink ? { textDecorationLine: 'underline' } : null]}>
          {label}
        </Text>
      ) : null}
      {children}
      {showTrailing && trailingIcon ? <Icon name={trailingIcon} color={ink} /> : null}
    </Pressable>
  );
}
