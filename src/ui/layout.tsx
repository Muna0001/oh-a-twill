import { useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { CompactBarContext } from './barContext';
import { Button } from './Button';
import { uiCopy } from './copy';
import { Icon, type IconName } from './Icon';
import { goBackOrHome } from './lazy';
import { PaperShape, type PaperColor } from './PaperShape';
import { Text } from './Text';
import { narrowWidth, useTheme } from './theme';

const zeroInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Safe-area insets, or zeros when no SafeAreaProvider is mounted (tests). */
export function useInsets() {
  return useContext(SafeAreaInsetsContext) ?? zeroInsets;
}

/** True when the person asked the system (or browser) for less motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    let sub: { remove: () => void } | undefined;
    try {
      AccessibilityInfo.isReduceMotionEnabled?.()
        ?.then((on) => {
          if (live) setReduced(on);
        })
        .catch(() => {});
      sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on) => setReduced(on));
    } catch {
      // No accessibility info: keep the default motion.
    }
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

export type ScreenEdge = 'top' | 'bottom';

export type ScreenProps = {
  children?: ReactNode;
  /** Wrap the content in a vertical ScrollView. Default false. */
  scroll?: boolean;
  /** Ref to that ScrollView (with `scroll`), e.g. to bring a card back into view on phones. */
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
  /** Rendered above the content and does not scroll (usually a `Header`). */
  header?: ReactNode;
  /** Rendered below the content and does not scroll (usually a `BottomBar`, which pads its own bottom inset). */
  footer?: ReactNode;
  /**
   * Safe-area edges the screen pads itself. Default ['top'].
   * Tab screens keep the default (the tab bar owns the bottom inset); stack screens with no
   * `footer` should pass ['top', 'bottom'].
   */
  edges?: ScreenEdge[];
  /** Horizontal 20 (the gutter) and top 8 padding around the content column. Default true. */
  padded?: boolean;
  /** Style for the centred content column (max width 720). */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

const defaultEdges: ScreenEdge[] = ['top'];

export function Screen({ children, scroll = false, scrollRef, header, footer, edges = defaultEdges, padded = true, contentStyle, testID }: ScreenProps) {
  const theme = useTheme();
  const insets = useInsets();
  const bottomInset = edges.includes('bottom') && !footer ? insets.bottom : 0;
  const column: StyleProp<ViewStyle> = [
    { width: '100%', maxWidth: theme.maxContentWidth, alignSelf: 'center' },
    padded ? { paddingHorizontal: theme.spacing.gutter, paddingTop: theme.spacing.sm } : null,
  ];
  // Under a header, the header's own bottom margin is the gap.
  const content: StyleProp<ViewStyle> = [column, header && padded ? { paddingTop: 0 } : null];
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        backgroundColor: theme.colors.bg,
        // Collage shapes may hang past the column; they never make the page scroll sideways.
        overflow: 'hidden',
        paddingTop: edges.includes('top') ? insets.top : 0,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}>
      {header ? <View style={column}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: bottomInset + theme.spacing.xl }}>
          <View style={[content, contentStyle]}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[content, { flex: 1, paddingBottom: bottomInset }, contentStyle]}>{children}</View>
      )}
      {footer}
    </View>
  );
}

export type PanelProps = {
  children?: ReactNode;
  /**
   * 'default' is a card (radius 20, `float` shadow). 'hero' is the current-row card: radius 24,
   * same shadow. Both get a 1 px `line` border in dark mode only. Default 'default'.
   */
  variant?: 'default' | 'hero';
  style?: StyleProp<ViewStyle>;
  /** Names the group for screen readers. */
  accessibilityLabel?: string;
  testID?: string;
};

/** Card padding for the current window: 24, or 20 under 360 px wide. */
export function useCardPadding(): number {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  return width > 0 && width < narrowWidth ? theme.spacing.cardNarrow : theme.spacing.card;
}

export function Panel({ children, variant = 'default', style, accessibilityLabel, testID }: PanelProps) {
  const theme = useTheme();
  const padding = useCardPadding();
  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[variant === 'hero' ? theme.cards.hero : theme.cards.card, { padding, marginBottom: theme.spacing.cardGap }, style]}>
      {children}
    </View>
  );
}

