/** iOS and Android (also what Jest resolves `./device` to). */
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import type { DeviceApi } from './types';

let tagCount = 0;

const quietly = (p: Promise<unknown> | undefined) => {
  p?.catch(() => {});
};

export const tapHaptic: DeviceApi['tapHaptic'] = () => {
  try {
    quietly(impactAsync(ImpactFeedbackStyle.Light));
  } catch {
    // No haptics engine (simulator, or an old device): nothing to do.
  }
};

export const useKeepAwake: DeviceApi['useKeepAwake'] = (enabled) => {
  useEffect(() => {
    if (!enabled) return;
    tagCount += 1;
    const tag = `oh-a-twill-${tagCount}`;
    try {
      quietly(activateKeepAwakeAsync(tag));
    } catch {
      return;
    }
    return () => {
      try {
        quietly(deactivateKeepAwake(tag));
      } catch {
        // Already released.
      }
    };
  }, [enabled]);
};

/** No hardware keyboard handling on phones. */
export const useRowKeys: DeviceApi['useRowKeys'] = () => {};

export const confirmAsync: DeviceApi['confirmAsync'] = ({ title, message, confirmLabel, cancelLabel, destructive }) =>
  new Promise((resolve) => {
    try {
      Alert.alert(
        title,
        message,
        [
          { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
          { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    } catch {
      resolve(false);
    }
  });

export const scrollIntoView: DeviceApi['scrollIntoView'] = () => {};
