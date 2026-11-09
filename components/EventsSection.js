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
import * as eventsApi from "../api/events";
import * as headersApi from "../api/headers";
import * as tasksApi from "../api/tasks";
import EventModal from "./EventModal";
import ScheduleEventModal from "./ScheduleEventModal";
import ConfirmModal from "./ConfirmModal";
import { formatDateKey } from "../utils/ecd";

export default function EventsSection({ onTasksAdded, onViewTodo, addRef }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  // Ids of the events whose task list is open (mirrors the web FE's
  // accordion): the first event starts open, an added/edited event opens.
  const [expanded, setExpanded] = useState(new Set());

  // Modal states
  const [eventModalState, setEventModalState] = useState(null);
  const [scheduleState, setScheduleState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // This panel has no toolbar of its own: TodoScreen's title-bar "+" opens the
  // add-event modal through this handle while the Events view is showing.
  useImperativeHandle(addRef, () => ({
    openAdd: () => setEventModalState({ mode: "add" }),
  }));

  const loadEvents = useCallback(async () => {
    try {
      const all = await eventsApi.getAll();
      setEvents(all);
      // Seed only when nothing is open yet so a reload never collapses rows
      if (all.length > 0)
        setExpanded((prev) => (prev.size > 0 ? prev : new Set([all[0]._id])));
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

  const expand = (id) => setExpanded((prev) => new Set(prev).add(id));

  const toggleExpanded = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ── Event CRUD ── */

  const handleSaveEvent = async (draft) => {
    if (!eventModalState) return;
    try {
      if (eventModalState.mode === "add") {
        const created = await eventsApi.create(draft);
        if (created?._id) expand(created._id);
      } else {
        await eventsApi.update(eventModalState.event._id, draft);
        expand(eventModalState.event._id);
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
      const header =
        existing || (await headersApi.create({ name: event.name }));
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
          {onViewTodo && (
            <TouchableOpacity
              onPress={onViewTodo}
              style={styles.noticeLink}
              accessibilityRole="button"
            >
              <Text style={styles.noticeLinkText}>View in todo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setNotice(null)}>
            <Ionicons name="close" size={18} color="#1a7f37" />
          </TouchableOpacity>
        </View>
      )}

      {events.length > 0 && (
        <View style={styles.list}>
          {events.map((event, idx) => {
            const isOpen = expanded.has(event._id);
            const count = event.tasks.length;
            return (
              <View
                key={event._id}
                style={[styles.event, idx > 0 && styles.eventDivider]}
              >
                <View style={styles.eventHead}>
                  <TouchableOpacity
                    style={styles.toggle}
                    onPress={() => toggleExpanded(event._id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} ${event.name}`}
                    activeOpacity={0.6}
                  >
                    <Ionicons
                      name={isOpen ? "chevron-down" : "chevron-forward"}
                      size={16}
                      color="#656d76"
                    />
                    <View style={styles.eventText}>
                      <View style={styles.eventTitleRow}>
                        <Text style={styles.eventName} numberOfLines={1}>
                          {event.name}
                        </Text>
                        <View style={styles.countPill}>
                          <Text style={styles.countText}>
                            {count} task{count === 1 ? "" : "s"}
                          </Text>
                        </View>
                      </View>
                      {!isOpen && count > 0 && (
                        <Text style={styles.preview} numberOfLines={1}>
                          {event.tasks.join(" · ")}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => setEventModalState({ mode: "edit", event })}
                    accessibilityLabel={`Edit event ${event.name}`}
                  >
                    <Ionicons name="pencil" size={16} color="#656d76" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => setDeleteTarget(event)}
                    accessibilityLabel={`Delete event ${event.name}`}
                  >
                    <Ionicons name="trash-outline" size={16} color="#656d76" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.scheduleBtn}
                    onPress={() => setScheduleState({ event })}
                    accessibilityLabel={`Add ${event.name} to todo`}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={15} color="#ffffff" />
                    {/* Short label so long event names fit on a phone; the
                        accessibility label still reads "Add … to todo" */}
                    <Text style={styles.scheduleBtnText}>Todo</Text>
                  </TouchableOpacity>
                </View>

                {isOpen && (
                  <View style={styles.taskList}>
                    {event.tasks.map((task, i) => (
                      <View
                        key={i}
                        style={[
                          styles.taskRow,
                          i === count - 1 && styles.taskRowLast,
                        ]}
                      >
                        <Text style={styles.taskNum}>{i + 1}</Text>
                        <Text style={styles.taskName}>{task}</Text>
                        <TouchableOpacity
                          style={styles.taskAddBtn}
                          onPress={() =>
                            setScheduleState({ event, initialSelected: [task] })
                          }
                          accessibilityLabel={`Add "${task}" to todo`}
                        >
                          <Text style={styles.taskAddText}>+ Add</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {events.length === 0 && (
        <Text style={styles.emptyText}>
          No events yet — add one! An event is a reusable bundle of tasks (e.g.
          "Burger Night") you can drop into your todo for any date.
        </Text>
      )}
      {events.length > 0 && (
        <Text style={styles.hint}>
          An event is a reusable bundle of tasks you can drop into your todo for
          any date.
        </Text>
      )}

      {/* Modals */}
      <EventModal
        visible={!!eventModalState}
        event={
          eventModalState?.mode === "edit" ? eventModalState.event : undefined
        }
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
  noticeLink: {
    marginRight: 10,
  },
  noticeLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a7f37",
    textDecorationLine: "underline",
  },
  // Accordion list in the web FE's palette: purple is the Events identity
  // color, green the primary action, red stays on the delete confirm.
  list: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
    marginBottom: 12,
  },
  event: {},
  eventDivider: {
    borderTopWidth: 1,
    borderTopColor: "#d0d7de",
  },
  eventHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 10,
    minHeight: 56,
  },
  toggle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingRight: 4,
  },
  eventText: {
    flex: 1,
    minWidth: 0,
  },
  eventTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eventName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2328",
  },
  countPill: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#656d76",
  },
  preview: {
    marginTop: 2,
    fontSize: 13,
    color: "#656d76",
  },
  iconBtn: {
    padding: 7,
    borderRadius: 6,
  },
  scheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#1a7f37",
    paddingVertical: 7,
    paddingLeft: 6,
    paddingRight: 9,
    borderRadius: 6,
    marginLeft: 4,
  },
  scheduleBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  taskList: {
    paddingLeft: 30,
    paddingRight: 12,
    paddingBottom: 8,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
  },
  taskRowLast: {
    borderBottomWidth: 0,
  },
  taskNum: {
    width: 20,
    fontSize: 12,
    fontWeight: "600",
    color: "#8250df",
    fontVariant: ["tabular-nums"],
  },
  taskName: {
    fontSize: 15,
    color: "#1f2328",
    flex: 1,
  },
  taskAddBtn: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  taskAddText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#1f2328",
  },
  hint: {
    fontSize: 13,
    color: "#656d76",
    marginBottom: 16,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    color: "#656d76",
    paddingVertical: 24,
  },
});
