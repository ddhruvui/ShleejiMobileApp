import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

export default function GoalModal({ visible, goal, onConfirm, onCancel }) {
  const [name, setName] = useState("");
  const [stepsText, setStepsText] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setName(goal?.name || "");
      setStepsText(goal ? goal.steps.map((s) => s.name).join("\n") : "");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, goal]);

  const parsedSteps = stepsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm({ name: trimmed, stepNames: parsedSteps });
  }

  const disabled = !name.trim();

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
            <Text style={styles.title}>{goal ? "Edit Goal" : "Add Goal"}</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Goal name… (e.g. Improve Health)"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />
            <Text style={styles.label}>Steps</Text>
            <TextInput
              style={styles.textarea}
              placeholder={"One small step per line…\nWake up at 6\nHave 1 fruit a day"}
              placeholderTextColor="#999"
              value={stepsText}
              onChangeText={setStepsText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <Text style={styles.hint}>
              One step per line, in the order you want to build them —{" "}
              {parsedSteps.length} step{parsedSteps.length === 1 ? "" : "s"}
              {goal ? ". Steps keeping their name keep their progress." : ""}
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
                  {goal ? "Save" : "Add"}
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
