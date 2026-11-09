import React, { useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Sheet from "./Sheet";
import Button from "./Button";
import { colors, radii, spacing, type } from "../../theme";

/**
 * Overflow menu ("⋯") as a bottom sheet. Replaces rows of tiny inline icons:
 * each row keeps one obvious tap (open/edit) and secondary actions — move,
 * rename, delete — live here at full width.
 *
 * actions: [{ key, label, icon, onPress, destructive?, disabled?, hint? }]
 *
 * The chosen action runs *after* the sheet has closed: on iOS a second Modal
 * cannot present while the first is still dismissing, so we wait for the
 * modal's onDismiss (with a timer fallback); Android/web run it right away.
 */
const IOS_FALLBACK_MS = 600;

export default function ActionSheet({ visible, title, subtitle, actions = [], onClose, testID }) {
  const pending = useRef(null);
  const timer = useRef(null);

  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const fn = pending.current;
    pending.current = null;
    if (fn) fn();
  };

  const choose = (action) => {
    if (action.disabled) return;
    onClose?.();
    if (Platform.OS === "ios") {
      pending.current = action.onPress;
      timer.current = setTimeout(flush, IOS_FALLBACK_MS);
    } else {
      action.onPress?.();
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onDismiss={flush}
      title={title}
      subtitle={subtitle}
      testID={testID}
      footer={<Button title="Cancel" variant="secondary" size="lg" onPress={onClose} fullWidth />}
    >
      <View style={styles.list}>
        {actions.map((a, i) => {
          const tint = a.destructive ? colors.danger : colors.text;
          return (
            <Pressable
              key={a.key || a.label}
              testID={a.testID}
              onPress={() => choose(a)}
              disabled={a.disabled}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              accessibilityState={{ disabled: !!a.disabled }}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.rowDivider,
                pressed && styles.rowPressed,
                a.disabled && styles.rowDisabled,
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: a.destructive ? colors.dangerSoft : colors.surfaceMuted },
                ]}
              >
                <Ionicons name={a.icon || "ellipse-outline"} size={19} color={tint} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: tint }]}>{a.label}</Text>
                {a.hint ? <Text style={styles.hint}>{a.hint}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowDisabled: {
    opacity: 0.38,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.sm + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
  },
  label: {
    ...type.callout,
    fontSize: 16,
  },
  hint: {
    ...type.footnote,
    marginTop: 1,
  },
});
