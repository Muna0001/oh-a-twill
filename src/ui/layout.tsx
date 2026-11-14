import { useContext, useState, type ReactNode, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Button } from './Button';
import { uiCopy } from './copy';
import { Icon, type IconName } from './Icon';
import { goBackOrHome } from './lazy';
import { Text } from './Text';
import { useTheme } from './theme';

const zeroInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Safe-area insets, or zeros when no SafeAreaProvider is mounted (tests). */
export function useInsets() {
  return useContext(SafeAreaInsetsContext) ?? zeroInsets;
}

export type ScreenEdge = 'top' | 'bottom';

export type ScreenProps = {
  children?: ReactNode;
  /** Wrap the content in a vertical ScrollView. Default false. */
  scroll?: boolean;
  /** Ref to that ScrollView (with `scroll`), e.g. to bring a card back into view on phones. */
  scrollRef?: Ref<ScrollView>;
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
  /** Horizontal 16 and top 20 padding around the content column. Default true. */
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
    padded ? { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xl } : null,
  ];
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        backgroundColor: theme.colors.bg,
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
          <View style={[column, contentStyle]}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[column, { flex: 1, paddingBottom: bottomInset }, contentStyle]}>{children}</View>
      )}
      {footer}
    </View>
  );
}

export type PanelProps = {
  children?: ReactNode;
  /** 'hero' draws the 2 px ink border of the current-row card. Default 'default'. */
  variant?: 'default' | 'hero';
  style?: StyleProp<ViewStyle>;
  /** Names the group for screen readers. */
  accessibilityLabel?: string;
  testID?: string;
};

export function Panel({ children, variant = 'default', style, accessibilityLabel, testID }: PanelProps) {
  const theme = useTheme();
  const hero = variant === 'hero';
  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderColor: hero ? theme.colors.ink : theme.colors.line,
          borderWidth: hero ? 2 : 1,
          borderRadius: theme.radii.panel,
          padding: theme.spacing.lg,
          marginBottom: theme.spacing.lg,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export type HeaderProps = {
  title: string;
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

export function Header({ title, subtitle, back, onBack, backLabel = uiCopy.back, right, testID }: HeaderProps) {
  const theme = useTheme();
  const showBack = back ?? !!onBack;
  const goBack = () => {
    if (onBack) onBack();
    else goBackOrHome();
  };
  return (
    <View testID={testID} style={{ marginBottom: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: theme.minTouch }}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            onPress={goBack}
            hitSlop={4}
            style={({ pressed }) => ({
              width: theme.minTouch,
              height: theme.minTouch,
              marginLeft: -10,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.button,
              cursor: 'pointer',
              opacity: pressed ? 0.6 : 1,
            })}>
            <Icon name="chevron-left" size={24} />
          </Pressable>
        ) : null}
        <Text variant="title" style={{ flex: 1 }}>
          {title}
        </Text>
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

/** Bar pinned under the content. Pass it to `Screen`'s `footer`. Pads the bottom safe area itself. */
export function BottomBar({ left, center, right, testID }: BottomBarProps) {
  const theme = useTheme();
  const insets = useInsets();
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: theme.colors.line,
        paddingTop: 10,
        paddingBottom: 10 + insets.bottom,
        paddingHorizontal: theme.spacing.lg,
      }}>
      <View
        style={{
          width: '100%',
          maxWidth: theme.maxContentWidth,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        }}>
        {left}
        <View style={{ flex: 1, alignItems: 'center' }}>
          {typeof center === 'string' || typeof center === 'number' ? (
            <Text weight="semibold" tabular align="center" accessibilityLiveRegion="polite">
              {center}
            </Text>
          ) : (
            center
          )}
        </View>
        {right}
      </View>
    </View>
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
        onPress={toggle}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
          minHeight: theme.minTouch,
          marginVertical: -10,
          cursor: 'pointer',
          opacity: pressed ? 0.7 : 1,
        })}>
        <Text variant="heading" accessibilityRole="text" style={{ flex: 1 }}>
          {title}
        </Text>
        <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
          <Icon name="chevron-down" />
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
  testID?: string;
};

export function EmptyState({ title, message, icon, action, testID }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View testID={testID} style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xxl, paddingHorizontal: theme.spacing.lg }}>
      {icon ? <Icon name={icon} size={36} color="muted" strokeWidth={1.5} /> : null}
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

/** Modal sheet that rises from the bottom edge. */
export function Sheet({ visible, onClose, title, children, testID }: SheetProps) {
  const theme = useTheme();
  const insets = useInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={uiCopy.close}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(10,13,20,0.5)', cursor: 'auto' }}
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: theme.maxContentWidth,
            maxHeight: '90%',
            alignSelf: 'center',
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radii.panel,
            borderTopRightRadius: theme.radii.panel,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: theme.colors.line,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.lg + insets.bottom,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: theme.spacing.lg, paddingRight: theme.spacing.sm }}>
            <Text variant="heading" style={{ flex: 1 }}>
              {title}
            </Text>
            <Button variant="link" icon="x-mark" accessibilityLabel={uiCopy.close} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
