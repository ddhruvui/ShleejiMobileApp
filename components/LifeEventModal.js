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

// Max day per month (1-indexed); Feb 29 is allowed — the backend cron fires
// it on Feb 28 in non-leap years.
const MAX_DAYS_BY_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Dual-purpose add/edit modal for life events (annually recurring dates).
 *
 * - `lifeEvent` null  → add mode
 * - `lifeEvent` set   → edit mode (pre-filled)
 *
 * The stored date is a "D/M" string (no zero-padding, no year), parsed
 * manually (never via Date). onConfirm receives { name, date }.
 */
export default function LifeEventModal({
  visible,
  lifeEvent,
  onConfirm,
  onCancel,
}) {
  const [name, setName] = useState("");
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(1);
  const nameRef = useRef(null);

  const isEdit = lifeEvent != null;

  useEffect(() => {
    if (visible) {
      const [initialDay, initialMonth] = lifeEvent
        ? lifeEvent.date.split("/").map(Number)
        : [1, 1];
      setName(lifeEvent ? lifeEvent.name : "");
      setDay(initialDay);
      setMonth(initialMonth);
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [visible]);

  const maxDay = MAX_DAYS_BY_MONTH[month - 1];

  function handleMonthChange(newMonth) {
    setMonth(newMonth);
    // Keep the day valid for the newly picked month
    setDay((d) => Math.min(d, MAX_DAYS_BY_MONTH[newMonth - 1]));
  }

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm({ name: trimmed, date: `${day}/${month}` });
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
                {isEdit ? "Edit Life Event" : "Add Life Event"}
              </Text>

              <TextInput
                ref={nameRef}
                style={styles.nameInput}
                placeholder="Life event… (e.g. Wife's birthday)"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.fieldLabel}>Month</Text>
              <View style={styles.monthRow}>
                {SHORT_MONTHS.map((label, idx) => (
                  <TouchableOpacity
                    key={label}
                    style={[
                      styles.monthBtn,
                      month === idx + 1 && styles.pickBtnActive,
                    ]}
                    onPress={() => handleMonthChange(idx + 1)}
                  >
                    <Text
                      style={[
                        styles.pickText,
                        month === idx + 1 && styles.pickTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Day</Text>
              <View style={styles.dayGrid}>
                {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.dayBtn,
                      day === d && styles.pickBtnActive,
                    ]}
                    onPress={() => setDay(d)}
                  >
                    <Text
                      style={[
                        styles.pickText,
                        day === d && styles.pickTextActive,
                      ]}
                    >
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.hint}>
                Repeats every year — it lands in your todo on the day.
              </Text>

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
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#656d76",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  monthRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 12,
  },
  monthBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#f6f8fa",
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 8,
  },
  dayBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#f6f8fa",
    justifyContent: "center",
    alignItems: "center",
  },
  pickBtnActive: {
    backgroundColor: "#6200ee",
    borderColor: "#6200ee",
  },
  pickText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#555",
  },
  pickTextActive: {
    color: "#fff",
  },
  hint: {
    fontSize: 12,
    color: "#656d76",
    fontStyle: "italic",
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
