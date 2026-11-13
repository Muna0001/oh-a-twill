import { TabList, TabTrigger } from 'expo-router/ui';
import { Text } from 'react-native';

/** Placeholder tab bar. WP3 styles it (icons, theme, safe area). Keep the three triggers and their names. */
export function TabBar() {
  return (
    <TabList style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 12 }}>
      <TabTrigger name="index" href="/">
        <Text>Stitches</Text>
      </TabTrigger>
      <TabTrigger name="projects" href="/projects">
        <Text>Projects</Text>
      </TabTrigger>
      <TabTrigger name="settings" href="/settings">
        <Text>Settings</Text>
      </TabTrigger>
    </TabList>
  );
}
