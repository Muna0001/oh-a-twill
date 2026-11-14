import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';

import { TabBarFrame, TabBarItem } from '@/ui';

// TabTriggers must sit inside a TabList written in this file for expo-router/ui to register them.
// TabSlot's container does not shrink by default, so a long screen pushed the tab bar off the
// bottom and its scroll view never scrolled on the web. Let it shrink to the space left.
const slotStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0 } as const;

export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot style={slotStyle} />
      <TabList asChild>
        <TabBarFrame>
          <TabTrigger name="index" href="/" asChild>
            <TabBarItem icon="squares-2x2" label="Stitches" />
          </TabTrigger>
          <TabTrigger name="projects" href="/projects" asChild>
            <TabBarItem icon="queue-list" label="Projects" />
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabBarItem icon="cog-6-tooth" label="Settings" />
          </TabTrigger>
        </TabBarFrame>
      </TabList>
    </Tabs>
  );
}
