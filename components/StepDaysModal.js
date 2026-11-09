import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sheet, SheetActions, Button, Chip, FieldLabel } from "./ui";
import { colors, spacing, type, HIT_TARGET } from "../theme";
import { WEEK_DAYS } from "../utils/goalSync";

/** Picker order — Mon-first, matching the todo's weekly ECD strip. */
const PICKER_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PRESETS = [
  { label: "Every day", days: [...WEEK_DAYS] },
  { label: "Weekdays", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
  { label: "Weekends", days: ["Sat", "Sun"] },
];

/** Round day buttons, as in EcdPicker's weekly mode; slop tops them up to 44pt. */
const DAY_SIZE = 40;
const DAY_SLOP_EDGE = (HIT_TARGET - DAY_SIZE) / 2;
const DAY_SLOP = {
  top: DAY_SLOP_EDGE,
  bottom: DAY_SLOP_EDGE,
  left: DAY_SLOP_EDGE,
  right: DAY_SLOP_EDGE,
};

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

  // A preset reads as chosen when the picked days are exactly its days.
  const matchesPreset = (preset) =>
    preset.days.length === selected.length &&
    preset.days.every((d) => selected.includes(d));

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={mode === "start" ? "Start step" : "Change days"}
      subtitle={stepName || undefined}
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
            title={mode === "start" ? "Start step" : "Save days"}
            size="lg"
            onPress={() => onConfirm(selected)}
            disabled={selected.length === 0}
            loading={!!busy}
            style={{ flex: 2 }}
          />
        </SheetActions>
      }
    >
      <FieldLabel>Days</FieldLabel>
      <View style={styles.dowRow}>
        {PICKER_ORDER.map((day) => {
          const on = days.includes(day);
          return (
            <Pressable
              key={day}
              onPress={() => toggle(day)}
              hitSlop={DAY_SLOP}
              accessibilityRole="button"
              accessibilityLabel={day}
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.dayBtn,
                pressed && !on && styles.dayBtnPressed,
                on && styles.dayBtnOn,
              ]}
            >
              <Text style={[styles.dayText, on && styles.dayTextOn]}>
                {day.slice(0, 2)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.presetRow}>
        {PRESETS.map((preset) => (
          <Chip
            key={preset.label}
            size="sm"
            label={preset.label}
            selected={matchesPreset(preset)}
            onPress={() => setDays([...preset.days])}
          />
        ))}
      </View>

      <View style={styles.hintRow}>
        <Ionicons
          name={selected.length === 0 ? "alert-circle-outline" : "repeat"}
          size={14}
          color={selected.length === 0 ? colors.warningText : colors.textSecondary}
        />
        <Text style={[styles.hint, selected.length === 0 && styles.hintWarn]}>
          {selected.length === 0
            ? "Pick at least one day — a habit needs a day to run on."
            : `Due every ${selected.join(", ")}${goalName ? ` under "${goalName}"` : ""}. The streak counts only these days.`}
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  dowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  dayBtn: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBtnPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  dayBtnOn: {
    backgroundColor: colors.primary,
  },
  dayText: {
    ...type.subhead,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  dayTextOn: {
    color: colors.onPrimary,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm - 2,
    marginBottom: spacing.md,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  hint: {
    ...type.footnote,
    flex: 1,
  },
  hintWarn: {
    color: colors.warningText,
  },
});