export type HeaderProps = {
  title: string;
  /** 'subtitle' draws a smaller serif title (24, e.g. a stitch name). Default 'title' (34). */
  titleVariant?: 'title' | 'subtitle';
  /** Muted line under the title. */
  subtitle?: string;
  /** Show the back button. Default false, or true when `onBack` is given. */
  back?: boolean;
  /** Replaces the default `router.back()` (which falls back to '/' when there is no history). */
  onBack?: () => void;
  /** Accessibility label of the back button. Default 'Back'. */
  backLabel?: string;
  /** Element at the right edge, e.g. an icon `Button`. */
  right?: ReactNode;
  testID?: string;
};

/** Width the title keeps before `right` wraps to its own line. */
const HEADER_TITLE_BASIS = 100;

export function Header({ title, titleVariant = 'title', subtitle, back, onBack, backLabel = uiCopy.back, right, testID }: HeaderProps) {
  const theme = useTheme();
  const showBack = back ?? !!onBack;
  const goBack = () => {
    if (onBack) onBack();
    else goBackOrHome();
  };
  return (
    <View testID={testID} style={{ marginBottom: theme.spacing.xl }}>
      {/* Wraps only when the text is zoomed far up on a narrow screen: then `right` drops below. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm, minHeight: theme.minTouch }}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            onPress={goBack}
            hitSlop={4}
            style={({ pressed }) => ({
              width: theme.minTouch,
              height: theme.minTouch,
              marginLeft: -8,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.pill,
              backgroundColor: pressed ? theme.colors.cloud : 'transparent',
              cursor: 'pointer',
            })}>
            <Icon name="chevron-left" size={24} />
          </Pressable>
        ) : null}
        {title ? (
          <Text variant={titleVariant} accessibilityRole="header" style={{ flexGrow: 1, flexShrink: 1, flexBasis: HEADER_TITLE_BASIS, paddingVertical: 2 }}>
            {title}
          </Text>
        ) : (
          // No empty heading for screen readers on a back-only header.
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }} />
        )}
        {right}
      </View>
      {subtitle ? (
        <Text color="muted" style={{ marginTop: theme.spacing.xs }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export type BottomBarProps = {
  /** Left slot, usually `<Button size="lg" icon="chevron-left" label="Back" />`. */
  left?: ReactNode;
  /** Centre label: a string is drawn semibold with tabular numerals, or pass an element. */
  center?: ReactNode;
  /** Right slot, usually a primary `<Button size="lg" />`. */
  right?: ReactNode;
  testID?: string;
};

/**
 * Bar pinned under the content. Pass it to `Screen`'s `footer`. Pads the bottom safe area itself.
 * A string centre label stays on one line; under 360 pt the bar and its `lg` buttons tighten up
 * (less padding, no trailing chevron) so it fits. With the text zoomed far up, `right` wraps below.
 */
export function BottomBar({ left, center, right, testID }: BottomBarProps) {
  const theme = useTheme();
  const insets = useInsets();
  const { width } = useWindowDimensions();
  const compact = width > 0 && width < narrowWidth;
  const label = typeof center === 'string' || typeof center === 'number';
  return (
    <CompactBarContext.Provider value={compact}>
      <View
        testID={testID}
        style={[
          {
            backgroundColor: theme.colors.surface,
            // Light mode leans on the shadow alone; dark mode also needs the line.
            borderTopWidth: theme.scheme === 'dark' ? 1 : 0,
            borderTopColor: theme.colors.line,
            paddingTop: 12,
            paddingBottom: 12 + insets.bottom,
            paddingHorizontal: compact ? theme.spacing.md : theme.spacing.gutter,
          },
          theme.shadows.bar,
        ]}>
        <View
          style={{
            width: '100%',
            maxWidth: theme.maxContentWidth,
            alignSelf: 'center',
            flexDirection: 'row',
            // Wraps only when the text is zoomed far up on a narrow screen.
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: compact ? theme.spacing.sm : theme.spacing.md,
          }}>
          {left}
          {/* A label never shrinks below its text (the row wraps instead); an element centre fills what is left. */}
          <View style={label ? { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', alignItems: 'center' } : { flexGrow: 1, flexShrink: 1, flexBasis: 0, alignItems: 'center' }}>
            {label ? (
              <Text weight="semibold" tabular align="center" numberOfLines={1} accessibilityLiveRegion="polite">
                {center}
              </Text>
            ) : (
              center
            )}
          </View>
          {right}
        </View>
      </View>
    </CompactBarContext.Provider>
  );
}

export type CollapsibleProps = {
  title: string;
  children?: ReactNode;
  /** Uncontrolled starting state. Default false. */
  defaultOpen?: boolean;
  /** Controlled state; use with `onToggle`. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  testID?: string;
};

/** A heading row with a chevron that shows or hides its children. Put it inside a `Panel`. */
export function Collapsible({ title, children, defaultOpen = false, open, onToggle, testID }: CollapsibleProps) {
  const theme = useTheme();
  const [inner, setInner] = useState(defaultOpen);
  const isOpen = open ?? inner;
  const toggle = () => {
    if (open === undefined) setInner(!isOpen);
    onToggle?.(!isOpen);
  };
  return (
    <View testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: isOpen }}
        aria-expanded={isOpen}
        onPress={toggle}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
          minHeight: theme.minTouch,
          marginVertical: -8,
          cursor: 'pointer',
          opacity: pressed ? 0.7 : 1,
        })}>
        <Text variant="heading" accessibilityRole="text" style={{ flex: 1 }}>
          {title}
        </Text>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ rotate: isOpen ? '180deg' : '0deg' }],
          }}>
          <Icon name="chevron-down" size={18} />
        </View>
      </Pressable>
      {isOpen ? <View style={{ marginTop: theme.spacing.lg }}>{children}</View> : null}
    </View>
  );
}

