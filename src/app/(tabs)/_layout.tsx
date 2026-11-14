import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';

import { TabBarFrame, TabBarItem } from '@/ui';

// TabTriggers must sit inside a TabList written in this file for expo-router/ui to register them.
export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot />
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
