import React, {
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
} from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import * as vacationsApi from "../api/vacations";
import * as tasksApi from "../api/tasks";
import VacationModal from "./VacationModal";
import ConfirmModal from "./ConfirmModal";
import {
  ActionSheet,
  Badge,
  Banner,
  BannerText,
  Button,
  Card,
  EmptyState,
  IconButton,
  LoadingState,
} from "./ui";
import { colors, radii, spacing, type } from "../theme";

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

/**
 * "2026-09-03" → "3 Sep 2026". Parsed by component, never via `new Date(...)`,
 * which would shift a day across timezones — the same rule the rest of the app
 * follows for date strings.
 */
function formatDay(day) {
  const [year, month, date] = day.split("-").map(Number);
  return `${date} ${SHORT_MONTHS[month - 1]} ${year}`;
}

/** Whole days a range covers, both ends inclusive — a one-day trip is 1. */
function lengthOf(vacation) {
  return (
    Math.round(
      (Date.parse(`${vacation.endDate}T00:00:00Z`) -
        Date.parse(`${vacation.startDate}T00:00:00Z`)) /
        86400000,
    ) + 1
  );
}

/** The day after a vacation ends — the sensible default when re-dating out of it. */
function dayAfter(day) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);
}

/** Status badge per range: on now (info), upcoming (brand), past (neutral). */
const STATUS = {
  active: { label: "on now", tone: "info", icon: "sunny" },
  upcoming: { label: "upcoming", tone: "primary", icon: "calendar-outline" },
  past: { label: "past", tone: "neutral", icon: undefined },
};

/**
 * Vacation view: book time off, correct a trip after the fact, and re-date the
 * tasks that fall inside one.
 *
 * The re-date list only ever offers **one-time dated tasks**, because they are
 * the only kind that can be moved — a recurring task cannot be pushed without
 * permanently rewriting its schedule, so the backend exempts those days
 * instead. Every move here is sent with `vacationMove: true`, which is what
 * stops a trip booked in advance being read as procrastination: the reschedule
 * happens before the vacation starts, so its timestamp alone proves nothing.
 */
