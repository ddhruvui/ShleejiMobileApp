import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

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
        <TextInput
          style={styles.dateInput}
          value={dateVal}
          onChangeText={setDateVal}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#999"
        />
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
        <TextInput
          style={styles.dateInput}
          value={yearVal}
          onChangeText={setYearVal}
          placeholder="D/M/YYYY (e.g., 25/12/2026)"
          placeholderTextColor="#999"
        />
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
