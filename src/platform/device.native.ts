/** iOS and Android (also what Jest resolves `./device` to). */
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

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

/** Space left above the target when it is scrolled to. */
const SCROLL_MARGIN = 16;

let reduceMotion = false;
try {
  quietly(AccessibilityInfo.isReduceMotionEnabled()?.then((on) => (reduceMotion = on)));
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on) => (reduceMotion = on));
} catch {
  // No accessibility info (tests): animate.
}

type ScrollViewLike = { scrollTo?: (options: { y: number; animated: boolean }) => void; getInnerViewRef?: () => unknown };
type MeasurableLike = { measureLayout?: (relativeTo: unknown, onSuccess: (x: number, y: number) => void, onFail?: () => void) => void };

/** Scrolls `scrollView` so the top of `target` (a view inside it) sits just under its top edge. */
export const scrollIntoView: DeviceApi['scrollIntoView'] = (target, scrollView) => {
  try {
    const sv = scrollView as ScrollViewLike | null | undefined;
    const el = target as MeasurableLike | null | undefined;
    if (!sv || typeof sv.scrollTo !== 'function' || !el || typeof el.measureLayout !== 'function') return;
    const relativeTo = sv.getInnerViewRef?.() ?? sv;
    el.measureLayout(
      relativeTo,
      (_x, y) => {
        try {
          sv.scrollTo?.({ y: Math.max(0, y - SCROLL_MARGIN), animated: !reduceMotion });
        } catch {
          // Unmounted between measuring and scrolling.
        }
      },
      () => {},
    );
  } catch {
    // Not measurable: nothing to scroll.
  }
};
