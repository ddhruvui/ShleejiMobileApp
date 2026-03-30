import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

export default function HeaderModal({
  visible,
  headerName,
  onConfirm,
  onCancel,
}) {
  const [name, setName] = useState(headerName || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setName(headerName || "");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, headerName]);

  function handleSubmit() {
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
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modal}>
            <Text style={styles.title}>
              {headerName ? "Edit Header" : "Add Header"}
            </Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Header name…"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
            />
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !name.trim() && styles.disabledBtn]}
                onPress={handleSubmit}
                disabled={!name.trim()}
              >
                <Text style={styles.confirmText}>
                  {headerName ? "Save" : "Add"}
                </Text>
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
    width: 340,
    maxWidth: "90%",
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
  input: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2328",
    marginBottom: 20,
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
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#6200ee",
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
