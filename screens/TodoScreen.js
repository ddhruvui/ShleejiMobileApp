import React, { useState, useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Text, ScrollView, RefreshControl } from "react-native";
import * as headersApi from "../api/headers";
import * as tasksApi from "../api/tasks";
import TaskCard from "../components/TaskCard";
import AddButton from "../components/AddButton";
import ConfirmModal from "../components/ConfirmModal";
import AddTaskModal from "../components/AddTaskModal";
import HeaderModal from "../components/HeaderModal";
import InsightsSection from "../components/InsightsSection";
import EventsSection from "../components/EventsSection";
import LifeEventsSection from "../components/LifeEventsSection";
import GoalsSection from "../components/GoalsSection";
import ProjectsSection from "../components/ProjectsSection";
import VacationSection from "../components/VacationSection";
import OnCallSection from "../components/OnCallSection";
import {
  ActionSheet,
  Banner,
  BannerText,
  Card,
  Chip,
  CountPill,
  EmptyState,
  ErrorState,
  IconButton,
  ScreenHeader,
  SegmentedControl,
  SkeletonList,
} from "../components/ui";
import { colors, radii, spacing, type, useBottomClearance } from "../theme";
import {
  getEcdDateKey,
  formatDateKey,
  todayDateKey,
  isTaskDueToday,
} from "../utils/ecd";
import { syncDailyReminders } from "../utils/notifications";
import * as vacationsApi from "../api/vacations";
import * as onCallApi from "../api/oncall";
import { activeShift, formatDuration, minutesLeft } from "../utils/oncall";
import {
  fetchOneStepStreaks,
  isOneStepHeaderName,
  pauseStepsMatchingTask,
  pauseAllStartedSteps,
  streakFor,
} from "../utils/goalSync";
import {
  syncProjectTasksForTodoDone,
  syncProjectTasksForTodoEdit,
  syncProjectTaskOrderForTodo,
  unlinkProjectTasksForTodoTasks,
} from "../utils/projectSync";
import {
  syncLifeEventsForTodoDone,
  syncLifeEventsForTodoEdit,
  unlinkLifeEventsForTodoTasks,
} from "../utils/lifeEventSync";

/**
 * The views reachable from the chip row, in the web FE's toolbar order.
 * `null` is the task list itself; every other entry is a full panel that
 * replaces it. Panels are mutually exclusive (one `panel` value), so the
 * tapped chip is always the view shown, and tapping the active chip again
 * returns to the list — mirrors web FE App.tsx.
 */
export const PANELS = [
  { key: null, label: "Tasks", icon: "list" },
  { key: "insights", label: "Insights", icon: "analytics-outline" },
  { key: "events", label: "Events", icon: "albums-outline" },
  { key: "lifeEvents", label: "Life Events", icon: "gift-outline" },
  { key: "goals", label: "Goals", icon: "footsteps-outline" },
  { key: "projects", label: "Projects", icon: "rocket-outline" },
  { key: "vacation", label: "Vacation", icon: "sunny-outline" },
  { key: "onCall", label: "On-call", icon: "notifications-outline" },
];

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Monday, 9 November" — built by hand so it never depends on Intl. */
export function todayLine(now = new Date()) {
  return `${WEEKDAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]}`;
}

const BY_DATE_SECTION_LABELS = {
  present: "Today",
  past: "Overdue",
  future: "Upcoming",
};

