import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as eventsApi from "../api/events";
import * as headersApi from "../api/headers";
import * as tasksApi from "../api/tasks";
import EventModal from "./EventModal";
import ScheduleEventModal from "./ScheduleEventModal";
import ConfirmModal from "./ConfirmModal";
import { formatDateKey } from "../utils/ecd";

export default function EventsSection({ onTasksAdded }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Modal states
  const [eventModalState, setEventModalState] = useState(null);
  const [scheduleState, setScheduleState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadEvents = useCallback(async () => {
    try {
      const all = await eventsApi.getAll();
      setEvents(all);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  /* ── Event CRUD ── */

  const handleSaveEvent = async (draft) => {
    if (!eventModalState) return;
    try {
      if (eventModalState.mode === "add") {
        await eventsApi.create(draft);
      } else {
        await eventsApi.update(eventModalState.event._id, draft);
      }
      await loadEvents();
      setEventModalState(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteTarget) return;
    try {
      await eventsApi.remove(deleteTarget._id);
      setEvents((prev) => prev.filter((e) => e._id !== deleteTarget._id));
      setDeleteTarget(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  /* ── Add event tasks to the todo ──
   * Tasks land under a header named after the event — reused when one
   * already exists so later additions join it — with the chosen date as
   * their ECD. */
  const handleSchedule = async (draft) => {
    if (!scheduleState) return;
    const { event } = scheduleState;
    try {
      const eventKey = event.name.trim().toLowerCase();
      const existing = (await headersApi.getAll()).find(
        (h) => h.name.trim().toLowerCase() === eventKey,
      );
      const header = existing || (await headersApi.create({ name: event.name }));
      // Create sequentially so tasks keep the event's order
      for (const taskName of draft.tasks) {
        await tasksApi.create({
          name: taskName,
          headerId: header._id,
          notes: "",
          ecd: { type: "date", value: draft.date },
        });
      }
      setScheduleState(null);
      setError(null);
      setNotice(
        `Added ${draft.tasks.length} task${draft.tasks.length === 1 ? "" : "s"} under "${event.name}" for ${formatDateKey(draft.date)}.`,
      );
      onTasksAdded();
    } catch (err) {
      setError(err.message);
    }
  };

  /* ── Render ── */

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#6200ee" />
        <Text style={styles.loadingText}>Loading events…</Text>
      </View>
    );
  }

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
      {notice && (
        <View style={styles.noticeBar}>
          <Text style={styles.noticeText}>{notice}</Text>
          <TouchableOpacity onPress={() => setNotice(null)}>
            <Ionicons name="close" size={18} color="#1a7f37" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.addEventBtn}
          onPress={() => setEventModalState({ mode: "add" })}
          activeOpacity={0.7}
        >
          <Text style={styles.addEventText}>+ Add Event</Text>
        </TouchableOpacity>
      </View>

      {events.map((event) => (
        <View key={event._id} style={styles.section}>
          <View style={styles.headerRow}>
            <Text style={styles.headerName} numberOfLines={1}>
              {event.name}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => setEventModalState({ mode: "edit", event })}
              >
                <Ionicons name="pencil" size={16} color="#656d76" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => setDeleteTarget(event)}
              >
                <Ionicons name="trash-outline" size={16} color="#e74c3c" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.scheduleBtn}
                onPress={() => setScheduleState({ event })}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.scheduleBtnText}>Add to todo</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.taskList}>
            {event.tasks.map((task, i) => (
              <View
                key={i}
                style={[
                  styles.taskRow,
                  i === event.tasks.length - 1 && styles.taskRowLast,
                ]}
              >
                <Text style={styles.taskName}>{task}</Text>
                <TouchableOpacity
                  style={styles.taskAddBtn}
                  onPress={() =>
                    setScheduleState({ event, initialSelected: [task] })
                  }
                >
                  <Ionicons name="add" size={16} color="#656d76" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      ))}

      {events.length === 0 && (
        <Text style={styles.emptyText}>
          No events yet — add one! An event is a reusable bundle of tasks (e.g.
          "Burger Night") you can drop into your todo for any date.
        </Text>
      )}

      {/* Modals */}
      <EventModal
        visible={!!eventModalState}
        event={eventModalState?.mode === "edit" ? eventModalState.event : undefined}
        onConfirm={handleSaveEvent}
        onCancel={() => setEventModalState(null)}
      />

      <ScheduleEventModal
        visible={!!scheduleState}
        event={scheduleState?.event}
        initialSelected={scheduleState?.initialSelected}
        onConfirm={handleSchedule}
        onCancel={() => setScheduleState(null)}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        message={`Delete event "${deleteTarget?.name}"? Tasks already added to the todo stay.`}
        onConfirm={handleDeleteEvent}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: "#656d76",
  },
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
  errorText: {
    fontSize: 13,
    color: "#e74c3c",
    flex: 1,
    marginRight: 8,
  },
  noticeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  noticeText: {
    fontSize: 13,
    color: "#1a7f37",
    flex: 1,
    marginRight: 8,
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 16,
  },
  addEventBtn: {
    backgroundColor: "#6200ee",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addEventText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  section: {
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
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
    backgroundColor: "#f6f8fa",
  },
  headerName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2328",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  headerBtn: {
    padding: 6,
    borderRadius: 6,
  },
  scheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1a7f37",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginLeft: 4,
  },
  scheduleBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  taskList: {
    paddingHorizontal: 14,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
  },
  taskRowLast: {
    borderBottomWidth: 0,
  },
  taskName: {
    fontSize: 15,
    color: "#1f2328",
    flex: 1,
  },
  taskAddBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d0d7de",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    color: "#656d76",
    paddingVertical: 24,
  },
});
