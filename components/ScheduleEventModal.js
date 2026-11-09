import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Sheet,
  SheetActions,
  Button,
  Checkbox,
  Chip,
  FieldLabel,
} from "./ui";
import { formatDateToISO, prettyDateKey } from "./EcdPicker";
import { addDaysToDateKey, formatDateKey } from "../utils/ecd";
import { colors, radii, spacing, type, HIT_TARGET } from "../theme";

/** Quick date picks: today, tomorrow and the next Saturday that is not
 * already one of those two. Mirrors the web FE's ScheduleEventModal. */
function dateShortcuts() {
  const today = formatDateToISO(new Date());
  const weekday = new Date().getDay();
  let toSaturday = (6 - weekday + 7) % 7;
  if (toSaturday < 2) toSaturday += 7;
  return [
    { label: "Today", key: today },
    { label: "Tomorrow", key: addDaysToDateKey(today, 1) },
    { label: "Saturday", key: addDaysToDateKey(today, toSaturday) },
  ];
}

/** "Mon, Nov 9, 2026" → "Nov 9" for the shortcut chips. */
function shortDate(key) {
  return formatDateKey(key).replace(/, \d{4}$/, "").replace(/^\w+, /, "");
}

/** "YYYY-MM-DD" → local Date, parsed component-wise (never via the Date
 * string parser, which can shift the day across timezones). */
function dateKeyToDate(key) {
  const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
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
    // Selected tasks keep the template's order — the parent creates them
    // one at a time in exactly this order.
    onConfirm({
      date,
      tasks: event.tasks.filter((_, i) => selected.has(i)),
    });
  }

  const dateLabel = prettyDateKey(date) || "Select date";

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title="Add to todo"
      subtitle={event.name}
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
            title={`Add ${selected.size} task${selected.size === 1 ? "" : "s"}`}
            size="lg"
            onPress={handleConfirm}
            disabled={selected.size === 0}
            style={{ flex: 2 }}
          />
        </SheetActions>
      }
    >
      {/* Date */}
      <FieldLabel>Date</FieldLabel>
      <View style={styles.shortcutRow}>
        {dateShortcuts().map((s) => (
          <Chip
            key={s.label}
            size="sm"
            label={`${s.label} · ${shortDate(s.key)}`}
            accessibilityLabel={`${s.label}, ${shortDate(s.key)}`}
            selected={s.key === date}
            onPress={() => {
              setDate(s.key);
              setShowDatePicker(false);
            }}
            style={styles.shortcut}
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
        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
      </Pressable>
      {showDatePicker && (
        <DateTimePicker
          value={dateKeyToDate(date)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onDateChange}
        />
      )}

      {/* Task checklist */}
      <View style={styles.tasksHeader}>
        <FieldLabel style={styles.tasksLabel}>Tasks</FieldLabel>
        <Button
          title={allSelected ? "Unselect all" : "Select all"}
          variant="ghost"
          onPress={toggleAll}
          style={styles.toggleAll}
        />
      </View>
      <View style={styles.taskList}>
        {event.tasks.map((task, i) => {
          const isChecked = selected.has(i);
          return (
            <View
              key={i}
              style={[styles.taskRow, i > 0 && styles.taskDivider]}
            >
              <Checkbox
                checked={isChecked}
                label={task}
                onPress={() => toggleTask(i)}
              />
              {/* The name is a larger tap target for the same toggle; the
                  checkbox already announces it to assistive tech. */}
              <Pressable
                onPress={() => toggleTask(i)}
                style={styles.taskNameHit}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Text
                  style={[
                    styles.taskName,
                    !isChecked && styles.taskNameUnselected,
                  ]}
                >
                  {task}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  shortcutRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm - 2,
    marginBottom: spacing.sm,
  },
  shortcut: {
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
    marginBottom: spacing.lg,
  },
  dateBtnPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  dateText: {
    ...type.body,
    flex: 1,
  },
  tasksHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tasksLabel: {
    marginBottom: 0,
  },
  toggleAll: {
    paddingHorizontal: spacing.sm,
  },
  taskList: {
    marginBottom: spacing.sm,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  taskDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  taskNameHit: {
    flex: 1,
    minHeight: HIT_TARGET,
    justifyContent: "center",
  },
  taskName: {
    ...type.callout,
    fontWeight: "400",
  },
  taskNameUnselected: {
    color: colors.textTertiary,
    textDecorationLine: "line-through",
  },
});