export type EmptyStateProps = {
  title: string;
  message?: string;
  icon?: IconName;
  /** Element under the message, usually a `Button`. */
  action?: ReactNode;
  /** A torn-paper shape behind the icon. */
  paper?: PaperColor;
  /** Picks the shape's edge. Default 3. */
  paperSeed?: number;
  testID?: string;
};

export function EmptyState({ title, message, icon, action, paper, paperSeed = 3, testID }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View testID={testID} style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xxl, paddingHorizontal: theme.spacing.lg }}>
      {icon || paper ? (
        <View style={{ width: 112, height: 88, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.xs }}>
          {paper ? <PaperShape color={paper} seed={paperSeed} width={104} height={80} rotate={-5} dots style={{ top: 4, left: 4 }} /> : null}
          {icon ? <Icon name={icon} size={36} color={paper ? 'pastelInk' : 'muted'} strokeWidth={1.5} /> : null}
        </View>
      ) : null}
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="hint" align="center" style={{ maxWidth: 320 }}>
          {message}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: theme.spacing.sm, alignItems: 'center' }}>{action}</View> : null}
    </View>
  );
}

export type SheetProps = {
  visible: boolean;
  /** Called by the close button, the backdrop, and the system back gesture. */
  onClose: () => void;
  title: string;
  children?: ReactNode;
  testID?: string;
};

/**
 * Modal sheet that rises from the bottom edge. Escape (web) and the system back gesture close it.
 * Keyboard focus moves to its close button when it opens; it fades in unless reduced motion is on.
 */
export function Sheet({ visible, onClose, title, children, testID }: SheetProps) {
  const theme = useTheme();
  const insets = useInsets();
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<ComponentRef<typeof Pressable>>(null);
  useEffect(() => {
    if (!visible) return;
    // After the modal has mounted. Views on phones have no focus(); screen readers move there themselves.
    const timer = setTimeout(() => {
      try {
        (closeRef.current as { focus?: () => void } | null)?.focus?.();
      } catch {
        // Not focusable here.
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={uiCopy.close}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(23,19,15,0.45)', cursor: 'auto' }}
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          style={[
            {
              width: '100%',
              maxWidth: theme.maxContentWidth,
              maxHeight: '90%',
              alignSelf: 'center',
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radii.sheet,
              borderTopRightRadius: theme.radii.sheet,
              borderWidth: theme.scheme === 'dark' ? 1 : 0,
              borderBottomWidth: 0,
              borderColor: theme.colors.line,
              paddingTop: theme.spacing.sm,
              paddingBottom: theme.spacing.lg + insets.bottom,
            },
            theme.shadows.lift,
          ]}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: theme.radii.pill, backgroundColor: theme.colors.line, marginBottom: theme.spacing.xs }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: theme.spacing.card, paddingRight: theme.spacing.md }}>
            <Text variant="heading" style={{ flex: 1 }}>
              {title}
            </Text>
            <Button ref={closeRef} variant="link" icon="x-mark" accessibilityLabel={uiCopy.close} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: theme.spacing.card, paddingTop: theme.spacing.sm }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
