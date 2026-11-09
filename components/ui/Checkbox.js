import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, HIT_TARGET } from "../../theme";

/**
 * Square checkbox (24pt box inside a 44pt touch target) with a small "pop"
 * when it becomes checked. `tone` picks the checked colour: primary for
 * tasks/calls, success for things that are done-done, accent for practice.
 */
const TONES = {
  primary: colors.primary,
  success: colors.success,
  accent: colors.accent,
};

export default function Checkbox({
  checked,
  onPress,
  label,
  tone = "primary",
  disabled = false,
  shape = "square",
  testID,
  style,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (checked) {
      scale.setValue(0.82);
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [checked, scale]);

  const fill = TONES[tone] || TONES.primary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: !!checked, disabled }}
      style={[styles.hit, style]}
    >
      <Animated.View
        style={[
          styles.box,
          shape === "circle" && styles.circle,
          checked && { backgroundColor: fill, borderColor: fill },
          disabled && styles.disabled,
          { transform: [{ scale }] },
        ]}
      >
        {checked ? (
          <Ionicons name="checkmark" size={16} color={colors.white} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: radii.xs + 1,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    borderRadius: 12,
  },
  disabled: {
    opacity: 0.4,
  },
});
