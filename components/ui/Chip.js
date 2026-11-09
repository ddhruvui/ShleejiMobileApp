import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "../../theme";

/**
 * Selectable pill — used for view filters (Todo's panel row), mode pickers
 * and day pickers. Selected chips fill with the brand colour.
 */
export default function Chip({
  label,
  icon,
  selected = false,
  onPress,
  disabled = false,
  size = "md",
  testID,
  accessibilityLabel,
  style,
}) {
  const fg = selected ? colors.onPrimary : colors.textSecondary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        size === "sm" && styles.chipSm,
        selected ? styles.selected : pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={size === "sm" ? 14 : 16} color={fg} /> : null}
      <Text style={[styles.text, size === "sm" && styles.textSm, { color: fg }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSm: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  disabled: {
    opacity: 0.45,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
  },
  textSm: {
    fontSize: 13,
  },
});
