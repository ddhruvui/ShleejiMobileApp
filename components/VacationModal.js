import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

/** "YYYY-MM-DD" for a JS Date, built by component (never via toISOString, which shifts). */
function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" → a local Date, parsed by component for timezone safety. */
function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days a range covers, both ends inclusive — a one-day trip is 1. */
function lengthOf(startDate, endDate) {
  return (
    Math.round(
      (Date.parse(`${endDate}T00:00:00Z`) -
        Date.parse(`${startDate}T00:00:00Z`)) /
        86400000,
    ) + 1
  );
}

/**
 * Book or correct a vacation.
 *
 * Two dates rather than a toggle, because **both are mandatory**: that is what
 * lets a trip be booked months ahead, which is the case that actually needs
 * planning. Coming home early, or forgetting to book it on the first morning,
 * are both edits to a stored range rather than a different state to carry.
 */
export default function VacationModal({ vacation, onConfirm, onCancel }) {
  const today = dateKey(new Date());
  const [startDate, setStartDate] = useState(vacation?.startDate ?? today);
  const [endDate, setEndDate] = useState(vacation?.endDate ?? today);
  const [note, setNote] = useState(vacation?.note ?? "");
  const [picking, setPicking] = useState(null); // "start" | "end" | null

  const invalid = endDate < startDate;

  function handlePicked(which, event, selected) {
    setPicking(null);
    if (!selected) return;
    const key = dateKey(selected);
    if (which === "start") {
      setStartDate(key);
      // Keep the end from falling behind the start as the user picks.
      if (endDate < key) setEndDate(key);
    } else {
      setEndDate(key);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>
            {vacation ? "Edit Vacation" : "Book Vacation"}
          </Text>
          <Text style={styles.hint}>
            Both days count — the day you leave and the day you get back are
            both vacation days.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Note… (optional, e.g. Kerala trip)"
            placeholderTextColor="#8b949e"
            value={note}
            onChangeText={setNote}
          />

          <Text style={styles.label}>First day</Text>
          <TouchableOpacity
            style={styles.dateBtn}
            onPress={() => setPicking("start")}
          >
            <Text style={styles.dateBtnText}>{startDate}</Text>
            <Text style={styles.calendarIcon}>📅</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Last day</Text>
          <TouchableOpacity
            style={styles.dateBtn}
            onPress={() => setPicking("end")}
          >
            <Text style={styles.dateBtnText}>{endDate}</Text>
            <Text style={styles.calendarIcon}>📅</Text>
          </TouchableOpacity>

          {picking && (
            <DateTimePicker
              value={parseKey(picking === "start" ? startDate : endDate)}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selected) =>
                handlePicked(picking, event, selected)
              }
            />
          )}

          <Text style={[styles.summary, invalid && styles.summaryError]}>
            {invalid
              ? "The last day can't be before the first day."
              : `${lengthOf(startDate, endDate)} day${
                  lengthOf(startDate, endDate) === 1 ? "" : "s"
                } off`}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btn} onPress={onCancel}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, invalid && styles.btnDisabled]}
              disabled={invalid}
              onPress={() =>
                onConfirm({ startDate, endDate, note: note.trim() })
              }
            >
              <Text style={[styles.btnText, styles.btnPrimaryText]}>
                {vacation ? "Save" : "Book"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2328",
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: "#656d76",
    marginBottom: 14,
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1f2328",
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#656d76",
    marginBottom: 6,
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  dateBtnText: { fontSize: 15, color: "#1f2328" },
  calendarIcon: { fontSize: 16 },
  summary: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2328",
    marginBottom: 16,
  },
  summaryError: { color: "#cf222e" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d0d7de",
  },
  btnText: { fontSize: 14, color: "#1f2328", fontWeight: "600" },
  btnPrimary: { backgroundColor: "#1e88e5", borderColor: "#1e88e5" },
  btnPrimaryText: { color: "#fff" },
  btnDisabled: { opacity: 0.5 },
});
