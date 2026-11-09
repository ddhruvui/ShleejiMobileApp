import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useImperativeHandle,
} from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import * as projectsApi from "../api/projects";
import * as headersApi from "../api/headers";
import * as tasksApi from "../api/tasks";
import ProjectModal from "./ProjectModal";
import ProjectTaskModal from "./ProjectTaskModal";
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
  ProgressBar,
} from "./ui";
import { todayDateKey } from "../utils/ecd";
import { colors, radii, spacing, type } from "../theme";

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

/**
 * The date badge for a project task, toned like the todo's TaskCard: "Today"
 * in brand, overdue-and-not-done in red, any other date neutral. Undated
 * tasks keep their "No date" badge — dated vs undated is one of the move
 * barriers, so the row shows which side of it a task sits on. Date keys
 * compare as strings (YYYY-MM-DD), never through `new Date("YYYY-MM-DD")`.
 */
function dateBadge(task, today = todayDateKey()) {
  if (!task.date) return { label: "No date", tone: "neutral" };
  if (task.date === today) {
    return { label: "Today", tone: "primary", icon: "calendar" };
  }
  if (task.date < today && !task.done) {
    return {
      label: `Overdue · ${formatTaskDate(task.date)}`,
      tone: "danger",
      icon: "alert-circle",
    };
  }
  return {
    label: formatTaskDate(task.date),
    tone: "neutral",
    icon: "calendar-outline",
  };
}

