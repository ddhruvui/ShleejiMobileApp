import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

function todayInputVal() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Add/edit a project task: a name plus an optional one-time target date.
 * Mirrors the todo's AddTaskModal interaction, but project tasks only
 * support plain dates (no recurring ECD types) — a dated task is mirrored
 * into the todo under a header named after the project.
 */
export default function ProjectTaskModal({
  visible,
  projectName,
  task, // { name, notes, date } when editing; undefined when adding
  onConfirm,
  onCancel,
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState("none");
  const [dateVal, setDateVal] = useState(todayInputVal());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setName(task ? task.name : "");
      setNotes(task && task.notes ? task.notes : "");
      setMode(task && task.date ? "date" : "none");
      setDateVal(task && task.date ? task.date : todayInputVal());
      setShowDatePicker(false);
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [visible, task]);

  const getDateForPicker = () => {
    if (dateVal && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      return new Date(dateVal + "T00:00:00");
    }
    return new Date();
  };

  const formatDateToISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type === "set" && selectedDate) {
      setDateVal(formatDateToISO(selectedDate));
      if (Platform.OS === "ios") {
        setShowDatePicker(false);
      }
    } else if (event.type === "dismissed") {
      setShowDatePicker(false);
    }
  };

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm({
      name: trimmed,
      notes,
      date: mode === "date" ? dateVal : null,
    });
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
              {task ? "Edit task" : "Add task"}{" "}
              <Text style={styles.titleFolder}>— {projectName}</Text>
            </Text>

            <TextInput
              ref={nameRef}
              style={styles.input}
              placeholder="Task name…"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              returnKeyType="done"
            />

            <Text style={styles.label}>Due</Text>
            <View style={styles.modeRow}>
              {["none", "date"].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                  onPress={() => setMode(m)}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      mode === m && styles.modeBtnTextActive,
                    ]}
                  >
                    {m === "none" ? "None" : "Date"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {mode === "date" && (
              <View>
                <TouchableOpacity
                  style={styles.dateSelectorBtn}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateSelectorText}>
                    {dateVal || "Select Date"}
                  </Text>
                  <Text style={styles.calendarIcon}>📅</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={getDateForPicker()}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onDateChange}
                  />
                )}
                <Text style={styles.hint}>
                  Will appear in the todo under "{projectName}"
                </Text>
              </View>
            )}

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes…"
              placeholderTextColor="#999"
              value={notes}
              onChangeText={setNotes}
              multiline
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
                  {task ? "Save" : "Add task"}
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
  titleFolder: {
    fontWeight: "400",
    color: "#656d76",
    fontSize: 15,
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
    fontSize: 12,
    fontWeight: "600",
    color: "#656d76",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1f2328",
    marginBottom: 8,
    backgroundColor: "#fafafa",
    minHeight: 72,
    textAlignVertical: "top",
  },
  modeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  modeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#f6f8fa",
  },
  modeBtnActive: {
    backgroundColor: "#6200ee",
    borderColor: "#6200ee",
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#555",
  },
  modeBtnTextActive: {
    color: "#fff",
  },
  dateSelectorBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fafafa",
    marginBottom: 8,
  },
  dateSelectorText: {
    fontSize: 15,
    color: "#1f2328",
    flex: 1,
  },
  calendarIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  hint: {
    fontSize: 12,
    color: "#656d76",
    fontStyle: "italic",
    marginBottom: 8,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
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
