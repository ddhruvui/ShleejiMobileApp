import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import EditTaskModal from "./EditTaskModal";

function getOrdinal(n) {
  const v = n % 100;
  const suffix = ["th", "st", "nd", "rd"];
  return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}

function resolveEcd(task) {
  if (!task.ecd) {
    return { label: "No date", recurring: false };
  }

  switch (task.ecd.type) {
    case "date": {
      const [year, month, day] = task.ecd.value.split("-");
      const currentYear = new Date().getFullYear();
      const mm = String(parseInt(month, 10)).padStart(2, "0");
      const dd = String(parseInt(day, 10)).padStart(2, "0");
      if (parseInt(year, 10) === currentYear) {
        return { label: `${mm}/${dd}`, recurring: false };
      }
      const yy = year.slice(-2);
      return { label: `${mm}/${dd}/${yy}`, recurring: false };
    }
    case "day_of_week": {
      const label = task.ecd.value.join(", ");
      return { label: `↻ ${label}`, recurring: true };
    }
    case "day_of_month": {
      const label = [...task.ecd.value]
        .sort((a, b) => a - b)
        .map((d) => getOrdinal(d))
        .join(", ");
      return { label: `↻ ${label}`, recurring: true };
    }
    case "day_of_year": {
      return { label: `↻ ${task.ecd.value}`, recurring: true };
    }
    default:
      return { label: "No date", recurring: false };
  }
}

export default function TaskCard({
  task,
  isFirst,
  isLast,
  prevTaskDone,
  nextTaskDone,
  onToggleDone,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDelete,
}) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const { label: ecdLabel, recurring: ecdRecurring } = resolveEcd(task);

  // Not-done tasks must stay above done tasks
  const canMoveUp = !isFirst && !(task.done && prevTaskDone === false);
  const canMoveDown = !isLast && !(!task.done && nextTaskDone === true);

  return (
    <>
      <View style={[styles.card, task.done && styles.cardDone]}>
        {/* Checkbox */}
        <TouchableOpacity
          style={[styles.checkbox, task.done && styles.checkboxChecked]}
          onPress={() => onToggleDone(task._id)}
        >
          {task.done && <Ionicons name="checkmark" size={14} color="#fff" />}
        </TouchableOpacity>

        {/* Body: name + ecd + notes */}
        <View style={styles.body}>
          <View style={styles.labelRow}>
            <Text
              style={[styles.name, task.done && styles.nameDone]}
              numberOfLines={2}
            >
              {task.name}
            </Text>
            <View
              style={[
                styles.ecdBadge,
                ecdRecurring && styles.ecdBadgeRecurring,
              ]}
            >
              <Text
                style={[
                  styles.ecdText,
                  ecdRecurring && styles.ecdTextRecurring,
                ]}
              >
                {ecdLabel}
              </Text>
            </View>
          </View>
          {task.notes ? (
            <Text style={styles.notesText} numberOfLines={1}>
              → {task.notes}
            </Text>
          ) : null}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setEditModalOpen(true)}
          >
            <Ionicons name="pencil" size={16} color="#656d76" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, !canMoveUp && styles.actionDisabled]}
            onPress={() => onMoveUp(task._id)}
            disabled={!canMoveUp}
          >
            <Ionicons
              name="arrow-up"
              size={16}
              color={canMoveUp ? "#656d76" : "#ccc"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, !canMoveDown && styles.actionDisabled]}
            onPress={() => onMoveDown(task._id)}
            disabled={!canMoveDown}
          >
            <Ionicons
              name="arrow-down"
              size={16}
              color={canMoveDown ? "#656d76" : "#ccc"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onDelete(task._id)}
          >
            <Ionicons name="trash-outline" size={16} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      </View>

      <EditTaskModal
        visible={editModalOpen}
        taskName={task.name}
        notes={task.notes}
        createdAt={task.createdAt}
        updatedAt={task.updatedAt}
        ecd={task.ecd}
        onConfirm={(payload) => {
          onEdit(task._id, payload);
          setEditModalOpen(false);
        }}
        onCancel={() => setEditModalOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
    backgroundColor: "#fff",
  },
  cardDone: {
    opacity: 0.6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d0d7de",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: "#6200ee",
    borderColor: "#6200ee",
  },
  body: {
    flex: 1,
    marginRight: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1f2328",
  },
  nameDone: {
    textDecorationLine: "line-through",
    color: "#656d76",
  },
  ecdBadge: {
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ecdBadgeRecurring: {
    backgroundColor: "#e8f0fe",
  },
  ecdText: {
    fontSize: 11,
    color: "#656d76",
    fontWeight: "500",
  },
  ecdTextRecurring: {
    color: "#1a73e8",
  },
  notesText: {
    fontSize: 13,
    color: "#656d76",
    marginTop: 3,
    fontStyle: "italic",
  },
  actions: {
    flexDirection: "row",
    gap: 2,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 6,
  },
  actionDisabled: {
    opacity: 0.4,
  },
});
