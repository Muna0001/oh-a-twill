/** A small, non-blocking "Updated" banner over the top of the app. Renders nothing on phones. */
import { Pressable, View } from 'react-native';

import { Tip, useInsets, useTheme } from '@/ui';

import { platformCopy } from './copy';
import { useAppUpdate } from './pwa';

export function UpdateNotice() {
  const { updated, dismiss } = useAppUpdate();
  const theme = useTheme();
  const insets = useInsets();
  if (!updated) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + theme.spacing.sm,
        left: theme.spacing.lg,
        right: theme.spacing.lg,
        alignItems: 'center',
      }}>
      <Pressable
        testID="update-notice"
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={`${platformCopy.updated} ${platformCopy.dismissUpdated}`}
        style={{ width: '100%', maxWidth: theme.maxContentWidth }}>
        <Tip icon="check-circle">{platformCopy.updated}</Tip>
      </Pressable>
    </View>
  );
}
