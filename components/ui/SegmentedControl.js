import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, shadows } from "../../theme";

/**
 * iOS-style segmented control for 2–4 closely related choices that change how
 * the same content is shown (e.g. Lists / By date). Not for navigation.
 * options: [{ value, label, icon? }]
 */
export default function SegmentedControl({ options, value, onChange, testID, style }) {
  return (
    <View style={[styles.track, style]} accessibilityRole="tablist" testID={testID}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            {opt.icon ? (
              <Ionicons
                name={opt.icon}
                size={15}
                color={active ? colors.text : colors.textSecondary}
              />
            ) : null}
            <Text style={[styles.text, active && styles.textActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.md,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: 34,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm + 1,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  textActive: {
    color: colors.text,
  },
});
