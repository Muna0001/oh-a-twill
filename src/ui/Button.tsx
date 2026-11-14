import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

export type ButtonVariant = 'default' | 'primary' | 'link';

export type ButtonProps = {
  /** Visible text. Omit for an icon-only button (then `accessibilityLabel` is required). */
  label?: string;
  onPress?: () => void;
  /** Default 'default' (outlined). 'primary' is filled, 'link' is bare weft-coloured text. */
  variant?: ButtonVariant;
  /** Icon before the label. */
  icon?: IconName;
  /** Icon after the label. */
  trailingIcon?: IconName;
  disabled?: boolean;
  /** Toggle state: draws the filled style and reports `selected` to screen readers. */
  selected?: boolean;
  /** 'lg' is the taller bottom-bar size (48 pt). Default 'md' (44 pt). */
  size?: 'md' | 'lg';
  /** Stretch to the container width. */
  fullWidth?: boolean;
  /** Defaults to `label`. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
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
  style,
  testID,
  children,
}: ButtonProps) {
  const theme = useTheme();
  const { colors } = theme;
  const filled = variant === 'primary' || (variant === 'default' && selected === true);
  const isLink = variant === 'link';
  const ink = filled ? colors.btnInk : isLink ? colors.weft : colors.ink;
  const minHeight = size === 'lg' ? 48 : theme.minTouch;
  const iconOnly = !label && !children;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...(selected === undefined ? null : { selected }) }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={(state) => {
        const { pressed, hovered } = state as WebPressState;
        return [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minHeight,
            minWidth: theme.minTouch,
            borderRadius: theme.radii.button,
            cursor: disabled ? 'auto' : 'pointer',
            opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
          },
          isLink
            ? { paddingHorizontal: 8, borderRadius: theme.radii.field }
            : {
                paddingVertical: 8,
                paddingHorizontal: iconOnly ? 8 : size === 'lg' ? (variant === 'primary' ? 20 : 16) : 13,
                borderWidth: 1,
                backgroundColor: filled ? colors.btn : colors.surface,
                borderColor: filled ? colors.btn : hovered && !disabled ? colors.muted : colors.line,
              },
          style,
        ];
      }}>
      {icon ? <Icon name={icon} color={ink} /> : null}
      {label ? (
        <Text color={ink} weight={filled || isLink ? 'semibold' : 'medium'} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      {children}
      {trailingIcon ? <Icon name={trailingIcon} color={ink} /> : null}
    </Pressable>
  );
}
