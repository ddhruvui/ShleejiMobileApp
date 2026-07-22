import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

export default function ConfirmModal({
  visible,
  message,
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
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modal}>
            <Text style={styles.message}>{message}</Text>
            {requireReason && (
              <View style={styles.reasonWrap}>
                <Text style={styles.reasonLabel}>{reasonLabel}</Text>
                <TextInput
                  style={styles.reasonInput}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. no longer needed, too big, ran out of time…"
                  placeholderTextColor="#999"
                  multiline
                  autoFocus
                />
              </View>
            )}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, !canConfirm && styles.deleteBtnDisabled]}
                onPress={handleConfirm}
                disabled={!canConfirm}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: 320,
    maxWidth: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  message: {
    fontSize: 16,
    color: "#1f2328",
    marginBottom: 20,
    lineHeight: 22,
  },
  reasonWrap: {
    marginBottom: 20,
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1f2328",
    minHeight: 64,
    textAlignVertical: "top",
    backgroundColor: "#fafafa",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
  },
  deleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#e74c3c",
  },
  deleteBtnDisabled: {
    opacity: 0.45,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
