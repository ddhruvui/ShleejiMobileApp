import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

// Format Date to YYYY-MM-DD (local time, matches EcdPicker)
function formatDateToISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ScheduleEventModal({
  visible,
  event,
  initialSelected, // tasks pre-checked when the modal opens; defaults to all
  onConfirm,
  onCancel,
}) {
  const [date, setDate] = useState(formatDateToISO(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (visible && event) {
      setDate(formatDateToISO(new Date()));
      setShowDatePicker(false);
      if (!initialSelected) {
        setSelected(new Set(event.tasks.map((_, i) => i)));
      } else {
        setSelected(
          new Set(
            event.tasks
              .map((task, i) => (initialSelected.includes(task) ? i : -1))
              .filter((i) => i >= 0),
          ),
        );
      }
    }
  }, [visible, event, initialSelected]);

  if (!event) return null;

  const allSelected = selected.size === event.tasks.length;

  function toggleTask(index) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected(
      allSelected ? new Set() : new Set(event.tasks.map((_, i) => i)),
    );
  }

  const onDateChange = (e, selectedDate) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (e.type === "set" && selectedDate) {
      setDate(formatDateToISO(selectedDate));
      if (Platform.OS === "ios") {
        setShowDatePicker(false);
      }
    } else if (e.type === "dismissed") {
      setShowDatePicker(false);
    }
  };

  function handleConfirm() {
    if (selected.size === 0) return;
    onConfirm({
      date,
      tasks: event.tasks.filter((_, i) => selected.has(i)),
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
              Add to todo <Text style={styles.titleEvent}>— {event.name}</Text>
            </Text>

            {/* Date */}
            <Text style={styles.label}>Date</Text>
            <TouchableOpacity
              style={styles.dateSelectorBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateSelectorText}>{date}</Text>
              <Text style={styles.calendarIcon}>📅</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={new Date(date + "T00:00:00")}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onDateChange}
              />
            )}

            {/* Task checklist */}
            <View style={styles.tasksHeader}>
              <Text style={styles.label}>Tasks</Text>
              <TouchableOpacity style={styles.toggleAllBtn} onPress={toggleAll}>
                <Text style={styles.toggleAllText}>
                  {allSelected ? "Unselect all" : "Select all"}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.taskList}>
              {event.tasks.map((task, i) => {
                const isChecked = selected.has(i);
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.taskRow}
                    onPress={() => toggleTask(i)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isChecked ? "checkbox" : "square-outline"}
                      size={22}
                      color={isChecked ? "#6200ee" : "#999"}
                    />
                    <Text
                      style={[
                        styles.taskName,
                        !isChecked && styles.taskNameUnselected,
                      ]}
                    >
                      {task}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  selected.size === 0 && styles.disabledBtn,
                ]}
                onPress={handleConfirm}
                disabled={selected.size === 0}
              >
                <Text style={styles.confirmText}>
                  Add {selected.size} task{selected.size === 1 ? "" : "s"}
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
    maxHeight: "85%",
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
  titleEvent: {
    fontWeight: "400",
    color: "#656d76",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#656d76",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
    marginBottom: 16,
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
  tasksHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#f6f8fa",
    marginBottom: 8,
  },
  toggleAllText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#555",
  },
  taskList: {
    maxHeight: 260,
    marginBottom: 16,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
  },
  taskName: {
    fontSize: 15,
    color: "#1f2328",
    flex: 1,
  },
  taskNameUnselected: {
    color: "#999",
    textDecorationLine: "line-through",
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
    backgroundColor: "#1a7f37",
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
