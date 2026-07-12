import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

/**
 * Dual-purpose add/edit modal for affirmations.
 *
 * - `affirmation` null  → add mode
 * - `affirmation` set   → edit mode (pre-filled, shows Delete)
 */
export default function AffirmationModal({
  visible,
  affirmation,
  onConfirm,
  onDelete,
  onCancel,
}) {
  const [name, setName] = useState("");
  const nameRef = useRef(null);

  const isEdit = affirmation != null;

  useEffect(() => {
    if (visible) {
      setName(affirmation ? affirmation.name : "");
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [visible]);

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modal}>
              <Text style={styles.title}>
                {isEdit ? "Edit affirmation" : "Add affirmation"}
              </Text>

              <TextInput
                ref={nameRef}
                style={styles.nameInput}
                placeholder="Affirmation…"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.actions}>
                {isEdit && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.actionsRight}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmBtn,
                      !name.trim() && styles.disabledBtn,
                    ]}
                    onPress={handleConfirm}
                    disabled={!name.trim()}
                  >
                    <Text style={styles.confirmText}>
                      {isEdit ? "Save" : "Add"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
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
    padding: 16,
  },
  keyboardView: {
    width: "100%",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: 360,
    maxWidth: "95%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2328",
    marginBottom: 16,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: "#1f2328",
    minHeight: 64,
    backgroundColor: "#fafafa",
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionsRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    flex: 1,
  },
  deleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fde8e8",
    marginRight: 10,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e74c3c",
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
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#1e88e5",
  },
  disabledBtn: {
    opacity: 0.5,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
