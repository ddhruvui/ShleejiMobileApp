import React, { useState, useEffect, useCallback, useRef } from "react";
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
import AddButton from "./AddButton";
import ProjectModal from "./ProjectModal";
import ProjectTaskModal from "./ProjectTaskModal";
import ConfirmModal from "./ConfirmModal";

/**
 * Whether two tasks sit in the same movable group. The server sorts a
 * project's tasks into dated-undone, undated-undone and done, so a swap
 * across those lines would be reverted on the next write.
 */
function sameMoveGroup(a, b) {
  return a.done === b.done && (a.done || !!a.date === !!b.date);
}

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
  // Synchronous re-entrancy guard for the task save flow: `busy` (state) only
  // disables the modal button after a re-render, which leaves a window where a
  // fast second tap re-enters handleSaveTask and creates a duplicate linked
  // todo task. A ref flips before the first await, so the re-entry is dropped.
  const savingTaskRef = useRef(false);

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
   * under the project's own header. The header is identified by `projectId`;
   * creating it is the backend's job (see createTodoTask), including where it
   * sits in the header list. */

  const findProjectHeader = async (project) => {
    const all = await headersApi.getAll();
    return (
      all.find((h) => h.projectId === project._id) ||
      // Header created before projectId existed — matched by name until the
      // server adopts it on the next project header create/cron run.
      all.find(
        (h) =>
          h.projectId == null &&
          h.name.trim().toLowerCase() === project.name.trim().toLowerCase(),
      )
    );
  };

  /**
   * The note the linked todo task carries: the project task's own notes when
   * it has any, else the "Step towards …" default that flags the origin.
   */
  const todoNoteFor = (projectName, notes) =>
    notes && notes.trim() ? notes : `Step towards "${projectName}"`;

  /**
   * Create the linked todo task for a dated project task; returns its _id.
   *
   * The header comes straight from `POST /headers { name, projectId }`: that
   * call is idempotent per project (it returns the existing header, adopting
   * a legacy name-matched one if needed) and the server places it in the
   * projects' priority order, so there is nothing to find-or-create or
   * re-order here.
   */
  const createTodoTask = async (project, taskName, date, notes) => {
    const header = await headersApi.create({
      name: project.name,
      projectId: project._id,
    });
    const created = await tasksApi.create({
      name: taskName,
      headerId: header._id,
      notes: todoNoteFor(project.name, notes),
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
        // The server renames the linked todo header as part of the update;
        // just reload the todo so it shows the new name.
        if (name.trim().toLowerCase() !== project.name.trim().toLowerCase()) {
          onTasksChanged();
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
      // The server unlinked the project's header and closed the block, so the
      // todo's header order changed even though no task did.
      onTasksChanged();
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
      onTasksChanged();
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
    if (!taskModalState || savingTaskRef.current) return;
    savingTaskRef.current = true;
    const { project, taskIndex } = taskModalState;
    setBusy(true);
    try {
      let todoTouched = false;

      if (taskIndex === undefined) {
        // Add: a dated task is mirrored into the todo immediately
        let todoTaskId = null;
        if (draft.date) {
          todoTaskId = await createTodoTask(
            project,
            draft.name,
            draft.date,
            draft.notes,
          );
          todoTouched = true;
        }
        await replaceTasks(project, [
          ...project.tasks,
          {
            name: draft.name,
            notes: draft.notes,
            date: draft.date,
            done: false,
            todoTaskId,
          },
        ]);
      } else {
        // Edit: keep the linked todo task in step with name/date/notes changes
        const current = project.tasks[taskIndex];
        let todoTaskId = current.todoTaskId;
        if (draft.date) {
          if (todoTaskId) {
            if (
              current.name !== draft.name ||
              current.date !== draft.date ||
              current.notes !== draft.notes
            ) {
              await tasksApi.update(todoTaskId, {
                name: draft.name,
                notes: todoNoteFor(project.name, draft.notes),
                ecd: { type: "date", value: draft.date },
              });
              todoTouched = true;
            }
          } else if (!current.done) {
            todoTaskId = await createTodoTask(
              project,
              draft.name,
              draft.date,
              draft.notes,
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
              ? {
                  ...t,
                  name: draft.name,
                  notes: draft.notes,
                  date: draft.date,
                  todoTaskId,
                }
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
      savingTaskRef.current = false;
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
        todoTaskId = await createTodoTask(
          project,
          task.name,
          task.date,
          task.notes,
        );
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
        const header = await findProjectHeader(project);
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
        <AddButton
          label="Add Project"
          onPress={() => setProjectModalState({ mode: "add" })}
        />
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
                // nor the dated/undated one the server enforces among undone
                // tasks, so the panel can't offer a swap the server undoes.
                const canMoveUp = taskIdx > 0 && sameMoveGroup(prev, task);
                const canMoveDown =
                  taskIdx < project.tasks.length - 1 &&
                  sameMoveGroup(next, task);
                const isLast = taskIdx === project.tasks.length - 1;
                return (
                  <View
                    key={`${task.name}-${taskIdx}`}
                    style={[
                      styles.taskRow,
                      task.done && styles.taskRowDone,
                      isLast && styles.taskRowLast,
                    ]}
                  >
                    {/* Same square checkbox as the todo's TaskCard */}
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
                    <View style={styles.taskMain}>
                      <View style={styles.taskLabelRow}>
                        <Text
                          style={[
                            styles.taskName,
                            task.done && styles.taskNameDone,
                          ]}
                          numberOfLines={2}
                        >
                          {task.name}
                        </Text>
                        {/* Same slot the todo uses for the ECD badge */}
                        <View style={styles.taskEcdBadge}>
                          <Text style={styles.taskEcdText}>
                            {task.date ? formatTaskDate(task.date) : "No date"}
                          </Text>
                        </View>
                      </View>
                      {!!task.notes && (
                        <Text style={styles.taskNotes} numberOfLines={1}>
                          → {task.notes}
                        </Text>
                      )}
                    </View>
                    <View style={styles.taskActions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, busy && styles.busyBtn]}
                        onPress={() =>
                          setTaskModalState({ project, taskIndex: taskIdx })
                        }
                        disabled={busy}
                      >
                        <Ionicons name="pencil" size={16} color="#656d76" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          (busy || !canMoveUp) && styles.busyBtn,
                        ]}
                        onPress={() => handleMoveTask(project, taskIdx, -1)}
                        disabled={busy || !canMoveUp}
                      >
                        <Ionicons
                          name="arrow-up"
                          size={16}
                          color={!busy && canMoveUp ? "#656d76" : "#ccc"}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          (busy || !canMoveDown) && styles.busyBtn,
                        ]}
                        onPress={() => handleMoveTask(project, taskIdx, 1)}
                        disabled={busy || !canMoveDown}
                      >
                        <Ionicons
                          name="arrow-down"
                          size={16}
                          color={!busy && canMoveDown ? "#656d76" : "#ccc"}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, busy && styles.busyBtn]}
                        onPress={() =>
                          setDeleteTaskTarget({ project, taskIndex: taskIdx })
                        }
                        disabled={busy}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
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
        busy={busy}
        projectName={taskModalState?.project.name ?? ""}
        task={
          taskModalState?.taskIndex !== undefined
            ? {
                name: taskModalState.project.tasks[taskModalState.taskIndex]
                  .name,
                notes:
                  taskModalState.project.tasks[taskModalState.taskIndex].notes,
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
  /* Task rows mirror the todo's TaskCard styling (square checkbox, inline
     ECD badge, "→ notes" line, borderless action icons) so the two lists
     feel identical. */
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
  },
  taskRowDone: {
    opacity: 0.6,
  },
  taskRowLast: {
    borderBottomWidth: 0,
  },
  taskCheck: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d0d7de",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  taskCheckDone: {
    borderColor: "#6200ee",
    backgroundColor: "#6200ee",
  },
  taskMain: {
    flex: 1,
  },
  taskLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  taskName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1f2328",
  },
  taskNameDone: {
    textDecorationLine: "line-through",
    color: "#656d76",
  },
  taskEcdBadge: {
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  taskEcdText: {
    fontSize: 11,
    color: "#656d76",
    fontWeight: "500",
  },
  taskNotes: {
    fontSize: 13,
    color: "#656d76",
    marginTop: 3,
    fontStyle: "italic",
  },
  taskActions: {
    flexDirection: "row",
    gap: 2,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 6,
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
