import { Stack } from 'expo-router';

import { AppProviders } from '@/ui';

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="stitch/[id]" />
        <Stack.Screen name="project/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="project/[id]/index" />
        <Stack.Screen name="project/[id]/setup" options={{ presentation: 'modal' }} />
        <Stack.Screen name="gallery" />
      </Stack>
    </AppProviders>
  );
}
