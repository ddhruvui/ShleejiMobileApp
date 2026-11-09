import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, HIT_TARGET, hitSlop } from "../../theme";

/**
 * Icon-only button with a guaranteed 44pt touch target. `label` is required —
 * it is the accessible name, since nothing but the glyph is drawn.
 *
 * Variants: plain (no fill until pressed), tonal (soft brand), filled (brand),
 * danger (red glyph), muted (soft neutral fill), inverse (for dark viewers).
 */
const VARIANTS = {
  plain: { bg: "transparent", pressed: colors.surfaceMuted, fg: colors.textSecondary },
  muted: { bg: colors.surfaceMuted, pressed: colors.surfaceSunken, fg: colors.textSecondary },
  tonal: { bg: colors.primarySoft, pressed: colors.primaryBorder, fg: colors.primaryText },
  filled: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary },
  danger: { bg: "transparent", pressed: colors.dangerSoft, fg: colors.danger },
  inverse: { bg: "rgba(255,255,255,0.14)", pressed: "rgba(255,255,255,0.28)", fg: colors.white },
};

export default function IconButton({
  icon,
  label,
  onPress,
  onLongPress,
  variant = "plain",
  size = "md",
  color,
  disabled = false,
  style,
  testID,
}) {
  const v = VARIANTS[variant] || VARIANTS.plain;
  const box = size === "sm" ? 36 : size === "lg" ? 52 : HIT_TARGET;
  const glyph = size === "sm" ? 18 : size === "lg" ? 26 : 22;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={size === "sm" ? hitSlop : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          width: box,
          height: box,
          borderRadius: size === "lg" ? radii.lg : radii.md,
          backgroundColor: pressed && !disabled ? v.pressed : v.bg,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Ionicons name={icon} size={glyph} color={color || v.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.35,
  },
});
