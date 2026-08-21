import React, {
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as vacationsApi from "../api/vacations";
import * as tasksApi from "../api/tasks";
import VacationModal from "./VacationModal";
import ConfirmModal from "./ConfirmModal";

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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#1e88e5" />
        <Text style={styles.loadingText}>Loading vacations…</Text>
      </View>
    );
  }

  const today = status?.today ?? "";
  const activeId = status?.active?._id ?? null;

  return (
    <View>
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>Action failed: {error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={18} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Status banner: the thing that stops a forgotten trip going unnoticed ── */}
      {status?.onVacation && status.active && (
        <View style={[styles.banner, styles.bannerActive]}>
          <Text style={styles.bannerText}>
            <Text style={styles.bannerStrong}>You're on vacation.</Text> Day{" "}
            {status.active.dayOfVacation} of {status.active.totalDays}
            {status.active.note ? ` · ${status.active.note}` : ""} — back on{" "}
            {formatDay(dayAfter(status.active.endDate))}. Missed days aren't
            counted against you, and insight reports are paused until you're
            back.
          </Text>
        </View>
      )}
      {!status?.onVacation && status?.justReturnedFrom && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            <Text style={styles.bannerStrong}>Welcome back.</Text> You were away{" "}
            {status.justReturnedFrom.days} day
            {status.justReturnedFrom.days === 1 ? "" : "s"} — habit streaks
            start fresh from here, and your next report will have a restart
            plan.
          </Text>
        </View>
      )}

      {vacations.length === 0 ? (
        <Text style={styles.emptyText}>
          No vacations yet — add one! Book the days you're away and anything you
          don't get done then won't count as procrastination. Streaks pause
          rather than break, and you can book a trip months ahead.
        </Text>
      ) : (
        <View style={styles.list}>
          {vacations.map((vacation) => {
            const isActive = vacation._id === activeId;
            const isPast = vacation.endDate < today;
            const isOpen = openTasksFor === vacation._id;
            const days = lengthOf(vacation);
            return (
              <View
                key={vacation._id}
                style={[styles.row, isPast && styles.rowPast]}
              >
                <View style={styles.rowMain}>
                  <View style={styles.rowHeader}>
                    {isActive && <View style={styles.activeDot} />}
                    <Text style={styles.rowDates}>
                      {formatDay(vacation.startDate)} →{" "}
                      {formatDay(vacation.endDate)}
                    </Text>
                  </View>
                  <Text style={styles.rowMeta}>
                    {days} day{days === 1 ? "" : "s"}
                    {isActive ? " · on now" : isPast ? " · past" : " · upcoming"}
                    {vacation.note ? ` · ${vacation.note}` : ""}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => handleToggleTasks(vacation)}
                >
                  <Text style={styles.linkBtnText}>
                    {isOpen ? "Hide" : "Tasks"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setModalState({ mode: "edit", vacation })}
                >
                  <Ionicons name="pencil" size={16} color="#656d76" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setDeleteTarget(vacation)}
                >
                  <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                </TouchableOpacity>

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
                          <TouchableOpacity
                            style={styles.linkBtn}
                            onPress={() => handleRedate(task, vacation)}
                          >
                            <Text style={styles.linkBtnText}>
                              Move to {formatDay(dayAfter(vacation.endDate))}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {modalState && (
        <VacationModal
          vacation={modalState.mode === "edit" ? modalState.vacation : undefined}
          onConfirm={handleSave}
          onCancel={() => setModalState(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`Delete the vacation from ${formatDay(deleteTarget.startDate)} to ${formatDay(deleteTarget.endDate)}? Those days will count as ordinary days again.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: "center", paddingVertical: 32 },
  loadingText: { marginTop: 8, fontSize: 14, color: "#656d76" },
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fde8e8",
  },
  errorText: { fontSize: 13, color: "#e74c3c", flex: 1, marginRight: 8 },
  banner: {
    backgroundColor: "#eef6fd",
    borderWidth: 1,
    borderColor: "#c5dcf5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  bannerActive: { borderLeftWidth: 4, borderLeftColor: "#1e88e5" },
  bannerText: { fontSize: 13, color: "#1f2328", lineHeight: 19 },
  bannerStrong: { fontWeight: "700" },
  emptyText: {
    fontSize: 14,
    color: "#656d76",
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 24,
    paddingHorizontal: 8,
  },
  list: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#eaeef2",
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
  },
  rowPast: { opacity: 0.6 },
  rowMain: { flex: 1, minWidth: 0 },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#1e88e5",
  },
  rowDates: { fontSize: 14, fontWeight: "600", color: "#1f2328" },
  rowMeta: { fontSize: 12, color: "#656d76", marginTop: 2 },
  linkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#c5dcf5",
  },
  linkBtnText: { fontSize: 12, color: "#1e88e5", fontWeight: "600" },
  iconBtn: { padding: 6 },
  tasksBox: {
    width: "100%",
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f6f8fa",
    gap: 10,
  },
  tasksEmpty: { fontSize: 12, color: "#656d76", lineHeight: 18 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  taskMain: { flex: 1, minWidth: 0 },
  taskName: { fontSize: 13, fontWeight: "600", color: "#1f2328" },
  taskMeta: { fontSize: 11, color: "#656d76", marginTop: 1 },
});
