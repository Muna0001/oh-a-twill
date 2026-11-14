import { Stack } from 'expo-router';
import { useEffect, type ReactNode } from 'react';

import { deletePicture } from '@/media';
import { configureProjectFiles, useHydrated, useSettings } from '@/store';
import { AppProviders, useTheme, useThemePreference } from '@/ui';

// Picture files are removed when the last project using them goes away.
configureProjectFiles({ deleteFile: (uri) => deletePicture(uri).catch(() => undefined) });

/** Waits for saved data, and keeps the theme in step with Settings. */
function Bootstrap({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const theme = useSettings((s) => s.theme);
  const [, setPreference] = useThemePreference();
  useEffect(() => {
    if (hydrated) setPreference(theme);
  }, [hydrated, theme, setPreference]);
  return hydrated ? <>{children}</> : null;
}

function Screens() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="stitch/[id]" />
      <Stack.Screen name="project/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="project/[id]/index" />
      <Stack.Screen name="project/[id]/setup" options={{ presentation: 'modal' }} />
      <Stack.Screen name="gallery" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <Bootstrap>
        <Screens />
      </Bootstrap>
    </AppProviders>
  );
}
