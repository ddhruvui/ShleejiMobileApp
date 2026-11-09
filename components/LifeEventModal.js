import React, { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import {
  Sheet,
  SheetActions,
  Button,
  Chip,
  TextField,
  FieldLabel,
} from "./ui";
import { colors, radii, spacing, type, HIT_TARGET } from "../theme";

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

const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Dual-purpose add/edit sheet for life events (annually recurring dates).
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
      setTimeout(() => nameRef.current?.focus(), 250);
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
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={isEdit ? "Edit life event" : "Add life event"}
      subtitle="Repeats every year — it lands in your todo on the day."
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
            title={isEdit ? "Save" : "Add life event"}
            size="lg"
            onPress={handleConfirm}
            disabled={!name.trim()}
            style={{ flex: 2 }}
          />
        </SheetActions>
      }
    >
      <TextField
        ref={nameRef}
        label="Life event"
        placeholder="e.g. Wife's birthday"
        value={name}
        onChangeText={setName}
        returnKeyType="done"
      />

      <FieldLabel>Month</FieldLabel>
      <View style={styles.monthRow}>
        {SHORT_MONTHS.map((label, idx) => (
          <Chip
            key={label}
            size="sm"
            label={label}
            accessibilityLabel={LONG_MONTHS[idx]}
            selected={month === idx + 1}
            onPress={() => handleMonthChange(idx + 1)}
            style={styles.monthChip}
          />
        ))}
      </View>

      <FieldLabel>Day</FieldLabel>
      <View style={styles.dayGrid}>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => {
          const on = day === d;
          return (
            <Pressable
              key={d}
              onPress={() => setDay(d)}
              accessibilityRole="button"
              accessibilityLabel={`${d} ${LONG_MONTHS[month - 1]}`}
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.dayBtn,
                pressed && !on && styles.dayBtnPressed,
                on && styles.dayBtnOn,
              ]}
            >
              <Text style={[styles.dayText, on && styles.dayTextOn]}>{d}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.summary}>
        Every year on {day} {LONG_MONTHS[month - 1]}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm - 2,
    marginBottom: spacing.lg,
  },
  monthChip: {
    minHeight: HIT_TARGET,
    minWidth: 56,
    justifyContent: "center",
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  dayBtn: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: radii.sm + 2,
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
  },
  dayTextOn: {
    color: colors.onPrimary,
  },
  summary: {
    ...type.footnote,
    marginBottom: spacing.sm,
  },
});
