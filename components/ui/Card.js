import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { colors, radii, shadows } from "../../theme";

/**
 * White rounded surface. Pass `onPress` to make the whole card tappable
 * (it dims slightly while pressed). `padded={false}` for list cards whose
 * rows bring their own padding.
 */
export default function Card({
  children,
  onPress,
  onLongPress,
  padded = true,
  style,
  testID,
  accessibilityLabel,
  accessibilityHint,
}) {
  if (onPress || onLongPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [
          styles.card,
          padded && styles.padded,
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  padded: {
    padding: 16,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.995 }],
  },
});
