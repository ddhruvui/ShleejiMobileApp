import React, {
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
} from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import * as lifeEventsApi from "../api/lifeevents";
import * as tasksApi from "../api/tasks";
import LifeEventModal from "./LifeEventModal";
import ConfirmModal from "./ConfirmModal";
import {
  ActionSheet,
  Badge,
  Banner,
  Card,
  Checkbox,
  EmptyState,
  IconButton,
  LoadingState,
} from "./ui";
import { colors, spacing, type } from "../theme";

/**
 * "7/3" → "7 Mar" — the badge's repeat icon carries the recurring marker
 * (matching the todo's recurring-ECD badge); dates are parsed manually
 * (never via Date) for timezone safety. The stored "D/M" value is untouched.
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
  return `${day} ${SHORT_MONTHS[month - 1]}`;
}

export default function LifeEventsSection({ onTasksChanged, addRef }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [modalState, setModalState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // "⋯" menu: the id is kept while the sheet animates closed so its title
  // doesn't blank out mid-dismiss.
  const [menuId, setMenuId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // This panel has no toolbar of its own: TodoScreen's title-bar "+" opens the
  // add-life-event modal through this handle while the Life Events view shows.
  useImperativeHandle(addRef, () => ({
    openAdd: () => setModalState({ mode: "add" }),
  }));

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

  const openMenu = (id) => {
    setMenuId(id);
    setMenuOpen(true);
  };

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
    return <LoadingState compact label="Loading life events…" />;
  }

  // Rows stay in the server's priority order (the user's own order, changed
  // with Move up/down) — deliberately not regrouped by upcoming month.
  const menuIndex = events.findIndex((e) => e._id === menuId);
  const menuEvent = menuIndex >= 0 ? events[menuIndex] : null;
  const menuActions = menuEvent
    ? [
        {
          key: "edit",
          label: "Edit life event",
          icon: "pencil",
          onPress: () => setModalState({ mode: "edit", lifeEvent: menuEvent }),
        },
        {
          key: "up",
          label: "Move up",
          icon: "arrow-up",
          disabled: menuIndex === 0,
          onPress: () => handleMove(menuEvent, -1),
        },
        {
          key: "down",
          label: "Move down",
          icon: "arrow-down",
          disabled: menuIndex === events.length - 1,
          onPress: () => handleMove(menuEvent, 1),
        },
        {
          key: "delete",
          label: "Delete life event",
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

      {events.length > 0 && (
        <Card padded={false} style={styles.list}>
          {events.map((event, idx) => {
            const when = formatLifeEventDate(event.date);
            return (
              <View
                key={event._id}
                style={[styles.row, idx > 0 && styles.rowDivider]}
              >
                {/* Same square checkbox as the todo's TaskCard */}
                <Checkbox
                  checked={!!event.done}
                  label={
                    event.done
                      ? `Mark "${event.name}" not done`
                      : `Mark "${event.name}" done`
                  }
                  onPress={() => handleToggleDone(event)}
                  style={styles.checkbox}
                />
                <Pressable
                  testID={`lifeevent-${event._id}`}
                  onPress={() =>
                    setModalState({ mode: "edit", lifeEvent: event })
                  }
                  onLongPress={() => openMenu(event._id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${event.name}${
                    event.done ? ", done" : ""
                  }, every year on ${when}${
                    event.todoTaskId ? ", in todo" : ""
                  }`}
                  accessibilityHint="Opens the life event. Long press for more actions."
                  style={({ pressed }) => [
                    styles.main,
                    pressed && styles.mainPressed,
                  ]}
                >
                  <Text
                    style={[styles.name, event.done && styles.nameDone]}
                    numberOfLines={2}
                  >
                    {event.name}
                  </Text>
                  {/* Same slot the todo uses for the ECD badge */}
                  <View style={styles.metaRow}>
                    <Badge label={when} icon="repeat" />
                    {!!event.todoTaskId && (
                      <Badge label="in todo" tone="primary" />
                    )}
                  </View>
                </Pressable>
                <IconButton
                  icon="ellipsis-horizontal"
                  label={`More actions for ${event.name}`}
                  onPress={() => openMenu(event._id)}
                />
              </View>
            );
          })}
        </Card>
      )}

      {events.length === 0 && (
        <EmptyState
          compact
          icon="gift-outline"
          title="No life events yet — add one!"
          message="A life event is a date that repeats every year (like a birthday); it lands in your todo on the day."
        />
      )}

      {/* Modals */}
      <ActionSheet
        visible={menuOpen}
        title={menuEvent?.name}
        subtitle={
          menuEvent
            ? `Every year on ${formatLifeEventDate(menuEvent.date)}`
            : undefined
        }
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />

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
  list: {
    marginBottom: spacing.xxl,
  },
  /* Rows mirror the todo's TaskCard (square checkbox, inline date badge,
     "⋯" menu) so the two lists feel identical. */
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.xs,
    paddingRight: spacing.xs,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  checkbox: {
    marginLeft: spacing.xs,
  },
  main: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingRight: spacing.xs,
  },
  mainPressed: {
    opacity: 0.6,
  },
  name: {
    ...type.callout,
    fontWeight: "500",
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
});
