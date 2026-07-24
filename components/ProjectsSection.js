import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as projectsApi from "../api/projects";
import * as headersApi from "../api/headers";
import * as tasksApi from "../api/tasks";
import ProjectModal from "./ProjectModal";
import ProjectTaskModal from "./ProjectTaskModal";
import ConfirmModal from "./ConfirmModal";

/** `MM/DD` like the todo's date display; adds `/YY` when not the current year. */
function formatTaskDate(date) {
  const [y, m, d] = date.split("-").map(Number);
  const label = `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
  return y === new Date().getFullYear()
    ? label
    : `${label}/${String(y % 100).padStart(2, "0")}`;
}

export default function ProjectsSection({ onTasksChanged }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Modal states
  const [projectModalState, setProjectModalState] = useState(null);
  const [taskModalState, setTaskModalState] = useState(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState(null);

  const loadProjects = useCallback(async () => {
    try {
      const all = await projectsApi.getAll();
      setProjects(all);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  /* ── Todo link helpers ──
   * A project task with a date lives in the todo as a one-time date task
   * under a header named after the project (reused case-insensitively when
   * one exists, created otherwise — same find-or-create pattern as event
   * scheduling and goal steps). */

  const findProjectHeader = async (projectName) => {
    const all = await headersApi.getAll();
    return all.find(
      (h) => h.name.trim().toLowerCase() === projectName.trim().toLowerCase(),
    );
  };

  /** Create the linked todo task for a dated project task; returns its _id. */
  const createTodoTask = async (projectName, taskName, date) => {
    const header =
      (await findProjectHeader(projectName)) ||
      (await headersApi.create({ name: projectName }));
    const created = await tasksApi.create({
      name: taskName,
      headerId: header._id,
      notes: `Step towards "${projectName}"`,
      ecd: { type: "date", value: date },
    });
    return created._id;
  };

  /* ── Project CRUD ── */

  const handleSaveProject = async (name) => {
    if (!projectModalState) return;
    try {
      if (projectModalState.mode === "add") {
        await projectsApi.create({ name });
      } else {
        const project = projectModalState.project;
        await projectsApi.update(project._id, { name });
        // Keep the todo header in sync with the project name
        if (name.trim().toLowerCase() !== project.name.trim().toLowerCase()) {
          const header = await findProjectHeader(project.name);
          if (header) {
            await headersApi.update(header._id, { name });
            onTasksChanged();
          }
        }
      }
      await loadProjects();
      setProjectModalState(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteProjectTarget) return;
    try {
      await projectsApi.remove(deleteProjectTarget._id);
      await loadProjects();
      setDeleteProjectTarget(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMoveProject = async (project, delta) => {
    try {
      await projectsApi.update(project._id, {
        priority: project.priority + delta,
      });
      await loadProjects();
      setError(null);
    } catch (err) {
      setError(err.message);
      await loadProjects();
    }
  };

  /* ── Task CRUD ── */

  const replaceTasks = async (project, tasks) => {
    await projectsApi.update(project._id, { tasks });
    await loadProjects();
  };

  const handleSaveTask = async (draft) => {
    if (!taskModalState) return;
    const { project, taskIndex } = taskModalState;
    setBusy(true);
    try {
      let todoTouched = false;

      if (taskIndex === undefined) {
        // Add: a dated task is mirrored into the todo immediately
        let todoTaskId = null;
        if (draft.date) {
          todoTaskId = await createTodoTask(
            project.name,
            draft.name,
            draft.date,
          );
          todoTouched = true;
        }
        await replaceTasks(project, [
          ...project.tasks,
          { name: draft.name, date: draft.date, done: false, todoTaskId },
        ]);
      } else {
        // Edit: keep the linked todo task in step with name/date changes
        const current = project.tasks[taskIndex];
        let todoTaskId = current.todoTaskId;
        if (draft.date) {
          if (todoTaskId) {
            if (current.name !== draft.name || current.date !== draft.date) {
              await tasksApi.update(todoTaskId, {
                name: draft.name,
                ecd: { type: "date", value: draft.date },
              });
              todoTouched = true;
            }
          } else if (!current.done) {
            todoTaskId = await createTodoTask(
              project.name,
              draft.name,
              draft.date,
            );
            todoTouched = true;
          }
        } else if (todoTaskId) {
          // Date removed — the todo task no longer belongs there
          await tasksApi.remove(todoTaskId, "Removed from long term project");
          todoTaskId = null;
          todoTouched = true;
        }
        await replaceTasks(
          project,
          project.tasks.map((t, i) =>
            i === taskIndex
              ? { ...t, name: draft.name, date: draft.date, todoTaskId }
              : t,
          ),
        );
      }

      setTaskModalState(null);
      setError(null);
      if (todoTouched) onTasksChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleTaskDone = async (project, taskIndex) => {
    const task = project.tasks[taskIndex];
    const done = !task.done;
    setBusy(true);
    try {
      let todoTaskId = task.todoTaskId;
      let todoTouched = false;
      if (todoTaskId) {
        try {
          await tasksApi.update(todoTaskId, { done });
          todoTouched = true;
        } catch {
          // Linked todo task is gone (deleted outside this panel) — drop the
          // stale link and carry on with the project-side toggle
          todoTaskId = null;
        }
      } else if (!done && task.date) {
        // Undoing after the cron consumed the link: the dated task returns
        // to the todo
        todoTaskId = await createTodoTask(project.name, task.name, task.date);
        todoTouched = true;
      }
      await replaceTasks(
        project,
        project.tasks.map((t, i) =>
          i === taskIndex ? { ...t, done, todoTaskId } : t,
        ),
      );
      setError(null);
      if (todoTouched) onTasksChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleMoveTask = async (project, taskIndex, delta) => {
    const target = taskIndex + delta;
    const tasks = [...project.tasks];
    [tasks[taskIndex], tasks[target]] = [tasks[target], tasks[taskIndex]];
    try {
      await replaceTasks(project, tasks);
      // Mirror the swap into the todo when both tasks live there: the moved
      // task takes the other's todo priority (the backend shifts the rest)
      const moved = project.tasks[taskIndex];
      const other = project.tasks[target];
      if (moved.todoTaskId && other.todoTaskId) {
        const header = await findProjectHeader(project.name);
        if (header) {
          const todoTasks = await tasksApi.getAll(header._id);
          const movedTodo = todoTasks.find((t) => t._id === moved.todoTaskId);
          const otherTodo = todoTasks.find((t) => t._id === other.todoTaskId);
          const orderMismatch =
            movedTodo &&
            otherTodo &&
            (delta === -1
              ? movedTodo.priority > otherTodo.priority
              : movedTodo.priority < otherTodo.priority);
          if (orderMismatch) {
            await tasksApi.update(movedTodo._id, {
              priority: otherTodo.priority,
            });
            onTasksChanged();
          }
        }
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const confirmDeleteTask = async () => {
    if (!deleteTaskTarget) return;
    const { project, taskIndex } = deleteTaskTarget;
    const task = project.tasks[taskIndex];
    setBusy(true);
    try {
      let todoTouched = false;
      if (task.todoTaskId) {
        try {
          await tasksApi.remove(
            task.todoTaskId,
            task.done ? undefined : "Removed from long term project",
          );
          todoTouched = true;
        } catch {
          // Already gone — nothing to clean up
        }
      }
      await replaceTasks(
        project,
        project.tasks.filter((_, i) => i !== taskIndex),
      );
      setDeleteTaskTarget(null);
      setError(null);
      if (todoTouched) onTasksChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  /* ── Render ── */

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#6200ee" />
        <Text style={styles.loadingText}>Loading projects…</Text>
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
        <TouchableOpacity
          style={styles.addProjectBtn}
          onPress={() => setProjectModalState({ mode: "add" })}
          activeOpacity={0.7}
        >
          <Text style={styles.addProjectText}>+ Add Project</Text>
        </TouchableOpacity>
      </View>

      {projects.map((project, idx) => {
        const doneCount = project.tasks.filter((t) => t.done).length;
        return (
          <View key={project._id} style={styles.section}>
            <View style={styles.headerRow}>
              <Text style={styles.headerName} numberOfLines={1}>
                {project.name}
              </Text>
              <View style={styles.headerActions}>
                {project.tasks.length > 0 && (
                  <Text style={styles.progressBadge}>
                    {doneCount}/{project.tasks.length} done
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.headerBtn, idx === 0 && styles.busyBtn]}
                  onPress={() => handleMoveProject(project, -1)}
                  disabled={idx === 0}
                >
                  <Ionicons name="arrow-up" size={16} color="#656d76" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.headerBtn,
                    idx === projects.length - 1 && styles.busyBtn,
                  ]}
                  onPress={() => handleMoveProject(project, 1)}
                  disabled={idx === projects.length - 1}
                >
                  <Ionicons name="arrow-down" size={16} color="#656d76" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={() => setProjectModalState({ mode: "edit", project })}
                >
                  <Ionicons name="pencil" size={16} color="#656d76" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={() => setDeleteProjectTarget(project)}
                >
                  <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={() => setTaskModalState({ project })}
                >
                  <Ionicons name="add" size={18} color="#656d76" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.taskList}>
              {project.tasks.map((task, taskIdx) => {
                const prev = project.tasks[taskIdx - 1];
                const next = project.tasks[taskIdx + 1];
                // Moves never cross the done/undone barrier (same as the todo)
                const canMoveUp = taskIdx > 0 && prev.done === task.done;
                const canMoveDown =
                  taskIdx < project.tasks.length - 1 &&
                  next.done === task.done;
                const isLast = taskIdx === project.tasks.length - 1;
                return (
                  <View
                    key={`${task.name}-${taskIdx}`}
                    style={[styles.taskRow, isLast && styles.taskRowLast]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.taskCheck,
                        task.done && styles.taskCheckDone,
                        busy && styles.busyBtn,
                      ]}
                      onPress={() => handleToggleTaskDone(project, taskIdx)}
                      disabled={busy}
                    >
                      {task.done && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.taskName,
                        task.done && styles.taskNameDone,
                      ]}
                      numberOfLines={2}
                    >
                      {task.name}
                    </Text>
                    {task.date && (
                      <Text
                        style={[
                          styles.taskDate,
                          task.done && styles.taskDateDone,
                        ]}
                      >
                        {formatTaskDate(task.date)}
                      </Text>
                    )}
                    <View style={styles.taskActions}>
                      <TouchableOpacity
                        style={[
                          styles.iconBtn,
                          (busy || !canMoveUp) && styles.busyBtn,
                        ]}
                        onPress={() => handleMoveTask(project, taskIdx, -1)}
                        disabled={busy || !canMoveUp}
                      >
                        <Ionicons name="arrow-up" size={14} color="#656d76" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.iconBtn,
                          (busy || !canMoveDown) && styles.busyBtn,
                        ]}
                        onPress={() => handleMoveTask(project, taskIdx, 1)}
                        disabled={busy || !canMoveDown}
                      >
                        <Ionicons name="arrow-down" size={14} color="#656d76" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconBtn, busy && styles.busyBtn]}
                        onPress={() =>
                          setTaskModalState({ project, taskIndex: taskIdx })
                        }
                        disabled={busy}
                      >
                        <Ionicons name="pencil" size={14} color="#656d76" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconBtn, busy && styles.busyBtn]}
                        onPress={() =>
                          setDeleteTaskTarget({ project, taskIndex: taskIdx })
                        }
                        disabled={busy}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={14}
                          color="#e74c3c"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              {project.tasks.length === 0 && (
                <Text style={styles.noTasksText}>
                  No tasks yet — add the steps that get this project done.
                </Text>
              )}
            </View>
          </View>
        );
      })}

      {projects.length === 0 && (
        <Text style={styles.emptyText}>
          No projects yet — add one! A long term project (e.g. "Automated
          Stock Market") lists the steps that get it done (e.g. "get data
          from EODHD"). Give a step a date and it shows up in the todo under
          the project's name; once it's done and the nightly cleanup runs, it
          leaves the todo but stays here as a completed step.
        </Text>
      )}

      {/* Modals */}
      <ProjectModal
        visible={!!projectModalState}
        projectName={
          projectModalState?.mode === "edit"
            ? projectModalState.project.name
            : undefined
        }
        onConfirm={handleSaveProject}
        onCancel={() => setProjectModalState(null)}
      />

      <ProjectTaskModal
        visible={!!taskModalState}
        projectName={taskModalState?.project.name ?? ""}
        task={
          taskModalState?.taskIndex !== undefined
            ? {
                name: taskModalState.project.tasks[taskModalState.taskIndex]
                  .name,
                date: taskModalState.project.tasks[taskModalState.taskIndex]
                  .date,
              }
            : undefined
        }
        onConfirm={handleSaveTask}
        onCancel={() => setTaskModalState(null)}
      />

      <ConfirmModal
        visible={!!deleteProjectTarget}
        message={`Delete project "${deleteProjectTarget?.name}"? Tasks already added to the todo stay.`}
        onConfirm={handleDeleteProject}
        onCancel={() => setDeleteProjectTarget(null)}
      />

      <ConfirmModal
        visible={!!deleteTaskTarget}
        message={
          deleteTaskTarget
            ? `Delete task "${deleteTaskTarget.project.tasks[deleteTaskTarget.taskIndex].name}" from "${deleteTaskTarget.project.name}"?${deleteTaskTarget.project.tasks[deleteTaskTarget.taskIndex].todoTaskId ? " Its todo entry is removed too." : ""}`
            : ""
        }
        onConfirm={confirmDeleteTask}
        onCancel={() => setDeleteTaskTarget(null)}
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
  addProjectBtn: {
    backgroundColor: "#6200ee",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addProjectText: {
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
  progressBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#656d76",
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginRight: 4,
    overflow: "hidden",
  },
  taskList: {
    paddingHorizontal: 14,
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
  taskCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d7de",
    justifyContent: "center",
    alignItems: "center",
  },
  taskCheckDone: {
    borderColor: "#1a7f37",
    backgroundColor: "#1a7f37",
  },
  taskName: {
    flex: 1,
    fontSize: 15,
    color: "#1f2328",
  },
  taskNameDone: {
    textDecorationLine: "line-through",
    color: "#656d76",
  },
  taskDate: {
    fontSize: 11,
    fontWeight: "600",
    color: "#656d76",
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  taskDateDone: {
    opacity: 0.6,
  },
  taskActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d0d7de",
    justifyContent: "center",
    alignItems: "center",
  },
  busyBtn: {
    opacity: 0.4,
  },
  noTasksText: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#656d76",
    paddingVertical: 10,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    color: "#656d76",
    paddingVertical: 24,
  },
});
