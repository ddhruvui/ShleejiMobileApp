import React, { useState, useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { WEEK_DAYS } from "../utils/goalSync";

/** Picker order — Mon-first, matching the todo's weekly ECD strip. */
const PICKER_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PRESETS = [
  { label: "Every day", days: [...WEEK_DAYS] },
  { label: "Weekdays", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
  { label: "Weekends", days: ["Sat", "Sun"] },
];

/**
 * Choose which weekdays an under-progress step runs on (mirrors the web FE's
 * StepDaysModal). The selection becomes the `day_of_week` ECD of its task
 * under "One Step At A Time", and because the nightly archive only records a
 * result on days that ECD covers, it is also the set the habit's streak is
 * counted over — skipping a day the habit isn't scheduled on doesn't break it.
 */
export default function StepDaysModal({
  visible,
  goalName,
  stepName,
  initialDays,
  /** "start" picks the schedule for a step about to begin; "edit" changes a
   *  step already under progress. */
  mode,
  busy,
  onConfirm,
  onCancel,
}) {
  const [days, setDays] = useState(initialDays || WEEK_DAYS);

  useEffect(() => {
    if (visible) setDays(initialDays || WEEK_DAYS);
  }, [visible, initialDays]);

  // Always emitted in week order so it matches what the backend stores and
  // what the todo card renders.
  const selected = WEEK_DAYS.filter((d) => days.includes(d));

  const toggle = (day) =>
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );

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
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modal}>
            <Text style={styles.title}>
              {mode === "start" ? "Start step" : "Change days"}
            </Text>
            {stepName ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {stepName}
              </Text>
            ) : null}

            <View style={styles.dowRow}>
              {PICKER_ORDER.map((day) => {
                const on = days.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dowBtn, on && styles.dowBtnActive]}
                    onPress={() => toggle(day)}
                  >
                    <Text style={[styles.dowText, on && styles.dowTextActive]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.presetRow}>
              {PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={styles.presetBtn}
                  onPress={() => setDays([...preset.days])}
                >
                  <Text style={styles.presetText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.hint}>
              {selected.length === 0
                ? "Pick at least one day — a habit needs a day to run on."
                : `Due every ${selected.join(", ")}${goalName ? ` under "${goalName}"` : ""}. The streak counts only these days.`}
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  (busy || selected.length === 0) && styles.disabledBtn,
                ]}
                onPress={() => onConfirm(selected)}
                disabled={busy || selected.length === 0}
              >
                <Text style={styles.confirmText}>
                  {mode === "start" ? "Start step" : "Save days"}
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
  },
  subtitle: {
    fontSize: 13,
    color: "#656d76",
    marginTop: 2,
    marginBottom: 16,
  },
  dowRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  dowBtn: {
    width: 42,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
  },
  dowBtnActive: {
    backgroundColor: "#6200ee",
    borderColor: "#6200ee",
  },
  dowText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#656d76",
  },
  dowTextActive: {
    color: "#fff",
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  presetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
  },
  presetText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#656d76",
  },
  hint: {
    fontSize: 12,
    color: "#656d76",
    marginTop: 12,
    marginBottom: 20,
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
