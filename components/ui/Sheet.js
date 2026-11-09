import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, shadows, spacing, type } from "../../theme";

const OFFSCREEN = 600;
const DISMISS_DISTANCE = 110;

/**
 * Bottom sheet — the app's shell for every form (add/edit/schedule…).
 *
 * Why a sheet rather than a centred dialog: forms live in the thumb zone, the
 * keyboard pushes the sheet (not a floating box) up, and the grab handle can
 * be dragged down to dismiss. Irreversible confirmations still use the centred
 * ConfirmModal, which deliberately demands focused attention.
 *
 * The backdrop fades (Modal animationType="fade") while the sheet springs up
 * from below. Tapping the backdrop, dragging the handle down, or the Android
 * back button all call `onClose`.
 *
 * `footer` renders pinned under the scrollable body — put the actions there
 * (see SheetActions). `onDismiss` fires after the modal has fully closed on
 * iOS (used by ActionSheet to chain into another modal safely).
 */
export default function Sheet({
  visible,
  onClose,
  onDismiss,
  title,
  subtitle,
  headerRight,
  children,
  footer,
  scroll = true,
  dismissible = true,
  testID,
}) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(OFFSCREEN);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 24,
        stiffness: 260,
        mass: 0.9,
      }).start();
    }
  }, [visible, translateY]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          dismissible && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > DISMISS_DISTANCE || g.vy > 1.2) {
            Animated.timing(translateY, {
              toValue: OFFSCREEN,
              duration: 180,
              useNativeDriver: true,
            }).start(() => onClose?.());
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              damping: 22,
              stiffness: 260,
            }).start();
          }
        },
      }),
    [dismissible, onClose, translateY],
  );

  const bottomPad = Math.max(insets.bottom, spacing.lg);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.root}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissible ? onClose : undefined}
          accessibilityRole="button"
          accessibilityLabel="Close"
          testID={testID ? `${testID}-backdrop` : undefined}
        >
          <View style={styles.backdrop} />
        </Pressable>

        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { paddingBottom: footer ? 0 : bottomPad, transform: [{ translateY }] },
          ]}
        >
          <View {...pan.panHandlers} style={styles.grabZone}>
            <View style={styles.handle} />
            {title ? (
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text style={styles.subtitle} numberOfLines={2}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                {headerRight}
              </View>
            ) : null}
          </View>

          {scroll ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={styles.body}>{children}</View>
          )}

          {footer ? (
            <View style={[styles.footer, { paddingBottom: bottomPad }]}>{footer}</View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Standard footer row: a neutral Cancel on the left, the primary action
 * taking the remaining width. Children are laid out with `flex` so callers
 * can pass any Buttons.
 */
export function SheetActions({ children }) {
  return <View style={styles.actions}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: "92%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    ...shadows.raised,
  },
  grabZone: {
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...type.title,
  },
  subtitle: {
    ...type.subhead,
    marginTop: 2,
  },
  scroll: {
    flexGrow: 0,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
});
