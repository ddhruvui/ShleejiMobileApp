import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ECD_MODES = ["none", "date", "week", "month", "year"];
const MODE_LABELS = {
  none: "None",
  date: "Date",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};

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
      return new Date(dateVal + "T00:00:00");
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

  // Format Date to YYYY-MM-DD
  const formatDateToISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Format Date to D/M/YYYY
  const formatDateToDMY = (date) => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Due</Text>
      <View style={styles.modeRow}>
        {ECD_MODES.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => setMode(m)}
          >
            <Text
              style={[
                styles.modeBtnText,
                mode === m && styles.modeBtnTextActive,
              ]}
            >
              {MODE_LABELS[m]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === "date" && (
        <View>
          <TouchableOpacity
            style={styles.dateSelectorBtn}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateSelectorText}>
              {dateVal || "Select Date"}
            </Text>
            <Text style={styles.calendarIcon}>📅</Text>
          </TouchableOpacity>
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
          {DOW_LABELS.map((day) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.dowBtn,
                dowVal.includes(day) && styles.dowBtnActive,
              ]}
              onPress={() => setDowVal((prev) => toggleInArray(prev, day))}
            >
              <Text
                style={[
                  styles.dowBtnText,
                  dowVal.includes(day) && styles.dowBtnTextActive,
                ]}
              >
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {mode === "month" && (
        <View style={styles.domGrid}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.domBtn, domVal.includes(d) && styles.domBtnActive]}
              onPress={() => setDomVal((prev) => toggleInArray(prev, d))}
            >
              <Text
                style={[
                  styles.domBtnText,
                  domVal.includes(d) && styles.domBtnTextActive,
                ]}
              >
                {d}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {mode === "year" && (
        <View>
          <TouchableOpacity
            style={styles.dateSelectorBtn}
            onPress={() => setShowYearPicker(true)}
          >
            <Text style={styles.dateSelectorText}>
              {yearVal || "Select Date"}
            </Text>
            <Text style={styles.calendarIcon}>📅</Text>
          </TouchableOpacity>
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
        <Text style={styles.hint}>Repeats every {dowVal.join(", ")}</Text>
      )}
      {mode === "month" && domVal.length > 0 && (
        <Text style={styles.hint}>
          Repeats on the{" "}
          {[...domVal]
            .sort((a, b) => a - b)
            .map((d) => getOrdinal(d))
            .join(", ")}{" "}
          of each month
        </Text>
      )}
      {mode === "year" && yearVal ? (
        <Text style={styles.hint}>Repeats annually on {yearVal}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#656d76",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  modeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#f6f8fa",
  },
  modeBtnActive: {
    backgroundColor: "#6200ee",
    borderColor: "#6200ee",
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#555",
  },
  modeBtnTextActive: {
    color: "#fff",
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1f2328",
    backgroundColor: "#fafafa",
    marginBottom: 8,
  },
  dateSelectorBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fafafa",
    marginBottom: 8,
  },
  dateSelectorText: {
    fontSize: 15,
    color: "#1f2328",
    flex: 1,
  },
  calendarIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  dowRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  dowBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#f6f8fa",
  },
  dowBtnActive: {
    backgroundColor: "#6200ee",
    borderColor: "#6200ee",
  },
  dowBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#555",
  },
  dowBtnTextActive: {
    color: "#fff",
  },
  domGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 8,
  },
  domBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#f6f8fa",
    justifyContent: "center",
    alignItems: "center",
  },
  domBtnActive: {
    backgroundColor: "#6200ee",
    borderColor: "#6200ee",
  },
  domBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#555",
  },
  domBtnTextActive: {
    color: "#fff",
  },
  hint: {
    fontSize: 12,
    color: "#656d76",
    fontStyle: "italic",
    marginTop: 4,
  },
});
