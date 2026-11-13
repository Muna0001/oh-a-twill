import { TabSlot, Tabs } from 'expo-router/ui';

import { TabBar } from '@/ui';

export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot />
      <TabBar />
    </Tabs>
  );
}
