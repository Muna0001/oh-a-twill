/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * expo-router is loaded on first use, not when '@/ui' is imported, so component tests that
 * import the barrel do not have to load (or mock) the whole router.
 */

/** Tab bar for the (tabs) layout. Render inside `<Tabs>` after `<TabSlot />`. */
export function TabBar() {
  const { TabBar: Impl } = require('./TabBar') as typeof import('./TabBar');
  return <Impl />;
}

/** `router.back()`, or home when there is nothing to go back to (a deep link on web). */
export function goBackOrHome() {
  const { router } = require('expo-router') as typeof import('expo-router');
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
