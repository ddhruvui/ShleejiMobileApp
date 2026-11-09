import React, {
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
} from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as eventsApi from "../api/events";
import * as headersApi from "../api/headers";
import * as tasksApi from "../api/tasks";
import EventModal from "./EventModal";
import ScheduleEventModal from "./ScheduleEventModal";
import ConfirmModal from "./ConfirmModal";
import {
  ActionSheet,
  Banner,
  BannerText,
  Button,
  Card,
  EmptyState,
  IconButton,
  LoadingState,
} from "./ui";
import { formatDateKey } from "../utils/ecd";
import { colors, spacing, type, HIT_TARGET } from "../theme";

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
  // "⋯" menu: the id is kept while the sheet animates closed so its title
  // doesn't blank out mid-dismiss.
  const [menuId, setMenuId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const openMenu = (id) => {
    setMenuId(id);
    setMenuOpen(true);
  };

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
    return <LoadingState compact label="Loading events…" />;
  }

  const menuEvent = events.find((e) => e._id === menuId);
  const menuCount = menuEvent ? menuEvent.tasks.length : 0;
  const menuActions = menuEvent
    ? [
        {
          key: "schedule",
          label: "Add to todo",
          icon: "add-circle-outline",
          onPress: () => setScheduleState({ event: menuEvent }),
        },
        {
          key: "edit",
          label: "Edit event",
          icon: "pencil",
          onPress: () => setEventModalState({ mode: "edit", event: menuEvent }),
        },
        {
          key: "delete",
          label: "Delete event",
          icon: "trash-outline",
          destructive: true,
          onPress: () => setDeleteTarget(menuEvent),
        },
      ]
    : [];

  return (
    <View>
      {error && (
        <Banner tone="danger" onDismiss={() => setError(null)}>
          {`Action failed: ${error}`}
        </Banner>
      )}
      {notice && (
        <Banner
          tone="success"
          icon="checkmark"
          onDismiss={() => setNotice(null)}
        >
          <BannerText style={styles.noticeText}>{notice}</BannerText>
          {onViewTodo && (
            <Button
              title="View in todo"
              variant="ghost"
              icon="arrow-forward"
              onPress={onViewTodo}
              style={styles.noticeLink}
            />
          )}
        </Banner>
      )}

      {events.map((event) => {
        const isOpen = expanded.has(event._id);
        const count = event.tasks.length;
        const countLabel = `${count} task${count === 1 ? "" : "s"}`;
        return (
          <Card key={event._id} padded={false} style={styles.card}>
            <View style={styles.head}>
              <Pressable
                style={({ pressed }) => [
                  styles.toggle,
                  pressed && styles.togglePressed,
                ]}
                onPress={() => toggleExpanded(event._id)}
                onLongPress={() => openMenu(event._id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} ${event.name}`}
                accessibilityHint="Long press for more actions."
              >
                <View style={styles.headText}>
                  <Text style={styles.eventName} numberOfLines={2}>
                    {event.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {countLabel}
                    {!isOpen && count > 0
                      ? ` · ${event.tasks.join(" · ")}`
                      : ""}
                  </Text>
                </View>
                <Ionicons
                  name={isOpen ? "chevron-down" : "chevron-forward"}
                  size={20}
                  color={colors.textTertiary}
                />
              </Pressable>
              <IconButton
                icon="ellipsis-horizontal"
                label={`More actions for ${event.name}`}
                onPress={() => openMenu(event._id)}
                style={styles.more}
              />
            </View>

            {isOpen && (
              <View style={styles.body}>
                {event.tasks.map((task, i) => (
                  <View
                    key={i}
                    style={[styles.taskRow, i > 0 && styles.taskDivider]}
                  >
                    <Text style={styles.taskNum}>{i + 1}</Text>
                    <Text style={styles.taskName}>{task}</Text>
                    <IconButton
                      icon="add-circle-outline"
                      label={`Add "${task}" to todo`}
                      color={colors.primary}
                      onPress={() =>
                        setScheduleState({ event, initialSelected: [task] })
                      }
                    />
                  </View>
                ))}
                <Button
                  title="Add to todo"
                  variant="tonal"
                  icon="add"
                  accessibilityLabel={`Add ${event.name} to todo`}
                  onPress={() => setScheduleState({ event })}
                  fullWidth
                  style={styles.schedule}
                />
              </View>
            )}
          </Card>
        );
      })}

      {events.length === 0 && (
        <EmptyState
          compact
          icon="albums-outline"
          title="No events yet — add one!"
          message={
            'An event is a reusable bundle of tasks (e.g. "Burger Night") you can drop into your todo for any date.'
          }
        />
      )}
      {events.length > 0 && (
        <Text style={styles.hint}>
          An event is a reusable bundle of tasks you can drop into your todo for
          any date.
        </Text>
      )}

      {/* Modals */}
      <ActionSheet
        visible={menuOpen}
        title={menuEvent?.name}
        subtitle={
          menuEvent ? `${menuCount} task${menuCount === 1 ? "" : "s"}` : undefined
        }
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />

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
  noticeText: {
    color: colors.successText,
  },
  noticeLink: {
    alignSelf: "flex-start",
    paddingHorizontal: 0,
    minHeight: HIT_TARGET,
  },
  card: {
    marginBottom: spacing.md,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: spacing.xs,
  },
  toggle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: HIT_TARGET + spacing.xl,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
  },
  togglePressed: {
    opacity: 0.7,
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  eventName: {
    ...type.headline,
  },
  meta: {
    ...type.footnote,
    marginTop: 2,
  },
  more: {
    marginLeft: spacing.xxs,
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingBottom: spacing.lg,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: HIT_TARGET + spacing.xs,
  },
  taskDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  taskNum: {
    ...type.caption,
    width: 20,
    color: colors.primaryText,
    fontVariant: ["tabular-nums"],
  },
  taskName: {
    ...type.callout,
    fontWeight: "400",
    flex: 1,
    paddingVertical: spacing.sm,
  },
  schedule: {
    marginTop: spacing.sm,
    marginRight: spacing.md,
  },
  hint: {
    ...type.footnote,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
});
