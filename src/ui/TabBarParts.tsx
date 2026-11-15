import type { TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { useInsets } from './layout';
import { Text } from './Text';
import { useTheme } from './theme';

export type TabBarItemProps = TabTriggerSlotProps & {
  icon: IconName;
  label: string;
};

/** One tab: icon over label. Use as the child of `<TabTrigger asChild>`, which supplies `isFocused` and `onPress`. */
export function TabBarItem({ icon, label, isFocused, href: _href, ref, style: _style, children: _children, ...rest }: TabBarItemProps) {
  const theme = useTheme();
  const focused = !!isFocused;
  const tint = focused ? 'ink' : 'muted';
  return (
    <Pressable
      {...rest}
      ref={ref as ComponentProps<typeof Pressable>['ref']}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      aria-selected={focused}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight: 52,
        paddingVertical: 8,
        borderRadius: theme.radii.button,
        cursor: 'pointer',
        opacity: pressed ? 0.7 : 1,
      })}>
      <View style={{ width: 56, height: 30, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? theme.colors.cloud : 'transparent' }}>
        <Icon name={icon} size={24} color={tint} strokeWidth={1.8} />
      </View>
      <Text color={tint} weight={focused ? 'semibold' : 'medium'} numberOfLines={1} maxFontSizeMultiplier={1.4} style={{ fontSize: 12, lineHeight: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The bar itself: surface, `bar` shadow (plus a top line in dark mode), bottom safe-area padding, content centred at max width 720. */
export function TabBarFrame({ children }: { children?: ReactNode; style?: unknown }) {
  const theme = useTheme();
  const insets = useInsets();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderTopWidth: theme.scheme === 'dark' ? 1 : 0,
          borderTopColor: theme.colors.line,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
        theme.shadows.bar,
      ]}>
      <View
        style={{
          width: '100%',
          maxWidth: theme.maxContentWidth,
          alignSelf: 'center',
          flexDirection: 'row',
          paddingHorizontal: theme.spacing.sm,
          paddingTop: 4,
        }}>
        {children}
      </View>
    </View>
  );
}
