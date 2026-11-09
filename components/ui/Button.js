import React from "react";
import { Pressable, Text, StyleSheet, View, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, HIT_TARGET } from "../../theme";

/**
 * Text button. Variants:
 *  - primary   filled brand colour — the one main action on a surface
 *  - secondary neutral filled — Cancel and other non-committal actions
 *  - tonal     soft brand tint — supporting actions
 *  - danger    filled red — irreversible actions (Delete, Reset)
 *  - dangerTonal soft red — destructive action that is not the main one
 *  - ghost     text only
 * Sizes: md (44pt, default) and lg (52pt, sheet footers / empty-state CTAs).
 */
const VARIANTS = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary },
  secondary: { bg: colors.surfaceMuted, pressed: colors.surfaceSunken, fg: colors.text },
  tonal: { bg: colors.primarySoft, pressed: colors.primaryBorder, fg: colors.primaryText },
  danger: { bg: colors.danger, pressed: colors.dangerText, fg: colors.white },
  dangerTonal: { bg: colors.dangerSoft, pressed: colors.dangerBorder, fg: colors.dangerText },
  ghost: { bg: "transparent", pressed: colors.surfaceMuted, fg: colors.primaryText },
};

export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  testID,
  accessibilityLabel,
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === "lg" && styles.lg,
        size === "sm" && styles.sm,
        { backgroundColor: pressed && !inactive ? v.pressed : v.bg },
        fullWidth && styles.fullWidth,
        inactive && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={v.fg} />
        ) : icon ? (
          <Ionicons name={icon} size={size === "sm" ? 16 : 18} color={v.fg} />
        ) : null}
        <Text
          style={[styles.text, size === "sm" && styles.textSm, { color: v.fg }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: HIT_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  lg: {
    minHeight: 52,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
  },
  sm: {
    minHeight: 36,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
  textSm: {
    fontSize: 14,
  },
  disabled: {
    opacity: 0.45,
  },
});
