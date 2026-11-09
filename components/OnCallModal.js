import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  dateKeyOf,
  endMinutes,
  formatDuration,
  isOvernight,
  parseQuickAdd,
  shiftMinutes,
  startMinutes,
} from "../utils/oncall";
import { formatDateKey } from "../utils/ecd";

const RED = "#cf222e";
const RED_TEXT = "#a40e26";
const RED_SOFT = "rgba(207,34,46,0.08)";
const RED_BORDER = "rgba(207,34,46,0.55)";

/** "YYYY-MM-DD" → a local Date, parsed by component for timezone safety. */
function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Add or edit an on-call shift — a bottom sheet (mirrors the web FE's
 * OnCallModal).
 *
 * The quick-add field takes the shorthand the user already writes —
 * "11/16 9-22", with a trailing "s" for secondary — and fills the fields
 * below, which stay editable. Primary is the default type. Times are typed
 * rather than picked so "24:00" (until midnight) stays expressible.
 */
export default function OnCallModal({ shift, onConfirm, onCancel }) {
  const [quick, setQuick] = useState("");
  const [date, setDate] = useState(shift?.date ?? dateKeyOf(new Date()));
  const [start, setStart] = useState(shift?.start ?? "09:00");
  const [end, setEnd] = useState(shift?.end ?? "22:00");
  const [type, setType] = useState(shift?.type ?? "primary");
  const [note, setNote] = useState(shift?.note ?? "");
  const [picking, setPicking] = useState(false);
  const [formError, setFormError] = useState(null);

  const parsed = quick.trim() ? parseQuickAdd(quick, new Date()) : null;
  const timesValid = startMinutes(start) !== null && endMinutes(end) !== null;
  const minutes = timesValid ? shiftMinutes({ start, end }) : 0;

  function handleQuickChange(value) {
    setQuick(value);
    const result = value.trim() ? parseQuickAdd(value, new Date()) : null;
    if (result) {
      setDate(result.date);
      setStart(result.start);
      setEnd(result.end);
      setType(result.type);
      setFormError(null);
    }
  }

  function handleSubmit() {
    if (quick.trim() && !parsed) {
      setFormError("Use M/D start-end, like 11/16 9-22 (add s for secondary).");
      return;
    }
    if (!timesValid) {
      setFormError("Times must be HH:mm (end may be 24:00).");
      return;
    }
    if (minutes === 0) {
      setFormError("Start and end can't be the same.");
      return;
    }
    setFormError(null);
    onConfirm({ date, start, end, type, note: note.trim() });
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onCancel}
        />
        <View style={styles.sheet}>
          <Text style={styles.title}>
            {shift ? "Edit on-call shift" : "Add on-call shift"}
          </Text>

          <Text style={styles.label}>Quick add</Text>
          <TextInput
            style={[styles.input, styles.mono]}
            placeholder="11/16 9-22"
            placeholderTextColor="#8b949e"
            value={quick}
            onChangeText={handleQuickChange}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Quick add on-call shift"
          />
          {quick.trim() !== "" && (
            <Text style={[styles.preview, !parsed && styles.previewError]}>
              {parsed
                ? `${formatDateKey(parsed.date)} · ${parsed.start} → ${parsed.end}${isOvernight(parsed) ? " (+1 day)" : ""} · ${formatDuration(shiftMinutes(parsed))} · ${parsed.type}`
                : "Use M/D start-end, like 11/16 9-22 or 11/12 22-6 (add s for secondary)"}
            </Text>
          )}

          <Text style={styles.label}>Type</Text>
          <View style={styles.segmented}>
            {["primary", "secondary"].map((t, i) => {
              const active = type === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.seg,
                    i > 0 && styles.segDivider,
                    active && t === "primary" && styles.segPrimaryActive,
                    active && t === "secondary" && styles.segSecondaryActive,
                  ]}
                  onPress={() => setType(t)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                >
                  <Text
                    style={[
                      styles.segText,
                      active && t === "primary" && styles.segPrimaryText,
                      active && t === "secondary" && styles.segSecondaryText,
                    ]}
                  >
                    {t === "primary" ? "Primary" : "Secondary"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setPicking(true)}
          >
            <Text style={styles.inputText}>{formatDateKey(date)}</Text>
          </TouchableOpacity>
          {picking && (
            <DateTimePicker
              value={parseKey(date)}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selected) => {
                setPicking(false);
                if (selected) setDate(dateKeyOf(selected));
              }}
            />
          )}

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Start</Text>
              <TextInput
                style={[styles.input, styles.mono]}
                value={start}
                onChangeText={setStart}
                placeholder="09:00"
                placeholderTextColor="#8b949e"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>End</Text>
              <TextInput
                style={[styles.input, styles.mono]}
                value={end}
                onChangeText={setEnd}
                placeholder="22:00"
                placeholderTextColor="#8b949e"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Note (optional)"
            placeholderTextColor="#8b949e"
            value={note}
            onChangeText={setNote}
          />

          <Text style={styles.summary}>
            {minutes > 0
              ? `${formatDuration(minutes)}${isOvernight({ start, end }) ? " · ends next day" : ""}`
              : "Start and end can't be the same."}
          </Text>
          {formError && <Text style={styles.error}>{formError}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btn} onPress={onCancel}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={handleSubmit}
            >
              <Text style={[styles.btnText, styles.btnPrimaryText]}>
                {shift ? "Save" : "Add"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#1f2328", marginBottom: 10 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#656d76",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1f2328",
    marginBottom: 6,
  },
  inputText: { fontSize: 15, color: "#1f2328" },
  mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  preview: { fontSize: 12, color: "#656d76", marginBottom: 4 },
  previewError: { color: "#e74c3c" },
  segmented: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 6,
  },
  seg: { flex: 1, alignItems: "center", paddingVertical: 9 },
  segDivider: { borderLeftWidth: 1, borderLeftColor: "#d0d7de" },
  segPrimaryActive: { backgroundColor: RED },
  segSecondaryActive: {
    backgroundColor: RED_SOFT,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: RED_BORDER,
  },
  segText: { fontSize: 13, color: "#656d76", fontWeight: "600" },
  segPrimaryText: { color: "#fff" },
  segSecondaryText: { color: RED_TEXT },
  row: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  summary: { fontSize: 13, fontWeight: "600", color: "#1f2328", marginTop: 4 },
  error: { fontSize: 12, color: "#e74c3c", marginTop: 4 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d0d7de",
  },
  btnText: { fontSize: 15, color: "#656d76", fontWeight: "600" },
  btnPrimary: { backgroundColor: "#1e88e5", borderColor: "#1e88e5" },
  btnPrimaryText: { color: "#fff" },
});
