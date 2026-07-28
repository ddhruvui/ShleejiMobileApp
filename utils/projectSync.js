/**
 * Keeps long-term projects in sync with the todo (mirrors the web FE's
 * src/utils/projectSync.ts).
 *
 * A project task with a date lives in the todo as a one-time date task under
 * the project's own header, linked via todoTaskId. When that todo task is
 * toggled or deleted from the todo side, these helpers update the matching
 * project tasks so the two views agree. (The nightly cron closes the loop
 * server-side: deleting a done linked todo task marks the project task done
 * and clears the link.)
 */

import * as projectsApi from "../api/projects";

/**
 * Note: where a project's todo header sits is **not** synced from here. The
 * backend owns that rule — `POST /headers { projectId }` places the header in
 * the projects' priority order, and moving/renaming/deleting a project
 * cascades onto the header server-side. The old client-side
 * `syncProjectHeaderOrder` walked the header list issuing one PUT per moved
 * header, which was non-atomic, raced with the web client, and re-derived the
 * server's own priority-shift semantics.
 */

/**
 * After a todo task's done state was toggled, mirror the new state onto
 * every project task linked to it (the server re-sorts so done tasks move
 * to the bottom of their project). The link is kept — the cron consumes it
 * when it deletes the done todo task.
 */
export async function syncProjectTasksForTodoDone(taskId, done) {
  const projects = await projectsApi.getAll();
  for (const project of projects) {
    let changed = false;
    const tasks = project.tasks.map((task) => {
      if (task.todoTaskId === taskId && task.done !== done) {
        changed = true;
        return { ...task, done };
      }
      return task;
    });
    if (changed) await projectsApi.update(project._id, { tasks });
  }
}

/**
 * After a todo task was edited, mirror its name, date and notes onto every
 * project task linked to it. A `date`-type ECD becomes the project task's
 * date; any other ECD (cleared to none, or switched to a recurring type) sets
 * the project task's date to null — the link itself is kept either way.
 */
export async function syncProjectTasksForTodoEdit(taskId, name, ecd, notes) {
  const date = ecd && ecd.type === "date" ? ecd.value : null;
  const projects = await projectsApi.getAll();
  for (const project of projects) {
    // The todo task shows a `Step towards "<project>"` placeholder when the
    // project task has no notes of its own — mirroring that back would turn
    // the placeholder into real project notes, so it reads as empty here.
    const mirroredNotes =
      notes === `Step towards "${project.name}"` ? "" : notes;
    let changed = false;
    const tasks = project.tasks.map((task) => {
      if (
        task.todoTaskId === taskId &&
        (task.name !== name ||
          task.date !== date ||
          task.notes !== mirroredNotes)
      ) {
        changed = true;
        return { ...task, name, date, notes: mirroredNotes };
      }
      return task;
    });
    if (changed) await projectsApi.update(project._id, { tasks });
  }
}

/**
 * After todo tasks were reordered within a header, mirror the new relative
 * order onto the projects: within each project, tasks linked to that header
 * are re-arranged to follow the todo's order (unlinked tasks keep their
 * slots). Call with the header's task ids sorted by priority.
 */
export async function syncProjectTaskOrderForTodo(orderedTaskIds) {
  if (!orderedTaskIds || orderedTaskIds.length < 2) return;
  const pos = new Map(orderedTaskIds.map((id, i) => [id, i]));
  const projects = await projectsApi.getAll();
  for (const project of projects) {
    const linked = project.tasks.filter(
      (t) => t.todoTaskId && pos.has(t.todoTaskId),
    );
    if (linked.length < 2) continue;
    const sorted = [...linked].sort(
      (a, b) => pos.get(a.todoTaskId) - pos.get(b.todoTaskId),
    );
    let next = 0;
    const tasks = project.tasks.map((t) =>
      t.todoTaskId && pos.has(t.todoTaskId) ? sorted[next++] : t,
    );
    if (tasks.some((t, i) => t !== project.tasks[i])) {
      await projectsApi.update(project._id, { tasks });
    }
  }
}

/**
 * After todo tasks were deleted from the todo (directly or via a header
 * cascade), unlink the matching project tasks. Undone project tasks lose
 * their date too (no todo task backs it anymore); done ones keep the date
 * for the record.
 */
export async function unlinkProjectTasksForTodoTasks(taskIds) {
  if (!taskIds || taskIds.length === 0) return;
  const idSet = new Set(taskIds);
  const projects = await projectsApi.getAll();
  for (const project of projects) {
    let changed = false;
    const tasks = project.tasks.map((task) => {
      if (task.todoTaskId && idSet.has(task.todoTaskId)) {
        changed = true;
        return {
          ...task,
          todoTaskId: null,
          date: task.done ? task.date : null,
        };
      }
      return task;
    });
    if (changed) await projectsApi.update(project._id, { tasks });
  }
}
