import React, { useState } from "react";
import { StyleSheet, View, Text, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Sheet, SheetActions, Button, TextField, FieldLabel } from "./ui";
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
import { colors, radii, spacing, type as typography, HIT_TARGET } from "../theme";

/** "YYYY-MM-DD" → a local Date, parsed by component for timezone safety. */
function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const MONO = Platform.OS === "ios" ? "Menlo" : "monospace";

/**
 * Add or edit an on-call shift — a bottom sheet (mirrors the web FE's
 * OnCallModal).
 *
 * The quick-add field takes the shorthand the user already writes —
 * "11/16 9-22", with a trailing "s" for secondary — and fills the fields
 * below, which stay editable. Primary is the default type. Times are typed
 * rather than picked so "24:00" (until midnight) stays expressible.
 */
export default function OnCallModal({ shift, onConfirm, onCancel, visible = true }) {
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

  const quickTyped = quick.trim() !== "";

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={shift ? "Edit on-call shift" : "Add on-call shift"}
      testID="oncall-sheet"
      footer={
        <SheetActions>
          <Button
            title="Cancel"
            variant="secondary"
            size="lg"
            onPress={onCancel}
            style={styles.cancel}
          />
          <Button
            title={shift ? "Save" : "Add"}
            size="lg"
            onPress={handleSubmit}
            style={styles.primary}
          />
        </SheetActions>
      }
    >
      <TextField
        label="Quick add"
        placeholder="11/16 9-22"
        value={quick}
        onChangeText={handleQuickChange}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Quick add on-call shift"
        inputStyle={styles.mono}
        helper={
          quickTyped && parsed
            ? `${formatDateKey(parsed.date)} · ${parsed.start} → ${parsed.end}${isOvernight(parsed) ? " (+1 day)" : ""} · ${formatDuration(shiftMinutes(parsed))} · ${parsed.type}`
            : undefined
        }
        error={
          quickTyped && !parsed
            ? "Use M/D start-end, like 11/16 9-22 or 11/12 22-6 (add s for secondary)"
            : undefined
        }
      />

      <FieldLabel>Type</FieldLabel>
      <View style={styles.segmented} accessibilityRole="radiogroup">
        {["primary", "secondary"].map((t) => {
          const active = type === t;
          const label = t === "primary" ? "Primary" : "Secondary";
          return (
            <Pressable
              key={t}
              style={({ pressed }) => [
                styles.seg,
                pressed && !active && styles.segPressed,
                active && t === "primary" && styles.segPrimaryActive,
                active && t === "secondary" && styles.segSecondaryActive,
              ]}
              onPress={() => setType(t)}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: active }}
            >
              <Text
                style={[
                  styles.segText,
                  active && t === "primary" && styles.segPrimaryText,
                  active && t === "secondary" && styles.segSecondaryText,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FieldLabel>Date</FieldLabel>
      <Pressable
        onPress={() => setPicking(true)}
        accessibilityRole="button"
        accessibilityLabel={`Date, ${formatDateKey(date)}`}
        accessibilityHint="Opens the date picker"
        style={({ pressed }) => [styles.dateBtn, pressed && styles.dateBtnPressed]}
      >
        <Text style={styles.dateText}>{formatDateKey(date)}</Text>
        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
      </Pressable>
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
        <TextField
          label="Start"
          value={start}
          onChangeText={setStart}
          placeholder="09:00"
          keyboardType="numbers-and-punctuation"
          inputStyle={styles.mono}
          style={styles.col}
        />
        <TextField
          label="End"
          value={end}
          onChangeText={setEnd}
          placeholder="22:00"
          keyboardType="numbers-and-punctuation"
          inputStyle={styles.mono}
          style={styles.col}
        />
      </View>

      <TextField
        label="Note"
        placeholder="Optional"
        value={note}
        onChangeText={setNote}
      />

      <View style={[styles.summary, minutes === 0 && styles.summaryError]}>
        <Ionicons
          name={minutes > 0 ? "time-outline" : "alert-circle"}
          size={18}
          color={minutes > 0 ? colors.textSecondary : colors.dangerText}
        />
        <Text style={[styles.summaryText, minutes === 0 && styles.summaryTextError]}>
          {minutes > 0
            ? `${formatDuration(minutes)}${isOvernight({ start, end }) ? " · ends next day" : ""}`
            : "Start and end can't be the same."}
        </Text>
      </View>
      {formError && (
        <Text style={styles.error} accessibilityRole="alert">
          {formError}
        </Text>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cancel: { flex: 1 },
  primary: { flex: 2 },
  mono: { fontFamily: MONO },
  segmented: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  seg: {
    flex: 1,
    minHeight: HIT_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceMuted,
    backgroundColor: colors.surfaceMuted,
  },
  segPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  /* Primary is solid red, secondary a dashed red outline — the same split the
     agenda and the on-call banner draw. */
  segPrimaryActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  segSecondaryActive: {
    backgroundColor: colors.dangerSoft,
    borderStyle: "dashed",
    borderColor: colors.danger,
  },
  segText: {
    ...typography.subhead,
    fontWeight: "600",
  },
  segPrimaryText: { color: colors.white },
  segSecondaryText: { color: colors.dangerText },
  dateBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.lg,
  },
  dateBtnPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  dateText: {
    ...typography.body,
    flex: 1,
  },
  row: { flexDirection: "row", gap: spacing.md },
  col: { flex: 1 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.sm,
  },
  summaryError: {
    backgroundColor: colors.dangerSoft,
  },
  summaryText: {
    ...typography.callout,
    fontWeight: "600",
    flex: 1,
  },
  summaryTextError: {
    color: colors.dangerText,
  },
  error: {
    ...typography.footnote,
    color: colors.dangerText,
    marginBottom: spacing.sm,
  },
});
