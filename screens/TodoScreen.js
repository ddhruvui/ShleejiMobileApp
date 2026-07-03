import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as headersApi from "../api/headers";
import * as tasksApi from "../api/tasks";
import TaskCard from "../components/TaskCard";
import ConfirmModal from "../components/ConfirmModal";
import AddTaskModal from "../components/AddTaskModal";
import HeaderModal from "../components/HeaderModal";
import InsightsSection from "../components/InsightsSection";
import {
  isTaskDueToday,
  isTaskPast,
  getEcdDateKey,
  formatDateKey,
} from "../utils/ecd";
import { syncDailyReminders } from "../utils/notifications";

export default function TodoScreen() {
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const [pastMode, setPastMode] = useState(false);
  const [byDateMode, setByDateMode] = useState(false);
  const [insightsMode, setInsightsMode] = useState(false);

  // Modal states
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addTaskHeaderId, setAddTaskHeaderId] = useState(null);
  const [headerModalState, setHeaderModalState] = useState(null);

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

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ── Keep the 8:30 AM / 4:00 PM daily reminders in sync with task data ── */
  useEffect(() => {
    if (loading || headers.length === 0) return;
    syncDailyReminders(headers);
  }, [loading, headers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

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
      await headersApi.remove(deleteTarget.id);
      setHeaders((prev) => prev.filter((h) => h._id !== deleteTarget.id));
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
      });
      await reloadHeaderTasks(headerId);
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
      await reloadHeaderTasks(headerId);
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
      await reloadHeaderTasks(headerId);
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
    });
  };

  const confirmDeleteTask = async () => {
    if (!deleteTarget || deleteTarget.type !== "task") return;
    try {
      await tasksApi.remove(deleteTarget.id);
      await reloadHeaderTasks(deleteTarget.headerId);
      setDeleteTarget(null);
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
    }
  };

  /* ── Render ── */

  const addTaskHeader = headers.find((h) => h._id === addTaskHeaderId);

  /* ── Shared Focus/Past filter (applies in both views) ── */
  const matchesFilter = (task) => {
    if (focusMode && pastMode)
      return isTaskDueToday(task.ecd) || isTaskPast(task.ecd);
    if (focusMode) return isTaskDueToday(task.ecd);
    if (pastMode) return isTaskPast(task.ecd);
    return true;
  };

  /* ── By Date view: group filtered tasks by their calendar date ── */
  const byDateGroups = (() => {
    if (!byDateMode) return [];
    const groups = new Map();
    const noDate = [];
    headers.forEach((header) => {
      header.tasks.forEach((task) => {
        if (task.done) return; // drop done tasks before grouping by date
        if (!matchesFilter(task)) return;
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
    if (noDate.length > 0) {
      // undated tasks always come last
      dated.push({
        key: "__no_date__",
        label: "No date",
        tasks: sortTasks(noDate),
      });
    }
    return dated;
  })();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#e74c3c" />
          <Text style={styles.errorTextLarge}>Failed to load: {error}</Text>
          <Text style={styles.errorHint}>Is the backend running?</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadAll}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Title bar - Fixed Header */}
      <View style={styles.titleBar}>
        <Text style={styles.title}>Task At Hand</Text>
        <TouchableOpacity
          style={styles.addHeaderBtn}
          onPress={() => setHeaderModalState({ mode: "add" })}
          activeOpacity={0.7}
        >
          <Text style={styles.addHeaderText}>+ Add Header</Text>
        </TouchableOpacity>
      </View>

      {/* Filter navbar */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            focusMode && styles.toggleBtnActive,
          ]}
          onPress={() => setFocusMode((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="radio-button-on-outline"
            size={16}
            color={focusMode ? "#1e88e5" : "#656d76"}
          />
          <Text
            style={[
              styles.toggleText,
              focusMode && styles.toggleTextActive,
            ]}
          >
            Focus
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            pastMode && styles.toggleBtnActive,
          ]}
          onPress={() => setPastMode((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={pastMode ? "#1e88e5" : "#656d76"}
          />
          <Text
            style={[
              styles.toggleText,
              pastMode && styles.toggleTextActive,
            ]}
          >
            Past
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            byDateMode && styles.toggleBtnActive,
          ]}
          onPress={() => setByDateMode((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={byDateMode ? "#1e88e5" : "#656d76"}
          />
          <Text
            style={[
              styles.toggleText,
              byDateMode && styles.toggleTextActive,
            ]}
          >
            By Date
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            insightsMode && styles.toggleBtnActive,
          ]}
          onPress={() => setInsightsMode((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="analytics-outline"
            size={16}
            color={insightsMode ? "#1e88e5" : "#656d76"}
          />
          <Text
            style={[
              styles.toggleText,
              insightsMode && styles.toggleTextActive,
            ]}
          >
            Insights
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
      >
        {actionError && (
          <View style={styles.actionErrorBar}>
            <Text style={styles.actionErrorText}>
              Action failed: {actionError}
            </Text>
            <TouchableOpacity onPress={() => setActionError(null)}>
              <Ionicons name="close" size={18} color="#e74c3c" />
            </TouchableOpacity>
          </View>
        )}

        {/* Insights view */}
        {insightsMode && <InsightsSection />}

        {/* Headers */}
        {!insightsMode &&
          !byDateMode &&
          headers.map((header, idx) => {
            const visibleTasks = header.tasks.filter(matchesFilter);

            if ((focusMode || pastMode) && visibleTasks.length === 0)
              return null;

            return (
            <View key={header._id} style={styles.section}>
              {/* Header heading */}
              <View style={styles.headerRow}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {header.name}
                </Text>
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={[
                      styles.headerBtn,
                      idx === 0 && styles.headerBtnDisabled,
                    ]}
                    onPress={() => handleMoveHeaderUp(header._id)}
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
                      styles.headerBtn,
                      idx === headers.length - 1 && styles.headerBtnDisabled,
                    ]}
                    onPress={() => handleMoveHeaderDown(header._id)}
                    disabled={idx === headers.length - 1}
                  >
                    <Ionicons
                      name="arrow-down"
                      size={16}
                      color={idx === headers.length - 1 ? "#ccc" : "#656d76"}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() =>
                      setHeaderModalState({
                        mode: "edit",
                        headerId: header._id,
                        name: header.name,
                      })
                    }
                  >
                    <Ionicons name="pencil" size={16} color="#656d76" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() =>
                      setDeleteTarget({
                        type: "header",
                        headerId: header._id,
                        id: header._id,
                        name: header.name,
                      })
                    }
                  >
                    <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={() => setAddTaskHeaderId(header._id)}
                  >
                    <Ionicons name="add" size={18} color="#6200ee" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Task list */}
              <View style={styles.taskList}>
                {visibleTasks.map((task, taskIdx) => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    isFirst={taskIdx === 0}
                    isLast={taskIdx === visibleTasks.length - 1}
                    prevTaskDone={
                      taskIdx > 0 ? visibleTasks[taskIdx - 1].done : undefined
                    }
                    nextTaskDone={
                      taskIdx < visibleTasks.length - 1
                        ? visibleTasks[taskIdx + 1].done
                        : undefined
                    }
                    onToggleDone={handleToggleDone(header._id)}
                    onEdit={handleEditTask(header._id)}
                    onMoveUp={handleMoveTaskUp(header._id)}
                    onMoveDown={handleMoveTaskDown(header._id)}
                    onDelete={handleDeleteTask(header._id)}
                  />
                ))}
                {visibleTasks.length === 0 && (
                  <Text style={styles.emptyText}>No tasks yet — add one!</Text>
                )}
              </View>
            </View>
          );
        })}

        {!insightsMode && !byDateMode && headers.length === 0 && (
          <Text style={styles.emptyText}>No headers yet — add one!</Text>
        )}
        {!insightsMode &&
          !byDateMode &&
          focusMode &&
          pastMode &&
          headers.length > 0 &&
          headers.every(
            (h) =>
              !h.tasks.some((t) => isTaskDueToday(t.ecd) || isTaskPast(t.ecd)),
          ) && (
            <Text style={styles.emptyText}>No tasks due today or in the past.</Text>
          )}
        {!insightsMode &&
          !byDateMode &&
          focusMode &&
          !pastMode &&
          headers.length > 0 &&
          headers.every((h) => !h.tasks.some((t) => isTaskDueToday(t.ecd))) && (
            <Text style={styles.emptyText}>No tasks due today.</Text>
          )}
        {!insightsMode &&
          !byDateMode &&
          !focusMode &&
          pastMode &&
          headers.length > 0 &&
          headers.every((h) => !h.tasks.some((t) => isTaskPast(t.ecd))) && (
            <Text style={styles.emptyText}>No past tasks.</Text>
          )}

        {/* By Date view: sections headed by date */}
        {!insightsMode &&
          byDateMode &&
          byDateGroups.map((group) => (
            <View key={group.key} style={styles.section}>
              <View style={styles.headerRow}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {group.label}
                </Text>
              </View>
              <View style={styles.taskList}>
                {group.tasks.map((task) => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    isFirst
                    isLast
                    onToggleDone={handleToggleDone(task.headerId)}
                    onEdit={handleEditTask(task.headerId)}
                    onMoveUp={handleMoveTaskUp(task.headerId)}
                    onMoveDown={handleMoveTaskDown(task.headerId)}
                    onDelete={handleDeleteTask(task.headerId)}
                  />
                ))}
              </View>
            </View>
          ))}
        {!insightsMode && byDateMode && byDateGroups.length === 0 && (
          <Text style={styles.emptyText}>
            No dated tasks to show
            {focusMode || pastMode ? " for this filter" : ""}.
          </Text>
        )}

        {/* Bottom spacer for tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Modals */}
      <ConfirmModal
        visible={!!deleteTarget}
        message={
          deleteTarget?.type === "header"
            ? `Delete header "${deleteTarget?.name}" and all its tasks?`
            : `Delete task "${deleteTarget?.name}"?`
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#656d76",
  },
  errorTextLarge: {
    marginTop: 12,
    fontSize: 16,
    color: "#e74c3c",
    textAlign: "center",
  },
  errorHint: {
    marginTop: 4,
    fontSize: 14,
    color: "#656d76",
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: "#6200ee",
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 12,
  },
  titleBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 28,
    backgroundColor: "#1e88e5",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
  },
  filterBar: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f6f8fa",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d0d7de",
  },
  toggleBtnActive: {
    backgroundColor: "#e3f2fd",
    borderColor: "#1e88e5",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#656d76",
  },
  toggleTextActive: {
    color: "#1e88e5",
  },
  addHeaderBtn: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addHeaderText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e88e5",
  },
  actionErrorBar: {
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
  actionErrorText: {
    fontSize: 13,
    color: "#e74c3c",
    flex: 1,
    marginRight: 8,
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
    gap: 2,
  },
  headerBtn: {
    padding: 6,
    borderRadius: 6,
  },
  headerBtnDisabled: {
    opacity: 0.4,
  },
  taskList: {
    paddingHorizontal: 6,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    color: "#656d76",
    paddingVertical: 24,
  },
});