export default function TodoScreen() {
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  // Habit streaks for the tasks under "One Step At A Time", keyed by name —
  // the same badge the Goals view puts on the step each of them belongs to.
  // Null while it is loading and after a failed fetch, which just hides them.
  const [streaks, setStreaks] = useState(null);
  const [actionError, setActionError] = useState(null);
  // By Date is a way of showing the task list (a segmented toggle inside the
  // Tasks view), not a panel — it stays independent of `panel`.
  const [byDateMode, setByDateMode] = useState(false);
  // Which panel replaces the task list: null (the list) or a PANELS key.
  const [panel, setPanel] = useState(null);
  const bottomClearance = useBottomClearance();

  // On-call shifts are screen-level so the "on call now" banner shows from
  // every view (mirrors the web FE). A record only — never touches tasks.
  const [onCallShifts, setOnCallShifts] = useState([]);
  const [clock, setClock] = useState(() => new Date());

  // Vacation status is screen-level, not panel-level, on purpose: the most
  // likely real-world failure of this feature is booking time off and
  // forgetting, then wondering months later why the insights went quiet. The
  // banner below makes an active vacation visible from every view — and the
  // ranges also silence the daily reminders while the user is away.
  const [vacationStatus, setVacationStatus] = useState(null);
  const [vacations, setVacations] = useState([]);

  // Tapping a chip shows that panel; tapping the active chip (or "Tasks")
  // returns to the task list.
  const togglePanel = (key) => {
    setPanel((prev) => (key === null || prev === key ? null : key));
  };

  // Modal states
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addTaskHeaderId, setAddTaskHeaderId] = useState(null);
  const [headerModalState, setHeaderModalState] = useState(null);
  // Header whose "⋯" menu is open: { header, idx }
  const [headerMenu, setHeaderMenu] = useState(null);

  // Each panel owns its own add modal, so the title-bar "+" reaches into the
  // one that is showing (see titleBarAdd below).
  const eventsAddRef = useRef(null);
  const lifeEventsAddRef = useRef(null);
  const goalsAddRef = useRef(null);
  const projectsAddRef = useRef(null);
  const vacationAddRef = useRef(null);
  const onCallAddRef = useRef(null);

  // Keep the active chip scrolled into view (e.g. after the vacation banner
  // jumps to a chip that is off-screen).
  const chipScrollRef = useRef(null);
  const chipX = useRef({});
  useEffect(() => {
    const x = chipX.current[panel ?? "tasks"];
    if (x != null) chipScrollRef.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  }, [panel]);

  /* ── Load all headers and their tasks ── */
  const loadAll = useCallback(async () => {
    try {
      const allHeaders = await headersApi.getAll();
      const headersWithTasks = await Promise.all(
        allHeaders.map(async (header) => {
          const tasks = await tasksApi.getAll(header._id);
          return { ...header, tasks };
        }),
      );
      setHeaders(headersWithTasks);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * Habit streaks, refreshed alongside the todo. Only the nightly archive
   * moves these numbers, so ticking a habit off today does not change the
   * badge until the cron has scored the day.
   */
  const refreshStreaks = useCallback(async () => {
    setStreaks(await fetchOneStepStreaks());
  }, []);

  /**
   * Vacation status and ranges. A failure is swallowed: this is context for a
   * banner and for silencing reminders, never a reason to show the user an
   * error over their todo list.
   */
  const refreshVacations = useCallback(async () => {
    try {
      const [status, all] = await Promise.all([
        vacationsApi.getStatus(),
        vacationsApi.getAll(),
      ]);
      setVacationStatus(status);
      setVacations(all);
    } catch {
      setVacationStatus(null);
      setVacations([]);
    }
  }, []);

  /** On-call shifts for the banner. A failure just hides the banner. */
  const refreshOnCall = useCallback(async () => {
    try {
      setOnCallShifts(await onCallApi.getAll());
    } catch {
      setOnCallShifts([]);
    }
  }, []);

  useEffect(() => {
    loadAll();
    refreshVacations();
    refreshStreaks();
    refreshOnCall();
  }, [loadAll, refreshVacations, refreshStreaks, refreshOnCall]);

  // The banner's "time left" and its disappearance follow the device clock.
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const currentShift = activeShift(onCallShifts, clock);

  /* ── Keep the 8:30 AM / 4:00 PM daily reminders in sync with task data ──
     Reminders are silenced on booked days: being nagged by your todo app on
     holiday rather defeats the point of booking the time off. */
  useEffect(() => {
    if (loading || headers.length === 0) return;
    syncDailyReminders(headers, vacations);
  }, [loading, headers, vacations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
    refreshStreaks();
  }, [loadAll, refreshStreaks]);

  /* ── Reload tasks for a single header ── */
  const reloadHeaderTasks = useCallback(async (headerId) => {
    try {
      const tasks = await tasksApi.getAll(headerId);
      setHeaders((prev) =>
        prev.map((h) => (h._id === headerId ? { ...h, tasks } : h)),
      );
    } catch (err) {
      console.error("Failed to reload tasks:", err);
    }
  }, []);

  /* ── Header CRUD ── */

  const handleAddHeader = async (name) => {
    try {
      const newHeader = await headersApi.create({ name });
      setHeaders((prev) => [...prev, { ...newHeader, tasks: [] }]);
      setHeaderModalState(null);
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleEditHeader = async (name) => {
    if (!headerModalState || headerModalState.mode !== "edit") return;
    try {
      const updated = await headersApi.update(headerModalState.headerId, {
        name,
      });
      setHeaders((prev) =>
        prev.map((h) =>
          h._id === headerModalState.headerId
            ? { ...h, name: updated.name }
            : h,
        ),
      );
      setHeaderModalState(null);
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleDeleteHeader = async () => {
    if (!deleteTarget || deleteTarget.type !== "header") return;
    try {
      const header = headers.find((h) => h._id === deleteTarget.id);
      const cascadedTaskIds = header ? header.tasks.map((t) => t._id) : [];
      await headersApi.remove(deleteTarget.id);
      setHeaders((prev) => prev.filter((h) => h._id !== deleteTarget.id));
      // Deleting "One Step At A Time" takes every daily habit task with it,
      // so the started goal steps move back to paused/pending too
      if (isOneStepHeaderName(deleteTarget.name)) {
        await pauseAllStartedSteps();
      }
      // Cascade-deleted tasks may back dated project tasks — unlink them
      await unlinkProjectTasksForTodoTasks(cascadedTaskIds);
      // …and may be this year's occurrence of a life event — unlink those too
      await unlinkLifeEventsForTodoTasks(cascadedTaskIds);
      setDeleteTarget(null);
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleMoveHeaderUp = async (headerId) => {
    const idx = headers.findIndex((h) => h._id === headerId);
    if (idx <= 0) return;
    const newPriority = headers[idx].priority - 1;
    try {
      await headersApi.update(headerId, { priority: newPriority });
      await loadAll();
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleMoveHeaderDown = async (headerId) => {
    const idx = headers.findIndex((h) => h._id === headerId);
    if (idx < 0 || idx >= headers.length - 1) return;
    const newPriority = headers[idx].priority + 1;
    try {
      await headersApi.update(headerId, { priority: newPriority });
      await loadAll();
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
    }
  };

  /* ── Task CRUD ── */

  const handleAddTask = async (draft) => {
    if (!addTaskHeaderId) return;
    try {
      await tasksApi.create({
        name: draft.name,
        headerId: addTaskHeaderId,
        notes: draft.notes,
        ecd: draft.ecd,
      });
      await reloadHeaderTasks(addTaskHeaderId);
      setAddTaskHeaderId(null);
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleToggleDone = (headerId) => async (taskId) => {
    const header = headers.find((h) => h._id === headerId);
    const task = header?.tasks.find((t) => t._id === taskId);
    if (!task) return;
    try {
      await tasksApi.update(taskId, { done: !task.done });
      await reloadHeaderTasks(headerId);
      // A task linked from a long-term project mirrors its done state there
      await syncProjectTasksForTodoDone(taskId, !task.done);
      // A task linked from a life event mirrors its done state there too
      await syncLifeEventsForTodoDone(taskId, !task.done);
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleEditTask = (headerId) => async (taskId, payload) => {
    try {
      await tasksApi.update(taskId, {
        name: payload.name,
        notes: payload.notes,
        ecd: payload.ecd,
        ...(payload.reason ? { reason: payload.reason } : {}),
      });
      await reloadHeaderTasks(headerId);
      // A task linked from a long-term project mirrors its name, date and
      // notes there (a cleared/recurring ECD clears the project date)
      await syncProjectTasksForTodoEdit(
        taskId,
        payload.name,
        payload.ecd,
        payload.notes,
      );
      // A task linked from a life event mirrors its name there (the annual
      // date is deliberately never synced from the todo task's ECD)
      await syncLifeEventsForTodoEdit(taskId, payload.name);
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleMoveTaskUp = (headerId) => async (taskId) => {
    const header = headers.find((h) => h._id === headerId);
    const task = header?.tasks.find((t) => t._id === taskId);
    if (!task) return;
    const newPriority = task.priority - 1;
    try {
      await tasksApi.update(taskId, { priority: newPriority });
      const fresh = await tasksApi.getAll(headerId);
      setHeaders((prev) =>
        prev.map((h) => (h._id === headerId ? { ...h, tasks: fresh } : h)),
      );
      // Tasks linked from a long-term project keep the project's order in step
      await syncProjectTaskOrderForTodo(fresh.map((t) => t._id));
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
      await reloadHeaderTasks(headerId);
    }
  };

  const handleMoveTaskDown = (headerId) => async (taskId) => {
    const header = headers.find((h) => h._id === headerId);
    const task = header?.tasks.find((t) => t._id === taskId);
    if (!task) return;
    const newPriority = task.priority + 1;
    try {
      await tasksApi.update(taskId, { priority: newPriority });
      const fresh = await tasksApi.getAll(headerId);
      setHeaders((prev) =>
        prev.map((h) => (h._id === headerId ? { ...h, tasks: fresh } : h)),
      );
      // Tasks linked from a long-term project keep the project's order in step
      await syncProjectTaskOrderForTodo(fresh.map((t) => t._id));
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
      await reloadHeaderTasks(headerId);
    }
  };

  const handleDeleteTask = (headerId) => (taskId) => {
    const header = headers.find((h) => h._id === headerId);
    const task = header?.tasks.find((t) => t._id === taskId);
    if (!task) return;
    setDeleteTarget({
      type: "task",
      headerId,
      id: taskId,
      name: task.name,
      done: task.done,
    });
  };

  const confirmDeleteTask = async (reason) => {
    if (!deleteTarget || deleteTarget.type !== "task") return;
    try {
      const header = headers.find((h) => h._id === deleteTarget.headerId);
      await tasksApi.remove(deleteTarget.id, reason);
      await reloadHeaderTasks(deleteTarget.headerId);
      // A daily habit task deleted from "One Step At A Time" pauses its step
      if (header && isOneStepHeaderName(header.name)) {
        await pauseStepsMatchingTask(deleteTarget.name);
      }
      // A task backing a dated project task unlinks it there
      await unlinkProjectTasksForTodoTasks([deleteTarget.id]);
      // A task backing a life event's yearly occurrence unlinks it there too
      await unlinkLifeEventsForTodoTasks([deleteTarget.id]);
      setDeleteTarget(null);
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
    }
  };


  /* ── Render ── */

  const addTaskHeader = headers.find((h) => h._id === addTaskHeaderId);

  // Daily habit tasks under "One Step At A Time" are linked to their goal
  // step by name — TaskCard locks name/schedule edits for them.
  const oneStepHeaderIds = new Set(
    headers.filter((h) => isOneStepHeaderName(h.name)).map((h) => h._id),
  );


  /* ── By Date view: group tasks by calendar date into present, past and
     future sections (today first, then old dates, then future ones) ── */
  const byDateSections = (() => {
    if (!byDateMode) return [];
    const groups = new Map();
    const noDate = [];
    headers.forEach((header) => {
      header.tasks.forEach((task) => {
        if (task.done) return; // drop done tasks before grouping by date
        const key = getEcdDateKey(task.ecd);
        if (!key) {
          if (!task.ecd) noDate.push({ task, headerPriority: header.priority });
          return; // recurring patterns have no single date; skip
        }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ task, headerPriority: header.priority });
      });
    });
    const sortTasks = (items) =>
      items
        .sort(
          (x, y) =>
            x.headerPriority - y.headerPriority ||
            x.task.priority - y.task.priority,
        )
        .map((item) => item.task);
    const dated = [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b)) // ascending date
      .map(([key, items]) => ({
        key,
        label: formatDateKey(key),
        tasks: sortTasks(items),
      }));
    const today = todayDateKey();
    const present = dated.filter((g) => g.key === today);
    const past = dated.filter((g) => g.key < today);
    const future = dated.filter((g) => g.key > today);
    if (noDate.length > 0) {
      // undated tasks always come last
      future.push({
        key: "__no_date__",
        label: "No date",
        tasks: sortTasks(noDate),
      });
    }
    return [
      { key: "present", groups: present },
      { key: "past", groups: past },
      { key: "future", groups: future },
    ].filter((section) => section.groups.length > 0);
  })();

  /* The one "+" in the title bar acts on whichever view is showing. Panels
     expose their add modal via addRef; Insights has nothing to add, so the
     button hides there. */
  const PANEL_ADD = {
    events: { label: "Add event", ref: eventsAddRef },
    lifeEvents: { label: "Add life event", ref: lifeEventsAddRef },
    goals: { label: "Add goal", ref: goalsAddRef },
    projects: { label: "Add project", ref: projectsAddRef },
    vacation: { label: "Add vacation", ref: vacationAddRef },
    onCall: { label: "Add on-call shift", ref: onCallAddRef },
  };
  const titleBarAdd = (() => {
    if (panel === "insights") return null;
    if (panel && PANEL_ADD[panel]) {
      const { label, ref } = PANEL_ADD[panel];
      return { label, onPress: () => ref.current?.openAdd() };
    }
    return {
      label: "Add header",
      onPress: () => setHeaderModalState({ mode: "add" }),
    };
  })();

  const dueTodayCount = headers.reduce(
    (n, h) => n + h.tasks.filter((t) => !t.done && isTaskDueToday(t.ecd)).length,
    0,
  );
  const subtitle = `${todayLine()}${
    !loading && !error ? ` · ${dueTodayCount} due today` : ""
  }`;

  if (loading || error) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Task At Hand" subtitle={todayLine()} />
        {loading ? (
          <View style={styles.padded}>
            <SkeletonList groups={3} rows={3} />
          </View>
        ) : (
          <ErrorState message={error} onRetry={loadAll} />
        )}
      </View>
    );
  }

  const renderTaskCard = (task, extra) => (
    <TaskCard
      key={task._id}
      task={task}
      goalManaged={oneStepHeaderIds.has(task.headerId)}
      streak={
        oneStepHeaderIds.has(task.headerId)
          ? streakFor(streaks, task.name)
          : undefined
      }
      onToggleDone={handleToggleDone(task.headerId)}
      onEdit={handleEditTask(task.headerId)}
      onMoveUp={handleMoveTaskUp(task.headerId)}
      onMoveDown={handleMoveTaskDown(task.headerId)}
      onDelete={handleDeleteTask(task.headerId)}
      {...extra}
    />
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Task At Hand"
        subtitle={subtitle}
        right={
          titleBarAdd ? (
            <AddButton label={titleBarAdd.label} onPress={titleBarAdd.onPress} />
          ) : null
        }
      >
        {/* View chips — one swipeable row instead of a wrapping grid */}
        <ScrollView
          ref={chipScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
          accessibilityRole="tablist"
        >
          {PANELS.map((p) => {
            const id = p.key ?? "tasks";
            return (
              <View
                key={id}
                onLayout={(e) => {
                  chipX.current[id] = e.nativeEvent.layout.x;
                }}
              >
                <Chip
                  testID={`chip-${id}`}
                  label={p.label}
                  icon={p.icon}
                  selected={panel === p.key}
                  onPress={() => togglePanel(p.key)}
                />
              </View>
            );
          })}
        </ScrollView>
      </ScreenHeader>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomClearance }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {actionError && (
          <Banner tone="danger" icon="alert" onDismiss={() => setActionError(null)}>
            {`Action failed: ${actionError}`}
          </Banner>
        )}

        {/* Shown in every view *except* the Vacation one, which carries its
            own fuller banner: booking time off and forgetting is the failure
            mode this feature actually has, but two banners stacked on the same
            screen is just noise. */}
        {vacationStatus?.onVacation && vacationStatus.active && panel !== "vacation" && (
          <Banner
            tone="info"
            icon="sunny"
            testID="vacation-banner"
            onPress={() => {
              if (panel !== "vacation") togglePanel("vacation");
            }}
          >
            <BannerText>
              <Text style={styles.bannerStrong}>On vacation</Text> — day{" "}
              {vacationStatus.active.dayOfVacation} of{" "}
              {vacationStatus.active.totalDays}
              {vacationStatus.active.note
                ? ` · ${vacationStatus.active.note}`
                : ""}
              . Missed days aren't counted against you.
            </BannerText>
          </Banner>
        )}

        {/* On call right now — every view, including On-call. Red edge, dashed
            for a secondary shift. */}
        {currentShift && (
          <Banner
            tone="alert"
            icon="notifications"
            testID="oncall-banner"
            dashed={currentShift.type === "secondary"}
            disabled={panel === "onCall"}
            onPress={() => togglePanel("onCall")}
          >
            <BannerText>
              <Text style={[styles.bannerStrong, styles.onCallType]}>
                {currentShift.type === "primary" ? "Primary" : "Secondary"}
              </Text>{" "}
              on call · until{" "}
              {currentShift.end === "24:00" ? "midnight" : currentShift.end} ·{" "}
              {formatDuration(minutesLeft(currentShift, clock))} left
            </BannerText>
          </Banner>
        )}

        {panel === "insights" && <InsightsSection />}

        {panel === "events" && (
          <EventsSection
            onTasksAdded={loadAll}
            onViewTodo={() => setPanel(null)}
            addRef={eventsAddRef}
          />
        )}

        {panel === "lifeEvents" && (
          <LifeEventsSection onTasksChanged={loadAll} addRef={lifeEventsAddRef} />
        )}

        {panel === "goals" && (
          <GoalsSection onTasksChanged={loadAll} addRef={goalsAddRef} />
        )}

        {panel === "projects" && (
          <ProjectsSection onTasksChanged={loadAll} addRef={projectsAddRef} />
        )}

        {panel === "vacation" && (
          <VacationSection
            addRef={vacationAddRef}
            onStatusChanged={setVacationStatus}
            onTasksChanged={async () => {
              await loadAll();
              await refreshVacations();
            }}
          />
        )}

        {panel === "onCall" && (
          <OnCallSection addRef={onCallAddRef} onShiftsChanged={refreshOnCall} />
        )}

        {panel === null && (
          <SegmentedControl
            testID="list-mode"
            style={styles.segmented}
            value={byDateMode ? "date" : "lists"}
            onChange={(v) => setByDateMode(v === "date")}
            options={[
              { value: "lists", label: "Lists", icon: "list-outline" },
              { value: "date", label: "By date", icon: "calendar-outline" },
            ]}
          />
        )}

        {/* Headers */}
        {panel === null &&
          !byDateMode &&
          headers.map((header, idx) => {
            const visibleTasks = header.tasks;
            const openCount = visibleTasks.filter((t) => !t.done).length;

            return (
              <Card key={header._id} padded={false} style={styles.section}>
                <View style={styles.headerRow}>
                  <Text style={styles.headerName} numberOfLines={2} accessibilityRole="header">
                    {header.name}
                  </Text>
                  <CountPill count={openCount} />
                  <IconButton
                    icon="add"
                    label={`Add task to ${header.name}`}
                    color={colors.primary}
                    onPress={() => setAddTaskHeaderId(header._id)}
                  />
                  <IconButton
                    icon="ellipsis-horizontal"
                    label={`More actions for ${header.name}`}
                    onPress={() => setHeaderMenu({ header, idx })}
                  />
                </View>

                {visibleTasks.map((task, taskIdx) =>
                  renderTaskCard(task, {
                    goalManaged: oneStepHeaderIds.has(header._id),
                    streak: oneStepHeaderIds.has(header._id)
                      ? streakFor(streaks, task.name)
                      : undefined,
                    isFirst: taskIdx === 0,
                    isLast: taskIdx === visibleTasks.length - 1,
                    prevTaskDone: taskIdx > 0 ? visibleTasks[taskIdx - 1].done : undefined,
                    nextTaskDone:
                      taskIdx < visibleTasks.length - 1
                        ? visibleTasks[taskIdx + 1].done
                        : undefined,
                    onToggleDone: handleToggleDone(header._id),
                    onEdit: handleEditTask(header._id),
                    onMoveUp: handleMoveTaskUp(header._id),
                    onMoveDown: handleMoveTaskDown(header._id),
                    onDelete: handleDeleteTask(header._id),
                  }),
                )}
                {visibleTasks.length === 0 && (
                  <Text style={styles.emptyText}>No tasks yet — add one!</Text>
                )}
              </Card>
            );
          })}

        {panel === null && !byDateMode && headers.length === 0 && (
          <EmptyState
            compact
            icon="file-tray-outline"
            title="No headers yet — add one!"
            message="Headers group related tasks, like Work or Home."
            actionLabel="Add header"
            onAction={() => setHeaderModalState({ mode: "add" })}
          />
        )}

        {/* By Date view: present, past and future sections headed by date,
            separated by labelled dividers */}
        {panel === null &&
          byDateMode &&
          byDateSections.map((section) => (
            <React.Fragment key={section.key}>
              <View style={styles.byDateDivider}>
                <Text
                  style={[
                    styles.byDateDividerText,
                    section.key === "past" && { color: colors.dangerText },
                    section.key === "present" && { color: colors.primaryText },
                  ]}
                >
                  {BY_DATE_SECTION_LABELS[section.key]}
                </Text>
                <View style={styles.byDateDividerLine} />
              </View>
              {section.groups.map((group) => (
                <Card key={group.key} padded={false} style={styles.section}>
                  <View style={styles.headerRow}>
                    <Text style={styles.headerName} numberOfLines={1}>
                      {group.label}
                    </Text>
                    <CountPill count={group.tasks.length} style={styles.groupCount} />
                  </View>
                  {group.tasks.map((task) =>
                    renderTaskCard(task, { isFirst: true, isLast: true }),
                  )}
                </Card>
              ))}
            </React.Fragment>
          ))}
        {panel === null && byDateMode && byDateSections.length === 0 && (
          <EmptyState compact icon="calendar-outline" title="No dated tasks to show." />
        )}
      </ScrollView>

      {/* Header "⋯" menu — rename, reorder, delete */}
      <ActionSheet
        visible={!!headerMenu}
        title={headerMenu?.header.name}
        subtitle="Header"
        onClose={() => setHeaderMenu(null)}
        actions={
          headerMenu
            ? [
                {
                  key: "rename",
                  label: "Rename header",
                  icon: "pencil",
                  onPress: () =>
                    setHeaderModalState({
                      mode: "edit",
                      headerId: headerMenu.header._id,
                      name: headerMenu.header.name,
                    }),
                },
                {
                  key: "up",
                  label: "Move up",
                  icon: "arrow-up",
                  disabled: headerMenu.idx === 0,
                  onPress: () => handleMoveHeaderUp(headerMenu.header._id),
                },
                {
                  key: "down",
                  label: "Move down",
                  icon: "arrow-down",
                  disabled: headerMenu.idx === headers.length - 1,
                  onPress: () => handleMoveHeaderDown(headerMenu.header._id),
                },
                {
                  key: "delete",
                  label: "Delete header",
                  icon: "trash-outline",
                  destructive: true,
                  hint: "Deletes all of its tasks too",
                  onPress: () =>
                    setDeleteTarget({
                      type: "header",
                      headerId: headerMenu.header._id,
                      id: headerMenu.header._id,
                      name: headerMenu.header.name,
                    }),
                },
              ]
            : []
        }
      />

      {/* Modals */}
      <ConfirmModal
        visible={!!deleteTarget}
        title={deleteTarget?.type === "header" ? "Delete header?" : "Delete task?"}
        message={
          deleteTarget?.type === "header"
            ? `Delete header "${deleteTarget?.name}" and all its tasks?`
            : `Delete task "${deleteTarget?.name}"?`
        }
        requireReason={
          deleteTarget?.type === "task" && deleteTarget?.done === false
        }
        onConfirm={
          deleteTarget?.type === "header"
            ? handleDeleteHeader
            : confirmDeleteTask
        }
        onCancel={() => setDeleteTarget(null)}
      />

      <AddTaskModal
        visible={!!addTaskHeaderId}
        headerName={addTaskHeader?.name || ""}
        onConfirm={handleAddTask}
        onCancel={() => setAddTaskHeaderId(null)}
      />

      <HeaderModal
        visible={!!headerModalState}
        headerName={
          headerModalState?.mode === "edit" ? headerModalState.name : undefined
        }
        onConfirm={
          headerModalState?.mode === "add" ? handleAddHeader : handleEditHeader
        }
        onCancel={() => setHeaderModalState(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  padded: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  chipScroll: {
    marginHorizontal: -spacing.xl,
    marginTop: spacing.md,
  },
  chipRow: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  segmented: {
    marginBottom: spacing.md,
  },
  bannerStrong: {
    fontWeight: "700",
  },
  onCallType: {
    color: colors.dangerText,
  },
  byDateDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  byDateDividerText: {
    ...type.overline,
    color: colors.textSecondary,
  },
  byDateDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  section: {
    marginBottom: spacing.md,
    overflow: "hidden",
    borderRadius: radii.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    minHeight: 52,
  },
  headerName: {
    ...type.headline,
    flex: 1,
  },
  groupCount: {
    marginRight: spacing.md,
  },
  emptyText: {
    ...type.subhead,
    color: colors.textTertiary,
    textAlign: "center",
    paddingVertical: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
});
