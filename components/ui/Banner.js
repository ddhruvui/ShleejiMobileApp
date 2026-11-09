import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import IconButton from "./IconButton";
import { colors, radii, spacing } from "../../theme";

/**
 * Inline status strip. Tones: danger (failed actions), info (vacation),
 * alert (on call — info surface with a red edge), warning, success.
 * `onPress` makes it a shortcut; `onDismiss` adds a close button.
 */
const TONES = {
  danger: { bg: colors.dangerSoft, border: colors.dangerBorder, edge: colors.danger, fg: colors.dangerText },
  info: { bg: colors.infoSoft, border: colors.infoBorder, edge: colors.info, fg: colors.infoText },
  alert: { bg: colors.surface, border: colors.dangerBorder, edge: colors.danger, fg: colors.dangerText },
  warning: { bg: colors.warningSoft, border: colors.warningBorder, edge: colors.warning, fg: colors.warningText },
  success: { bg: colors.successSoft, border: colors.successBorder, edge: colors.success, fg: colors.successText },
};

export default function Banner({
  tone = "info",
  icon,
  children,
  onPress,
  onDismiss,
  dismissLabel = "Dismiss",
  dashed = false,
  disabled = false,
  testID,
  style,
}) {
  const t = TONES[tone] || TONES.info;
  const body = (
    <>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: t.edge }]}>
          <Ionicons name={icon} size={15} color={colors.white} />
        </View>
      ) : null}
      <View style={styles.textWrap}>
        {typeof children === "string" ? (
          <Text style={[styles.text, { color: t.fg }]}>{children}</Text>
        ) : (
          children
        )}
      </View>
      {onDismiss ? (
        <IconButton icon="close" label={dismissLabel} onPress={onDismiss} size="sm" color={t.fg} />
      ) : onPress && !disabled ? (
        <Ionicons name="chevron-forward" size={18} color={t.fg} />
      ) : null}
    </>
  );
  const containerStyle = [
    styles.banner,
    { backgroundColor: t.bg, borderColor: t.border, borderLeftColor: t.edge },
    dashed && styles.dashed,
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        style={({ pressed }) => [containerStyle, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={containerStyle} accessibilityRole="alert">
      {body}
    </View>
  );
}

/** Body text for a banner — `strong` segments stand out in the tone colour. */
export function BannerText({ children, style }) {
  return <Text style={[styles.text, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 48,
  },
  dashed: {
    borderStyle: "dashed",
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  text: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
});
