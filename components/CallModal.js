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

const FREQUENCIES = [
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
];

/**
 * Dual-purpose add/edit modal for calls (people to ring).
 *
 * - `call` null  → add mode
 * - `call` set   → edit mode (pre-filled)
 *
 * onConfirm receives { name, frequency }.
 */
export default function CallModal({ visible, call, onConfirm, onCancel }) {
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("biweekly");
  const nameRef = useRef(null);

  const isEdit = call != null;

  useEffect(() => {
    if (visible) {
      setName(call ? call.name : "");
      setFrequency(call ? call.frequency : "biweekly");
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [visible]);

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm({ name: trimmed, frequency });
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
                {isEdit ? "Edit Call" : "Add Call"}
              </Text>

              <TextInput
                ref={nameRef}
                style={styles.nameInput}
                placeholder="Person to call… (e.g. Grandma)"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
              />

              <View style={styles.frequencyRow}>
                {FREQUENCIES.map(({ value, label }) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.frequencyBtn,
                      frequency === value && styles.frequencyBtnActive,
                    ]}
                    onPress={() => setFrequency(value)}
                  >
                    <Text
                      style={[
                        styles.frequencyText,
                        frequency === value && styles.frequencyTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.actions}>
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
    backgroundColor: "#fafafa",
    marginBottom: 16,
  },
  frequencyRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  frequencyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#fafafa",
    alignItems: "center",
  },
  frequencyBtnActive: {
    backgroundColor: "#e8f0fe",
    borderColor: "#1e88e5",
  },
  frequencyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#656d76",
  },
  frequencyTextActive: {
    color: "#1e88e5",
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
