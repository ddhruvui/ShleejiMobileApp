import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Chip, FieldLabel, SegmentedControl } from "./ui";
import { colors, radii, spacing, type } from "../theme";

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ECD_MODES = ["none", "date", "week", "month", "year"];
const MODE_LABELS = {
  none: "None",
  date: "Date",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getOrdinal(n) {
  const v = n % 100;
  const suffix = ["th", "st", "nd", "rd"];
  return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}

function toggleInArray(arr, val) {
  if (arr.includes(val)) {
    return arr.length > 1 ? arr.filter((v) => v !== val) : arr;
  }
  return [...arr, val].sort();
}

// Format Date to YYYY-MM-DD — component-wise, never via toISOString (UTC shift)
export function formatDateToISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Format Date to D/M/YYYY
function formatDateToDMY(date) {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

/** "2025-11-12" → "Wed, 12 November 2025" (parsed component-wise). */
export function prettyDateKey(key) {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return key || "";
  const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

/** "12/11/2025" (D/M/YYYY) → "12 November 2025". */
function prettyDMY(value) {
  if (!value || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) return value || "";
  const [d, m, y] = value.split("/").map((n) => parseInt(n, 10));
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Quick picks for a one-time date: today, tomorrow and the next Monday. */
export function dateShortcuts(now = new Date()) {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const plus = (n) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  const toMonday = ((8 - base.getDay()) % 7) || 7; // strictly after today
  return [
    { label: "Today", value: formatDateToISO(base) },
    { label: "Tomorrow", value: formatDateToISO(plus(1)) },
    { label: "Next Mon", value: formatDateToISO(plus(toMonday)) },
  ];
}

export default function EcdPicker({
  mode,
  setMode,
  dateVal,
  setDateVal,
  dowVal,
  setDowVal,
  domVal,
  setDomVal,
  yearVal,
  setYearVal,
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  // Parse dateVal string to Date object for date picker
  const getDateForPicker = () => {
    if (dateVal && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [y, m, d] = dateVal.split("-").map((n) => parseInt(n, 10));
      return new Date(y, m - 1, d);
    }
    return new Date();
  };

  // Parse yearVal string (D/M/YYYY) to Date object
  const getYearDateForPicker = () => {
    if (yearVal && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(yearVal)) {
      const parts = yearVal.split("/");
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
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

  const onYearDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowYearPicker(false);
    }
    if (event.type === "set" && selectedDate) {
      setYearVal(formatDateToDMY(selectedDate));
      if (Platform.OS === "ios") {
        setShowYearPicker(false);
      }
    } else if (event.type === "dismissed") {
      setShowYearPicker(false);
    }
  };

  const shortcuts = dateShortcuts();

  return (
    <View style={styles.container}>
      <FieldLabel>Due</FieldLabel>
      <SegmentedControl
        style={styles.modeRow}
        value={mode}
        onChange={setMode}
        options={ECD_MODES.map((m) => ({ value: m, label: MODE_LABELS[m] }))}
      />

      {mode === "date" && (
        <View>
          <View style={styles.shortcutRow}>
            {shortcuts.map((s) => (
              <Chip
                key={s.label}
                size="sm"
                label={s.label}
                selected={dateVal === s.value}
                onPress={() => setDateVal(s.value)}
              />
            ))}
          </View>
          <DateButton
            label={prettyDateKey(dateVal) || "Select date"}
            onPress={() => setShowDatePicker(true)}
          />
          {showDatePicker && (
            <DateTimePicker
              value={getDateForPicker()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onDateChange}
            />
          )}
        </View>
      )}

      {mode === "week" && (
        <View style={styles.dowRow}>
          {DOW_LABELS.map((day) => {
            const on = dowVal.includes(day);
            return (
              <Pressable
                key={day}
                onPress={() => setDowVal((prev) => toggleInArray(prev, day))}
                accessibilityRole="button"
                accessibilityLabel={day}
                accessibilityState={{ selected: on }}
                style={[styles.dayBtn, on && styles.dayBtnOn]}
              >
                <Text style={[styles.dayText, on && styles.dayTextOn]}>{day.slice(0, 2)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {mode === "month" && (
        <View style={styles.domGrid}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
            const on = domVal.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() => setDomVal((prev) => toggleInArray(prev, d))}
                accessibilityRole="button"
                accessibilityLabel={getOrdinal(d)}
                accessibilityState={{ selected: on }}
                style={[styles.domBtn, on && styles.dayBtnOn]}
              >
                <Text style={[styles.dayText, on && styles.dayTextOn]}>{d}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {mode === "year" && (
        <View>
          <DateButton
            label={prettyDMY(yearVal) || "Select date"}
            onPress={() => setShowYearPicker(true)}
          />
          {showYearPicker && (
            <DateTimePicker
              value={getYearDateForPicker()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onYearDateChange}
            />
          )}
        </View>
      )}

      {/* Hint text */}
      {mode === "week" && dowVal.length > 0 && (
        <Hint>Repeats every {dowVal.join(", ")}</Hint>
      )}
      {mode === "month" && domVal.length > 0 && (
        <Hint>
          Repeats on the{" "}
          {[...domVal]
            .sort((a, b) => a - b)
            .map((d) => getOrdinal(d))
            .join(", ")}{" "}
          of each month
        </Hint>
      )}
      {mode === "year" && yearVal ? <Hint>Repeats annually on {yearVal}</Hint> : null}
    </View>
  );
}

function DateButton({ label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Pick date, ${label}`}
      style={({ pressed }) => [styles.dateBtn, pressed && styles.dateBtnPressed]}
    >
      <Text style={styles.dateText}>{label}</Text>
      <Ionicons name="calendar-outline" size={20} color={colors.primary} />
    </Pressable>
  );
}

function Hint({ children }) {
  return (
    <View style={styles.hintRow}>
      <Ionicons name="repeat" size={14} color={colors.textSecondary} />
      <Text style={styles.hint}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  modeRow: {
    marginBottom: spacing.md,
  },
  shortcutRow: {
    flexDirection: "row",
    gap: spacing.sm - 2,
    marginBottom: spacing.sm,
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
  dowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  dayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBtnOn: {
    backgroundColor: colors.primary,
  },
  dayText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  dayTextOn: {
    color: colors.onPrimary,
  },
  domGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: spacing.sm,
  },
  domBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.sm + 2,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
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
