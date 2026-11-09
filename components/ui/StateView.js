import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Button from "./Button";
import { colors, radii, spacing, type } from "../../theme";

/**
 * Centered spinner with an optional caption. Fills the area by default;
 * `compact` sizes it to its content (for a section inside a scroll view).
 */
export function LoadingState({ label = "Loading…", style, compact = false }) {
  return (
    <View
      style={[styles.center, compact ? styles.compact : styles.fill, style]}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text style={styles.loadingText}>{label}</Text> : null}
    </View>
  );
}

/**
 * Full-area load failure with a Retry button. Keeps the app's wording:
 * "Failed to load: <reason>" plus the backend hint.
 */
export function ErrorState({ message, hint = "Is the backend running?", onRetry, style }) {
  return (
    <View style={[styles.center, styles.fill, style]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="cloud-offline-outline" size={30} color={colors.danger} />
      </View>
      <Text style={styles.title}>Failed to load</Text>
      <Text style={styles.body}>{message}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {onRetry ? (
        <Button title="Retry" icon="refresh" onPress={onRetry} style={styles.cta} />
      ) : null}
    </View>
  );
}

/**
 * Friendly empty state: tinted icon, title, one line of guidance and an
 * optional call-to-action so the next step is one tap away.
 */
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  tone = "primary",
  style,
  compact = false,
}) {
  const bg = tone === "accent" ? colors.accentSoft : colors.primarySoft;
  const fg = tone === "accent" ? colors.accentText : colors.primary;
  return (
    // Full-size states fill the screen; a compact one sizes to its content.
    // (Never cancel `flex: 1` with `flex: 0` — on web that collapses the box
    // to zero height and the content spills out.)
    <View style={[styles.center, compact ? styles.compact : styles.fill, style]}>
      {icon ? (
        <View style={[styles.iconWrap, compact && styles.iconWrapSm, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={compact ? 22 : 32} color={fg} />
        </View>
      ) : null}
      <Text style={[styles.title, compact && styles.titleSm]}>{title}</Text>
      {message ? <Text style={styles.body}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          icon="add"
          onPress={onAction}
          size={compact ? "md" : "lg"}
          style={styles.cta}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.xxxl,
  },
  compact: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    ...type.subhead,
    marginTop: spacing.md,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.xl + 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  iconWrapSm: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  title: {
    ...type.title,
    textAlign: "center",
  },
  titleSm: {
    ...type.headline,
  },
  body: {
    ...type.subhead,
    textAlign: "center",
    marginTop: spacing.xs + 2,
  },
  hint: {
    ...type.footnote,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  cta: {
    marginTop: spacing.xl,
    minWidth: 160,
  },
});
