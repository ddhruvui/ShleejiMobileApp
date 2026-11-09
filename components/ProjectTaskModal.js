import React, { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Sheet, SheetActions, Button, Chip, TextField, FieldLabel } from "./ui";
import { dateShortcuts, formatDateToISO, prettyDateKey } from "./EcdPicker";
import { colors, radii, spacing, type, HIT_TARGET } from "../theme";

function todayInputVal() {
  return new Date().toISOString().slice(0, 10);
}

const DUE_MODES = [
  { value: "none", label: "None" },
  { value: "date", label: "Date" },
];

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
  busy = false, // true while the parent's save is in flight — blocks a dup submit
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
      setTimeout(() => nameRef.current?.focus(), 250);
    }
  }, [visible, task]);

  // Parsed component-wise (never `new Date("YYYY-MM-DD")`) to avoid a UTC shift
  const getDateForPicker = () => {
    if (dateVal && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [y, m, d] = dateVal.split("-").map((n) => parseInt(n, 10));
      return new Date(y, m - 1, d);
    }
    return new Date();
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
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm({
      name: trimmed,
      notes,
      date: mode === "date" ? dateVal : null,
    });
  }

  const shortcuts = dateShortcuts();
  const dateLabel = prettyDateKey(dateVal) || "Select Date";

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={task ? "Edit task" : "Add task"}
      subtitle={projectName ? `in ${projectName}` : undefined}
      footer={
        <SheetActions>
          <Button
            title="Cancel"
            variant="secondary"
            size="lg"
            onPress={onCancel}
            style={{ flex: 1 }}
          />
          <Button
            title={task ? "Save" : "Add task"}
            size="lg"
            onPress={handleSubmit}
            disabled={!name.trim()}
            loading={busy}
            style={{ flex: 2 }}
          />
        </SheetActions>
      }
    >
      <TextField
        ref={nameRef}
        label="Task name"
        placeholder="Task name…"
        value={name}
        onChangeText={setName}
        returnKeyType="done"
      />

      <View style={styles.due}>
        <FieldLabel>Due</FieldLabel>
        <View style={styles.chipRow}>
          {DUE_MODES.map((m) => (
            <Chip
              key={m.value}
              size="sm"
              label={m.label}
              selected={mode === m.value}
              onPress={() => setMode(m.value)}
              style={styles.chip}
            />
          ))}
        </View>

        {mode === "date" && (
          <View>
            <View style={styles.chipRow}>
              {shortcuts.map((s) => (
                <Chip
                  key={s.label}
                  size="sm"
                  label={s.label}
                  selected={dateVal === s.value}
                  onPress={() => setDateVal(s.value)}
                  style={styles.chip}
                />
              ))}
            </View>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`Pick date, ${dateLabel}`}
              style={({ pressed }) => [
                styles.dateBtn,
                pressed && styles.dateBtnPressed,
              ]}
            >
              <Text style={styles.dateText}>{dateLabel}</Text>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={colors.primary}
              />
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={getDateForPicker()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onDateChange}
              />
            )}
            <View style={styles.hintRow}>
              <Ionicons
                name="arrow-redo-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.hint}>
                Will appear in the todo under "{projectName}"
              </Text>
            </View>
          </View>
        )}
      </View>

      <TextField
        label="Notes"
        placeholder="Add notes…"
        value={notes}
        onChangeText={setNotes}
        multiline
        minHeight={88}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  due: {
    marginBottom: spacing.lg,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm - 2,
    marginBottom: spacing.sm,
  },
  chip: {
    minHeight: HIT_TARGET,
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
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xs,
  },
  hint: {
    ...type.footnote,
    flex: 1,
  },
});
