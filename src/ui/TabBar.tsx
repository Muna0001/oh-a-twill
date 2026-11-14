import { router, usePathname } from 'expo-router';
import { TabList, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import type { GestureResponderEvent } from 'react-native';

import { uiCopy } from './copy';
import type { IconName } from './Icon';
import { TabBarFrame, TabBarItem } from './TabBarParts';
import { useTheme } from './theme';

type TabHref = '/' | '/projects' | '/settings';

type ItemProps = TabTriggerSlotProps & { icon: IconName; label: string; to: TabHref };

/**
 * `Tabs` only registers TabTriggers that are written directly inside a `TabList` in the layout
 * file itself; triggers inside a wrapper component (like this TabBar) arrive with no `href`,
 * `isFocused: false` and an `onPress` that does nothing. In that case focus follows the URL and
 * a press navigates with the router. When the trigger is registered, the slot props are used.
 */
function Item({ to, href, isFocused, onPress, ...rest }: ItemProps) {
  const pathname = usePathname();
  const registered = href !== undefined;
  const focused = registered ? !!isFocused : to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
  const press = (event: GestureResponderEvent) => {
    onPress?.(event);
    if (!registered && !focused) router.navigate(to);
  };
  return <TabBarItem {...rest} href={href} isFocused={focused} onPress={press} />;
}

/** Tab bar for the (tabs) layout. Render inside `<Tabs>` after `<TabSlot />`. */
export function TabBar() {
  const theme = useTheme();
  return (
    <TabBarFrame>
      <TabList
        style={{
          width: '100%',
          maxWidth: theme.maxContentWidth,
          alignSelf: 'center',
          flexDirection: 'row',
          justifyContent: 'space-around',
          paddingHorizontal: theme.spacing.sm,
          paddingTop: 2,
        }}>
        <TabTrigger name="index" href="/" asChild>
          <Item icon="squares-2x2" label={uiCopy.tabs.stitches} to="/" />
        </TabTrigger>
        <TabTrigger name="projects" href="/projects" asChild>
          <Item icon="queue-list" label={uiCopy.tabs.projects} to="/projects" />
        </TabTrigger>
        <TabTrigger name="settings" href="/settings" asChild>
          <Item icon="cog-6-tooth" label={uiCopy.tabs.settings} to="/settings" />
        </TabTrigger>
      </TabList>
    </TabBarFrame>
  );
}
