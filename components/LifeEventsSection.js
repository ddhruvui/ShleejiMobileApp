import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as lifeEventsApi from "../api/lifeevents";
import * as tasksApi from "../api/tasks";
import AddButton from "./AddButton";
import LifeEventModal from "./LifeEventModal";
import ConfirmModal from "./ConfirmModal";

/**
 * "7/3" → "↻ 7 Mar" — the recurring marker matches the todo's recurring-ECD
 * display; dates are parsed manually (never via Date) for timezone safety.
 */
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

function formatLifeEventDate(date) {
  const [day, month] = date.split("/").map(Number);
  return `↻ ${day} ${SHORT_MONTHS[month - 1]}`;
}

export default function LifeEventsSection({ onTasksChanged }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [modalState, setModalState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadEvents = useCallback(async () => {
    try {
      const all = await lifeEventsApi.getAll();
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

  /* ── Life event CRUD (no optimistic updates: mutate via API, then refetch) ── */

  const handleSaveEvent = async (draft) => {
    if (!modalState) return;
    try {
      if (modalState.mode === "add") {
        await lifeEventsApi.create({ name: draft.name, date: draft.date });
      } else {
        const current = modalState.lifeEvent;
        await lifeEventsApi.update(current._id, {
          name: draft.name,
          date: draft.date,
        });
        // A rename mirrors onto the linked todo task (the task's date is this
        // year's occurrence — moving the anniversary doesn't reschedule it)
        if (current.todoTaskId && draft.name !== current.name) {
          await tasksApi.update(current.todoTaskId, { name: draft.name });
          onTasksChanged();
        }
      }
      await loadEvents();
      setModalState(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleDone = async (event) => {
    try {
      await lifeEventsApi.update(event._id, { done: !event.done });
      // Mirror onto the linked todo task while one exists
      if (event.todoTaskId) {
        await tasksApi.update(event.todoTaskId, { done: !event.done });
        onTasksChanged();
      }
      await loadEvents();
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMove = async (event, delta) => {
    try {
      await lifeEventsApi.update(event._id, {
        priority: event.priority + delta,
      });
      await loadEvents();
      setError(null);
    } catch (err) {
      setError(err.message);
      await loadEvents();
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteTarget) return;
    try {
      // The todo task created for this year (if any) is deliberately kept
      await lifeEventsApi.remove(deleteTarget._id);
      await loadEvents();
      setDeleteTarget(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  /* ── Render ── */

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#6200ee" />
        <Text style={styles.loadingText}>Loading life events…</Text>
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

      <View style={styles.toolbar}>
        <AddButton
          label="Add Life Event"
          onPress={() => setModalState({ mode: "add" })}
        />
      </View>

      {events.length > 0 && (
        <View style={styles.list}>
          {events.map((event, idx) => (
            <View
              key={event._id}
              style={[
                styles.row,
                event.done && styles.rowDone,
                idx === events.length - 1 && styles.rowLast,
              ]}
            >
              {/* Same square checkbox as the todo's TaskCard */}
              <TouchableOpacity
                style={[styles.check, event.done && styles.checkDone]}
                onPress={() => handleToggleDone(event)}
              >
                {event.done && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </TouchableOpacity>
              <View style={styles.main}>
                <View style={styles.labelRow}>
                  <Text
                    style={[styles.name, event.done && styles.nameDone]}
                    numberOfLines={2}
                  >
                    {event.name}
                  </Text>
                  {/* Same slot the todo uses for the ECD badge */}
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateText}>
                      {formatLifeEventDate(event.date)}
                    </Text>
                  </View>
                  {!!event.todoTaskId && (
                    <View style={styles.inTodoBadge}>
                      <Text style={styles.inTodoText}>in todo</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, idx === 0 && styles.disabledBtn]}
                  onPress={() => handleMove(event, -1)}
                  disabled={idx === 0}
                >
                  <Ionicons
                    name="arrow-up"
                    size={16}
                    color={idx === 0 ? "#ccc" : "#656d76"}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    idx === events.length - 1 && styles.disabledBtn,
                  ]}
                  onPress={() => handleMove(event, 1)}
                  disabled={idx === events.length - 1}
                >
                  <Ionicons
                    name="arrow-down"
                    size={16}
                    color={idx === events.length - 1 ? "#ccc" : "#656d76"}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setModalState({ mode: "edit", lifeEvent: event })}
                >
                  <Ionicons name="pencil" size={16} color="#656d76" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setDeleteTarget(event)}
                >
                  <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {events.length === 0 && (
        <Text style={styles.emptyText}>
          No life events yet — add one! A life event is a date that repeats
          every year (like a birthday); it lands in your todo on the day.
        </Text>
      )}

      {/* Modals */}
      <LifeEventModal
        visible={!!modalState}
        lifeEvent={
          modalState?.mode === "edit" ? modalState.lifeEvent : undefined
        }
        onConfirm={handleSaveEvent}
        onCancel={() => setModalState(null)}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        message={`Delete life event "${deleteTarget?.name}"? It will no longer be added to your todo each year (this year's task, if already added, stays).`}
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
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 16,
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
  /* Rows mirror the todo's TaskCard styling (square checkbox, inline date
     badge, borderless action icons) so the two lists feel identical. */
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
  },
  rowDone: {
    opacity: 0.6,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d0d7de",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  checkDone: {
    borderColor: "#6200ee",
    backgroundColor: "#6200ee",
  },
  main: {
    flex: 1,
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
  dateBadge: {
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dateText: {
    fontSize: 11,
    color: "#656d76",
    fontWeight: "500",
  },
  inTodoBadge: {
    backgroundColor: "#e8f0fe",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  inTodoText: {
    fontSize: 11,
    color: "#1e88e5",
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 2,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 6,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    color: "#656d76",
    paddingVertical: 24,
  },
});
