import React, { useState } from "react";
import { StyleSheet, View, Text, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Sheet, SheetActions, Button, TextField, FieldLabel } from "./ui";
import { prettyDateKey } from "./EcdPicker";
import { colors, radii, spacing, type } from "../theme";

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
 * Book or correct a vacation — a bottom sheet. VacationSection mounts it only
 * while it is open, so every open starts from fresh state.
 *
 * Two dates rather than a toggle, because **both are mandatory**: that is what
 * lets a trip be booked months ahead, which is the case that actually needs
 * planning. Coming home early, or forgetting to book it on the first morning,
 * are both edits to a stored range rather than a different state to carry.
 */
export default function VacationModal({ vacation, onConfirm, onCancel, visible = true }) {
  const today = dateKey(new Date());
  const [startDate, setStartDate] = useState(vacation?.startDate ?? today);
  const [endDate, setEndDate] = useState(vacation?.endDate ?? today);
  const [note, setNote] = useState(vacation?.note ?? "");
  const [picking, setPicking] = useState(null); // "start" | "end" | null

  const invalid = endDate < startDate;
  const days = lengthOf(startDate, endDate);

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
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={vacation ? "Edit vacation" : "Book vacation"}
      testID="vacation-sheet"
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
            title={vacation ? "Save" : "Book"}
            size="lg"
            disabled={invalid}
            onPress={() => onConfirm({ startDate, endDate, note: note.trim() })}
            style={styles.primary}
          />
        </SheetActions>
      }
    >
      {/* In the body rather than the sheet subtitle, which clamps to two lines. */}
      <Text style={styles.hint}>
        Both days count — the day you leave and the day you get back are both
        vacation days.
      </Text>

      <TextField
        label="Note"
        placeholder="Optional, e.g. Kerala trip"
        value={note}
        onChangeText={setNote}
        returnKeyType="done"
      />

      <FieldLabel>First day</FieldLabel>
      <DateButton
        label={prettyDateKey(startDate)}
        accessibilityLabel={`First day, ${prettyDateKey(startDate)}`}
        onPress={() => setPicking("start")}
      />

      <FieldLabel style={styles.secondLabel}>Last day</FieldLabel>
      <DateButton
        label={prettyDateKey(endDate)}
        accessibilityLabel={`Last day, ${prettyDateKey(endDate)}`}
        onPress={() => setPicking("end")}
      />

      {picking && (
        <DateTimePicker
          value={parseKey(picking === "start" ? startDate : endDate)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selected) => handlePicked(picking, event, selected)}
        />
      )}

      <View style={[styles.summary, invalid && styles.summaryError]}>
        <Ionicons
          name={invalid ? "alert-circle" : "sunny-outline"}
          size={18}
          color={invalid ? colors.dangerText : colors.infoText}
        />
        <Text style={[styles.summaryText, invalid && styles.summaryTextError]}>
          {invalid
            ? "The last day can't be before the first day."
            : `${days} day${days === 1 ? "" : "s"} off`}
        </Text>
      </View>
    </Sheet>
  );
}

/** The EcdPicker date-button look: a soft field with a calendar glyph. */
function DateButton({ label, accessibilityLabel, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens the date picker"
      style={({ pressed }) => [styles.dateBtn, pressed && styles.dateBtnPressed]}
    >
      <Text style={styles.dateText}>{label}</Text>
      <Ionicons name="calendar-outline" size={20} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cancel: { flex: 1 },
  primary: { flex: 2 },
  hint: {
    ...type.subhead,
    marginBottom: spacing.lg,
  },
  secondLabel: {
    marginTop: spacing.sm,
  },
  dateBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.sm,
  },
  dateBtnPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  dateText: {
    ...type.body,
    flex: 1,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.infoSoft,
  },
  summaryError: {
    backgroundColor: colors.dangerSoft,
  },
  summaryText: {
    ...type.callout,
    fontWeight: "600",
    color: colors.infoText,
    flex: 1,
  },
  summaryTextError: {
    color: colors.dangerText,
  },
});