export default function ProjectsSection({ onTasksChanged, addRef }) {
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

  // This panel has no toolbar of its own: TodoScreen's title-bar "+" opens the
  // add-project modal through this handle while the Projects view is showing.
  useImperativeHandle(addRef, () => ({
    openAdd: () => setProjectModalState({ mode: "add" }),
  }));

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
    return <LoadingState label="Loading projects…" style={styles.loading} />;
  }

  return (
    <View>
      {error && (
        <Banner
          tone="danger"
          icon="alert-circle"
          onDismiss={() => setError(null)}
        >
          {`Action failed: ${error}`}
        </Banner>
      )}

      {projects.map((project, idx) => (
        <ProjectCard
          key={project._id}
          project={project}
          canMoveUp={idx !== 0}
          canMoveDown={idx !== projects.length - 1}
          onAddTask={() => setTaskModalState({ project })}
          onRename={() => setProjectModalState({ mode: "edit", project })}
          onMoveUp={() => handleMoveProject(project, -1)}
          onMoveDown={() => handleMoveProject(project, 1)}
          onDelete={() => setDeleteProjectTarget(project)}
        >
          {project.tasks.map((task, taskIdx) => {
            const prev = project.tasks[taskIdx - 1];
            const next = project.tasks[taskIdx + 1];
            // Moves never cross the done/undone barrier (same as the todo)
            // nor the dated/undated one the server enforces among undone
            // tasks, so the panel can't offer a swap the server undoes.
            const canMoveUp = taskIdx > 0 && sameMoveGroup(prev, task);
            const canMoveDown =
              taskIdx < project.tasks.length - 1 && sameMoveGroup(next, task);
            return (
              <ProjectTaskRow
                key={`${task.name}-${taskIdx}`}
                task={task}
                busy={busy}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onToggleDone={() => handleToggleTaskDone(project, taskIdx)}
                onEdit={() => setTaskModalState({ project, taskIndex: taskIdx })}
                onMoveUp={() => handleMoveTask(project, taskIdx, -1)}
                onMoveDown={() => handleMoveTask(project, taskIdx, 1)}
                onDelete={() =>
                  setDeleteTaskTarget({ project, taskIndex: taskIdx })
                }
              />
            );
          })}
          {project.tasks.length === 0 && (
            <Text style={styles.noTasksText}>
              No tasks yet — add the steps that get this project done.
            </Text>
          )}
        </ProjectCard>
      ))}

      {projects.length === 0 && (
        <EmptyState
          compact
          icon="briefcase-outline"
          title="No projects yet — add one!"
          message={
            'A long term project (e.g. "Automated Stock Market") lists the ' +
            'steps that get it done (e.g. "get data from EODHD"). Give a step ' +
            "a date and it shows up in the todo under the project's name; " +
            "once it's done and the nightly cleanup runs, it leaves the todo " +
            "but stays here as a completed step."
          }
        />
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

/**
 * One project as a card: the full name, a done/total meta line with a
 * progress bar, "+" to add a task and "⋯" for the rest (rename, move,
 * delete). Project moves are never gated on `busy` — same as before the
 * menu existed.
 */
function ProjectCard({
  project,
  canMoveUp,
  canMoveDown,
  onAddTask,
  onRename,
  onMoveUp,
  onMoveDown,
  onDelete,
  children,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const total = project.tasks.length;
  const doneCount = project.tasks.filter((t) => t.done).length;
  const progress = total > 0 ? `${doneCount}/${total} done` : null;

  const menuActions = [
    {
      key: "rename",
      label: "Rename project",
      icon: "pencil",
      onPress: onRename,
    },
    {
      key: "up",
      label: "Move up",
      icon: "arrow-up",
      disabled: !canMoveUp,
      onPress: onMoveUp,
    },
    {
      key: "down",
      label: "Move down",
      icon: "arrow-down",
      disabled: !canMoveDown,
      onPress: onMoveDown,
    },
    {
      key: "delete",
      label: "Delete project",
      icon: "trash-outline",
      destructive: true,
      onPress: onDelete,
    },
  ];

  return (
    <>
      <Card padded={false} style={styles.card} testID={`project-${project._id}`}>
        {/* Clips row press highlights to the card's corners without putting
            overflow:hidden on the Card itself, which would clip its shadow. */}
        <View style={styles.cardClip}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text
                style={styles.projectName}
                numberOfLines={2}
                accessibilityRole="header"
              >
                {project.name}
              </Text>
              {progress ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>{progress}</Text>
                  <ProgressBar
                    value={doneCount / total}
                    tone={doneCount === total ? "success" : "primary"}
                    style={styles.progress}
                    testID={`project-progress-${project._id}`}
                  />
                </View>
              ) : null}
            </View>
            <IconButton
              icon="add"
              variant="tonal"
              label={`Add task to ${project.name}`}
              onPress={onAddTask}
            />
            <IconButton
              icon="ellipsis-horizontal"
              label={`More actions for ${project.name}`}
              onPress={() => setMenuOpen(true)}
            />
          </View>
          {children}
        </View>
      </Card>

      <ActionSheet
        visible={menuOpen}
        title={project.name}
        subtitle={progress || undefined}
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}

/**
 * A project task in the todo's TaskCard shape: checkbox (done), name, date
 * badge, notes preview and "⋯" for Edit / Move up / Move down / Delete.
 * Tapping the row edits; a long press opens the menu. Everything except the
 * menu button is off while `busy`, as the inline buttons were.
 */
function ProjectTaskRow({
  task,
  busy,
  canMoveUp,
  canMoveDown,
  onToggleDone,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const badge = dateBadge(task);

  const menuActions = [
    {
      key: "edit",
      label: "Edit task",
      icon: "pencil",
      disabled: busy,
      onPress: onEdit,
    },
    {
      key: "up",
      label: "Move up",
      icon: "arrow-up",
      disabled: busy || !canMoveUp,
      onPress: onMoveUp,
    },
    {
      key: "down",
      label: "Move down",
      icon: "arrow-down",
      disabled: busy || !canMoveDown,
      onPress: onMoveDown,
    },
    {
      key: "delete",
      label: "Delete task",
      icon: "trash-outline",
      destructive: true,
      disabled: busy,
      onPress: onDelete,
    },
  ];

  return (
    <>
      {/* Checkbox, body and "⋯" are siblings so each is its own
          screen-reader stop; the whole row highlights while the body is
          pressed. */}
      <View style={[styles.taskRow, pressed && styles.taskRowPressed]}>
        <Checkbox
          checked={!!task.done}
          label={task.done ? `Mark "${task.name}" not done` : `Mark "${task.name}" done`}
          onPress={onToggleDone}
          disabled={busy}
          style={styles.checkbox}
        />
        <Pressable
          onPress={onEdit}
          onLongPress={() => setMenuOpen(true)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`${task.name}${task.done ? ", done" : ""}, ${
            badge.label
          }`}
          accessibilityHint="Opens the task. Long press for more actions."
          style={styles.taskBody}
        >
          <Text
            style={[styles.taskName, task.done && styles.taskNameDone]}
            numberOfLines={2}
          >
            {task.name}
          </Text>
          <View style={styles.badgeRow}>
            <Badge label={badge.label} tone={badge.tone} icon={badge.icon} />
          </View>
          {task.notes ? (
            <Text style={styles.taskNotes} numberOfLines={1}>
              {task.notes}
            </Text>
          ) : null}
        </Pressable>
        <IconButton
          icon="ellipsis-horizontal"
          label={`More actions for ${task.name}`}
          onPress={() => setMenuOpen(true)}
        />
      </View>

      <ActionSheet
        visible={menuOpen}
        title={task.name}
        subtitle={badge.label}
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 0,
  },
  card: {
    marginBottom: spacing.lg,
  },
  cardClip: {
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  headerText: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
  },
  projectName: {
    ...type.headline,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs + 2,
  },
  metaText: {
    ...type.caption,
  },
  progress: {
    flex: 1,
    maxWidth: 160,
  },
  /* Task rows mirror the todo's TaskCard (checkbox, name, inline badge,
     notes line, "⋯" menu) so the two lists feel identical. */
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.xs,
    paddingRight: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  taskRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  checkbox: {
    marginLeft: spacing.xs,
  },
  taskBody: {
    flex: 1,
    paddingVertical: spacing.sm + 3,
    paddingRight: spacing.xs,
  },
  taskName: {
    ...type.callout,
    lineHeight: 21,
  },
  taskNameDone: {
    textDecorationLine: "line-through",
    color: colors.textTertiary,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs + 2,
    marginTop: spacing.xs + 2,
  },
  taskNotes: {
    ...type.footnote,
    marginTop: spacing.xs,
  },
  noTasksText: {
    ...type.footnote,
    fontStyle: "italic",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
});
