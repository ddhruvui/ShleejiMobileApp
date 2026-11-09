import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../../theme";

/**
 * Small status pill. Tones map to the semantic palette:
 * neutral | primary | accent | success | danger | warning | info.
 * `outline` draws a border instead of a fill (used for streaks).
 */
const TONES = {
  neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary, border: colors.border },
  primary: { bg: colors.primarySoft, fg: colors.primaryText, border: colors.primaryBorder },
  accent: { bg: colors.accentSoft, fg: colors.accentText, border: colors.accentBorder },
  success: { bg: colors.successSoft, fg: colors.successText, border: colors.successBorder },
  danger: { bg: colors.dangerSoft, fg: colors.dangerText, border: colors.dangerBorder },
  warning: { bg: colors.warningSoft, fg: colors.warningText, border: colors.warningBorder },
  info: { bg: colors.infoSoft, fg: colors.infoText, border: colors.infoBorder },
};

export default function Badge({
  label,
  tone = "neutral",
  icon,
  outline = false,
  style,
  textStyle,
  accessibilityLabel,
  testID,
}) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <View
      testID={testID}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.badge,
        outline
          ? { borderColor: t.border, borderWidth: 1, backgroundColor: colors.surface }
          : { backgroundColor: t.bg },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={11} color={t.fg} /> : null}
      <Text style={[styles.text, { color: t.fg }, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minHeight: 20,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
});
