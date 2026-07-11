import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

export default function EventModal({ visible, event, onConfirm, onCancel }) {
  const [name, setName] = useState("");
  const [tasksText, setTasksText] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setName(event?.name || "");
      setTasksText(event ? event.tasks.join("\n") : "");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, event]);

  const parsedTasks = tasksText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || parsedTasks.length === 0) return;
    onConfirm({ name: trimmed, tasks: parsedTasks });
  }

  const disabled = !name.trim() || parsedTasks.length === 0;

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
              {event ? "Edit Event" : "Add Event"}
            </Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Event name… (e.g. Burger Night)"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />
            <Text style={styles.label}>Tasks</Text>
            <TextInput
              style={styles.textarea}
              placeholder={"One task per line…\nProcure onion\nProcure bun"}
              placeholderTextColor="#999"
              value={tasksText}
              onChangeText={setTasksText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <Text style={styles.hint}>
              One task per line — {parsedTasks.length} task
              {parsedTasks.length === 1 ? "" : "s"}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, disabled && styles.disabledBtn]}
                onPress={handleSubmit}
                disabled={disabled}
              >
                <Text style={styles.confirmText}>
                  {event ? "Save" : "Add"}
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
    marginBottom: 16,
    backgroundColor: "#fafafa",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#656d76",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textarea: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1f2328",
    backgroundColor: "#fafafa",
    minHeight: 120,
  },
  hint: {
    fontSize: 12,
    color: "#656d76",
    fontStyle: "italic",
    marginTop: 6,
    marginBottom: 16,
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
