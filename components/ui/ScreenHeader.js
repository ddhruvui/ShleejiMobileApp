import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, type } from "../../theme";

/**
 * Large-title screen header (iOS style): sits on the page background, clears
 * the status bar / notch via safe-area insets (never a hard-coded padding),
 * and keeps the screen's actions — e.g. the AddButton — beside the title.
 */
export default function ScreenHeader({ title, subtitle, right, children, testID }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID={testID}
      style={[styles.wrap, { paddingTop: insets.top + spacing.md }]}
    >
      <View style={styles.row}>
        <View style={styles.titles}>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  titles: {
    flex: 1,
  },
  subtitle: {
    ...type.overline,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  title: {
    ...type.largeTitle,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
