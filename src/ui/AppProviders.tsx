import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fontMap } from './fonts';
import { ThemeProvider, useTheme, type ThemePreference } from './theme';

// Keep the splash up until the font is ready (or has failed). Rejects harmlessly where unsupported.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Give up on the font after this long and show the app in the system font. */
const FONT_TIMEOUT_MS = 4000;

export type AppProvidersProps = {
  children: ReactNode;
  /** Starting theme preference. Default 'system'. Change it later with `useThemePreference()`. */
  initialThemePreference?: ThemePreference;
};

/** Wraps the whole app: safe area, bundled font (with splash hold), theme. */
export function AppProviders({ children, initialThemePreference }: AppProvidersProps) {
  const [loaded, error] = useFonts(fontMap);
  const [timedOut, setTimedOut] = useState(false);
  const ready = loaded || !!error || timedOut;

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider initialPreference={initialThemePreference} fontsLoaded={loaded}>
        <WebChrome />
        {children}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Web only: page background and the keyboard focus ring from the reference CSS. */
function WebChrome() {
  const { colors, scheme } = useTheme();
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'oat-ui-chrome';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent =
      `html,body{background:${colors.bg};color-scheme:${scheme}}` +
      `:focus-visible{outline:2px solid ${colors.mark};outline-offset:2px}` +
      `input:focus-visible{outline-offset:-2px}` +
      `body{-webkit-font-smoothing:antialiased}`;
  }, [colors, scheme]);
  return null;
}
