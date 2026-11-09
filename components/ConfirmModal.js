import React, { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, TextField } from "./ui";
import { colors, radii, shadows, spacing, type } from "../theme";

/**
 * Centred confirmation for irreversible actions (delete, reset). Unlike forms
 * — which use bottom sheets — this stays a centred dialog on purpose: it is a
 * deliberate interruption that asks for focused reading before committing.
 */
export default function ConfirmModal({
  visible,
  message,
  title = "Are you sure?",
  confirmLabel = "Delete",
  icon = "trash-outline",
  onConfirm,
  onCancel,
  // When true, show a required reason field; Delete stays disabled until it is filled.
  requireReason = false,
  reasonLabel = "Why are you deleting this?",
}) {
  const [reason, setReason] = useState("");

  // Reset the field whenever the modal opens/closes (matches the app's modal convention)
  useEffect(() => {
    setReason("");
  }, [visible]);

  const trimmed = reason.trim();
  const canConfirm = !requireReason || trimmed.length > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(requireReason ? trimmed : undefined);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        />
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={24} color={colors.danger} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          {requireReason && (
            <TextField
              label={reasonLabel}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. no longer needed, too big, ran out of time…"
              multiline
              minHeight={72}
              autoFocus
              style={styles.reason}
            />
          )}
          <View style={styles.actions}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
              style={styles.flex}
            />
            <Button
              title={confirmLabel}
              variant="danger"
              onPress={handleConfirm}
              disabled={!canConfirm}
              style={styles.flex}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },
  dialog: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.xl + 4,
    padding: spacing.xxl,
    ...shadows.raised,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: {
    ...type.title,
    fontSize: 20,
    marginBottom: spacing.xs + 2,
  },
  message: {
    ...type.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  reason: {
    marginTop: -spacing.xs,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
});