export default function VacationSection({ onTasksChanged, addRef, onStatusChanged }) {
  const [vacations, setVacations] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalState, setModalState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // The range whose "⋯" menu (edit / delete) is open.
  const [menuFor, setMenuFor] = useState(null);

  const [openTasksFor, setOpenTasksFor] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // This panel has no toolbar of its own: TodoScreen's title-bar "+" opens the
  // book-vacation modal through this handle while the Vacation view shows.
  useImperativeHandle(addRef, () => ({
    openAdd: () => setModalState({ mode: "add" }),
  }));

  const load = useCallback(async () => {
    try {
      const [all, current] = await Promise.all([
        vacationsApi.getAll(),
        vacationsApi.getStatus(),
      ]);
      setVacations(all);
      setStatus(current);
      setLoading(false);
      if (onStatusChanged) onStatusChanged(current);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [onStatusChanged]);

  useEffect(() => {
    load();
  }, [load]);

  /* ── Vacation CRUD (no optimistic updates: mutate via API, then refetch) ── */

  const handleSave = async (draft) => {
    if (!modalState) return;
    try {
      if (modalState.mode === "add") {
        await vacationsApi.create(draft);
      } else {
        await vacationsApi.update(modalState.vacation._id, draft);
      }
      await load();
      setModalState(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await vacationsApi.remove(deleteTarget._id);
      if (openTasksFor === deleteTarget._id) setOpenTasksFor(null);
      await load();
      setDeleteTarget(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  /* ── The re-date list ── */

  const handleToggleTasks = async (vacation) => {
    if (openTasksFor === vacation._id) {
      setOpenTasksFor(null);
      return;
    }
    setOpenTasksFor(vacation._id);
    setTasksLoading(true);
    try {
      setTasks(await vacationsApi.getTasks(vacation._id));
      setError(null);
    } catch (err) {
      setError(err.message);
      setTasks([]);
    }
    setTasksLoading(false);
  };

  const handleRedate = async (task, vacation) => {
    try {
      // vacationMove is the whole point of this flow: without it the backend
      // would read a planned move as an unexcused postpone.
      await tasksApi.update(task._id, {
        ecd: { type: "date", value: dayAfter(vacation.endDate) },
        vacationMove: true,
      });
      setTasks(await vacationsApi.getTasks(vacation._id));
      setError(null);
      if (onTasksChanged) await onTasksChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  /* ── Render ── */

  if (loading) {
    return <LoadingState label="Loading vacations…" style={styles.loading} />;
  }

  const today = status?.today ?? "";
  const activeId = status?.active?._id ?? null;

  const rangeLabel = (v) => `${formatDay(v.startDate)} → ${formatDay(v.endDate)}`;
  const statusOf = (v) =>
    v._id === activeId ? STATUS.active : v.endDate < today ? STATUS.past : STATUS.upcoming;

  const menuActions = menuFor
    ? [
        {
          key: "edit",
          label: "Edit vacation",
          icon: "pencil",
          onPress: () => setModalState({ mode: "edit", vacation: menuFor }),
        },
        {
          key: "delete",
          label: "Delete vacation",
          icon: "trash-outline",
          destructive: true,
          onPress: () => setDeleteTarget(menuFor),
        },
      ]
    : [];

  return (
    <View>
      {error && (
        <Banner tone="danger" icon="alert" onDismiss={() => setError(null)}>
          {`Action failed: ${error}`}
        </Banner>
      )}

      {/* ── Status banner: the thing that stops a forgotten trip going unnoticed ── */}
      {status?.onVacation && status.active && (
        <Banner tone="info" icon="sunny" testID="vacation-active-banner">
          <BannerText>
            <Text style={styles.strong}>You're on vacation.</Text> Day{" "}
            {status.active.dayOfVacation} of {status.active.totalDays}
            {status.active.note ? ` · ${status.active.note}` : ""} — back on{" "}
            {formatDay(dayAfter(status.active.endDate))}. Missed days aren't
            counted against you, and insight reports are paused until you're
            back.
          </BannerText>
        </Banner>
      )}
      {!status?.onVacation && status?.justReturnedFrom && (
        <Banner tone="info" icon="home">
          <BannerText>
            <Text style={styles.strong}>Welcome back.</Text> You were away{" "}
            {status.justReturnedFrom.days} day
            {status.justReturnedFrom.days === 1 ? "" : "s"} — habit streaks
            start fresh from here, and your next report will have a restart
            plan.
          </BannerText>
        </Banner>
      )}

      {vacations.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            compact
            icon="airplane-outline"
            title="No vacations yet — add one!"
            message="Book the days you're away and anything you don't get done then won't count as procrastination. Streaks pause rather than break, and you can book a trip months ahead."
          />
        </Card>
      ) : (
        <Card padded={false} style={styles.list}>
          {vacations.map((vacation, index) => {
            const st = statusOf(vacation);
            const isPast = st === STATUS.past;
            const isOpen = openTasksFor === vacation._id;
            const days = lengthOf(vacation);
            return (
              <View
                key={vacation._id}
                style={[styles.rowWrap, index > 0 && styles.rowDivider]}
              >
                {/* Body, Tasks and "⋯" are siblings so each is its own
                    screen-reader stop (no buttons nested in a button). */}
                <View style={styles.row}>
                <Pressable
                  testID={`vacation-${vacation._id}`}
                  onPress={() => setModalState({ mode: "edit", vacation })}
                  onLongPress={() => setMenuFor(vacation)}
                  accessibilityRole="button"
                  accessibilityLabel={`${rangeLabel(vacation)}, ${days} day${
                    days === 1 ? "" : "s"
                  }, ${st.label}${vacation.note ? `, ${vacation.note}` : ""}`}
                  accessibilityHint="Edits the vacation. Long press for more actions."
                  style={({ pressed }) => [styles.rowPress, pressed && styles.rowPressed]}
                >
                  <View style={[styles.rowMain, isPast && styles.past]}>
                    <Text style={styles.rowDates}>{rangeLabel(vacation)}</Text>
                    <View style={styles.metaRow}>
                      <Badge label={st.label} tone={st.tone} icon={st.icon} />
                      <Text style={styles.rowMeta}>
                        {days} day{days === 1 ? "" : "s"}
                      </Text>
                    </View>
                    {vacation.note ? (
                      <Text style={styles.rowNote} numberOfLines={2}>
                        {vacation.note}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>

                  <Button
                    title={isOpen ? "Hide" : "Tasks"}
                    variant="tonal"
                    onPress={() => handleToggleTasks(vacation)}
                    accessibilityLabel={
                      isOpen
                        ? `Hide tasks for ${rangeLabel(vacation)}`
                        : `Tasks inside ${rangeLabel(vacation)}`
                    }
                    style={styles.tasksBtn}
                  />
                  <IconButton
                    icon="ellipsis-horizontal"
                    label={`More actions for vacation ${rangeLabel(vacation)}`}
                    onPress={() => setMenuFor(vacation)}
                  />
                </View>

                {isOpen && (
                  <View style={styles.tasksBox}>
                    {tasksLoading ? (
                      <Text style={styles.tasksEmpty}>Loading…</Text>
                    ) : tasks.length === 0 ? (
                      <Text style={styles.tasksEmpty}>
                        Nothing dated inside this vacation. Repeating tasks
                        aren't listed — they can't be moved without changing
                        their schedule, so those days are simply excused.
                      </Text>
                    ) : (
                      tasks.map((task) => (
                        <View key={task._id} style={styles.taskRow}>
                          <View style={styles.taskMain}>
                            <Text style={styles.taskName}>{task.name}</Text>
                            <Text style={styles.taskMeta}>
                              {task.headerName ?? "—"}
                              {task.ecd && task.ecd.type === "date"
                                ? ` · ${formatDay(task.ecd.value)}`
                                : ""}
                            </Text>
                          </View>
                          <Button
                            title={`Move to ${formatDay(dayAfter(vacation.endDate))}`}
                            variant="tonal"
                            icon="arrow-forward"
                            onPress={() => handleRedate(task, vacation)}
                          />
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </Card>
      )}

      <ActionSheet
        visible={!!menuFor}
        title={menuFor ? rangeLabel(menuFor) : undefined}
        subtitle={menuFor?.note || undefined}
        actions={menuActions}
        onClose={() => setMenuFor(null)}
        testID="vacation-menu"
      />

      {modalState && (
        <VacationModal
          vacation={modalState.mode === "edit" ? modalState.vacation : undefined}
          onConfirm={handleSave}
          onCancel={() => setModalState(null)}
        />
      )}

      <ConfirmModal
        visible={!!deleteTarget}
        message={
          deleteTarget
            ? `Delete the vacation from ${formatDay(deleteTarget.startDate)} to ${formatDay(deleteTarget.endDate)}? Those days will count as ordinary days again.`
            : ""
        }
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 0,
    paddingVertical: spacing.xxxl,
  },
  strong: {
    fontWeight: "700",
  },
  list: {
    marginBottom: spacing.xxl,
  },
  rowWrap: {
    borderRadius: radii.lg,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 64,
    paddingVertical: spacing.sm + 2,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
  },
  rowPress: {
    flex: 1,
    borderRadius: 10,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  past: {
    opacity: 0.6,
  },
  rowDates: {
    ...type.callout,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm - 2,
    marginTop: spacing.xs + 2,
  },
  rowMeta: {
    ...type.footnote,
  },
  rowNote: {
    ...type.footnote,
    color: colors.text,
    marginTop: spacing.xs,
  },
  tasksBtn: {
    paddingHorizontal: spacing.md,
  },
  tasksBox: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.md,
  },
  tasksEmpty: {
    ...type.footnote,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  taskMain: {
    flex: 1,
    minWidth: 140,
  },
  taskName: {
    ...type.subhead,
    fontWeight: "600",
    color: colors.text,
  },
  taskMeta: {
    ...type.caption,
    fontWeight: "400",
    marginTop: spacing.xxs,
  },
});
