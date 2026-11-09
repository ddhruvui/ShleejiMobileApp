import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radii, spacing, tintFor, type } from "../../theme";

/** Thin rounded progress bar (0..1). */
export function ProgressBar({ value = 0, tone = "primary", height = 6, style, testID }) {
  const fill =
    tone === "accent" ? colors.accent : tone === "success" ? colors.success : colors.primary;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[styles.track, { height, borderRadius: height / 2 }, style]}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: fill,
        }}
      />
    </View>
  );
}

/** Uppercase section label with optional trailing content (count, progress). */
export function SectionHeader({ title, right, style }) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {right ? <View style={styles.sectionRight}>{right}</View> : null}
    </View>
  );
}

/** Initials in a soft, name-stable tint. */
export function Avatar({ name = "", size = 36 }) {
  const tint = tintFor(name);
  const initials =
    name
      .replace(/\(.*?\)/g, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint.bg },
      ]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Text style={[styles.avatarText, { color: tint.fg, fontSize: size * 0.38 }]}>
        {initials}
      </Text>
    </View>
  );
}

/** Count bubble used next to headings. */
export function CountPill({ count, style }) {
  return (
    <View style={[styles.countPill, style]}>
      <Text style={styles.countText}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surfaceSunken,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...type.overline,
    color: colors.textSecondary,
  },
  sectionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontWeight: "700",
  },
  countPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
});
