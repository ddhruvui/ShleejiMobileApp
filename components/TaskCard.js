import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import EditTaskModal from "./EditTaskModal";
import { ActionSheet, Badge, Checkbox, IconButton } from "./ui";
import { daysLabel } from "../utils/goalSync";
import { addDaysToDateKey, isTaskDueToday, todayDateKey } from "../utils/ecd";
import { colors, spacing, type } from "../theme";

function getOrdinal(n) {
  const v = n % 100;
  const suffix = ["th", "st", "nd", "rd"];
  return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}

function shortDate(value) {
  const [year, month, day] = value.split("-");
  const currentYear = new Date().getFullYear();
  const mm = String(parseInt(month, 10)).padStart(2, "0");
  const dd = String(parseInt(day, 10)).padStart(2, "0");
  if (parseInt(year, 10) === currentYear) return `${mm}/${dd}`;
  return `${mm}/${dd}/${year.slice(-2)}`;
}

/**
 * The due label for a task's ECD, with a tone that says how urgent it is:
 * today (brand), overdue and not done (red), recurring (repeat icon, brand
 * when it is due today), otherwise neutral. Undated tasks show no label — the
 * missing date chip says it. Date keys compare as strings (YYYY-MM-DD), never
 * through `new Date("YYYY-MM-DD")`.
 */
export function resolveEcd(task, today = todayDateKey()) {
  const ecd = task.ecd;
  if (!ecd) return null;

  switch (ecd.type) {
    case "date": {
      const value = ecd.value;
      if (value === today) return { label: "Today", tone: "primary", icon: "calendar" };
      if (value === addDaysToDateKey(today, 1))
        return { label: "Tomorrow", tone: "neutral", icon: "calendar-outline" };
      if (value < today && !task.done)
        return { label: `Overdue · ${shortDate(value)}`, tone: "danger", icon: "alert-circle" };
      return { label: shortDate(value), tone: "neutral", icon: "calendar-outline" };
    }
    case "day_of_week":
    case "day_of_month":
    case "day_of_year": {
      let label;
      if (ecd.type === "day_of_week") label = daysLabel(ecd.value);
      else if (ecd.type === "day_of_month")
        label = [...ecd.value]
          .sort((a, b) => a - b)
          .map((d) => getOrdinal(d))
          .join(", ");
      else label = ecd.value;
      const dueToday = !task.done && isTaskDueToday(ecd);
      return { label, tone: dueToday ? "primary" : "neutral", icon: "repeat", recurring: true };
    }
    default:
      return null;
  }
}

export default function TaskCard({
  task,
  isFirst,
  isLast,
  prevTaskDone,
  nextTaskDone,
  // Daily habit under "One Step At A Time" — the goal links to it by name,
  // so the edit modal locks name and schedule (notes/done stay editable)
  goalManaged,
  // Habit streak for this task, when it has one under "One Step At A Time" —
  // the same "🔥 N" badge the Goals view puts on the matching step. Absent for
  // ordinary tasks, and for a habit the nightly archive has no results for yet.
  streak,
  onToggleDone,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDelete,
}) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const due = resolveEcd(task);
  // The days the streak is measured over, worded as the Goals view words them
  // (a seven-day habit reads "Daily"). Habits always carry a day_of_week ECD.
  const streakDays =
    task.ecd && task.ecd.type === "day_of_week"
      ? daysLabel(task.ecd.value)
      : null;

  // Not-done tasks must stay above done tasks
  const canMoveUp = !isFirst && !(task.done && prevTaskDone === false);
  const canMoveDown = !isLast && !(!task.done && nextTaskDone === true);

  const menuActions = [
    {
      key: "edit",
      label: "Edit task",
      icon: "pencil",
      onPress: () => setEditModalOpen(true),
    },
    {
      key: "up",
      label: "Move up",
      icon: "arrow-up",
      disabled: !canMoveUp,
      onPress: () => onMoveUp(task._id),
    },
    {
      key: "down",
      label: "Move down",
      icon: "arrow-down",
      disabled: !canMoveDown,
      onPress: () => onMoveDown(task._id),
    },
    {
      key: "delete",
      label: "Delete task",
      icon: "trash-outline",
      destructive: true,
      onPress: () => onDelete(task._id),
    },
  ];

  return (
    <>
      {/* Checkbox, body and "⋯" are siblings (not nested in one pressable) so
          screen readers can reach each control on its own. The whole row
          still highlights while the body is pressed. */}
      <View style={[styles.card, pressed && styles.pressed]}>
        <Checkbox
          checked={task.done}
          label={task.done ? `Mark "${task.name}" not done` : `Mark "${task.name}" done`}
          onPress={() => onToggleDone(task._id)}
          style={styles.checkbox}
        />

        <Pressable
          testID={`task-${task._id}`}
          onPress={() => setEditModalOpen(true)}
          onLongPress={() => setMenuOpen(true)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityRole="button"
          accessibilityLabel={`${task.name}${task.done ? ", done" : ""}${
            due ? `, ${due.label}` : ""
          }`}
          accessibilityHint="Opens the task. Long press for more actions."
          style={styles.body}
        >
          <Text style={[styles.name, task.done && styles.nameDone]} numberOfLines={2}>
            {task.name}
          </Text>
          {due || streak ? (
            <View style={styles.metaRow}>
              {due ? <Badge label={due.label} tone={due.tone} icon={due.icon} /> : null}
              {/* Habit streak, same badge the Goals view shows on the step this
                  task belongs to — counted over the days the task is due, so an
                  untouched off-day never breaks it. */}
              {streak ? (
                <Badge
                  label={String(streak.current)}
                  icon="flame"
                  tone="accent"
                  outline
                  accessibilityLabel={`Current streak: ${streak.current} scheduled ${
                    streak.current === 1 ? "day" : "days"
                  } in a row (best ${streak.longest})${
                    streakDays ? `, counting only ${streakDays}` : ""
                  }`}
                />
              ) : null}
            </View>
          ) : null}
          {task.notes ? (
            <Text style={styles.notesText} numberOfLines={1}>
              {task.notes}
            </Text>
          ) : null}
        </Pressable>

        <IconButton
          icon="ellipsis-horizontal"
          label={`More actions for ${task.name}`}
          onPress={() => setMenuOpen(true)}
          size="sm"
          style={styles.more}
        />
      </View>

      <ActionSheet
        visible={menuOpen}
        title={task.name}
        subtitle={due ? due.label : undefined}
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />

      <EditTaskModal
        visible={editModalOpen}
        taskName={task.name}
        notes={task.notes}
        createdAt={task.createdAt}
        updatedAt={task.updatedAt}
        ecd={task.ecd}
        goalManaged={goalManaged}
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
    paddingVertical: spacing.xs,
    paddingRight: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  checkbox: {
    marginLeft: spacing.xs,
  },
  body: {
    flex: 1,
    paddingVertical: 11,
    paddingRight: spacing.xs,
  },
  name: {
    ...type.callout,
    fontWeight: "500",
    lineHeight: 21,
  },
  nameDone: {
    textDecorationLine: "line-through",
    color: colors.textTertiary,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  notesText: {
    ...type.footnote,
    marginTop: 4,
  },
  more: {
    marginTop: 6,
  },
});
