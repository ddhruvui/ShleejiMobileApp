import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, shadows, HIT_TARGET } from "../theme";

/* Shared icon-only "+" used on every tab. It sits in the screen header, beside
   the large title — the one place each screen's "add" lives. Nothing shows but
   the plus, so `label` is the accessible name only — "Add header". Filled with
   the brand colour so it reads as the screen's primary action. */
export default function AddButton({ label, onPress, testID }) {
  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="add" size={26} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md + 2,
    ...shadows.card,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
  },
  pressed: {
    backgroundColor: colors.primaryPressed,
    transform: [{ scale: 0.96 }],
  },
});
