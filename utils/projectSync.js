/**
 * Keeps long-term projects in sync with the todo (mirrors the web FE's
 * src/utils/projectSync.ts).
 *
 * A project task with a date lives in the todo as a one-time date task under
 * a header named after the project, linked via todoTaskId. When that todo
 * task is toggled or deleted from the todo side, these helpers update the
 * matching project tasks so the two views agree. (The nightly cron closes
 * the loop server-side: deleting a done linked todo task marks the project
 * task done and clears the link.)
 */

import * as projectsApi from "../api/projects";
import * as headersApi from "../api/headers";

/**
 * Order the todo's project-derived headers to follow the projects' priority
 * order. A todo header counts as "project-derived" when its name matches an
 * existing project (case-insensitive) — those headers are arranged by their
 * project's priority (0 = top) and placed as one contiguous block starting at
 * priority 1 when any non-project header exists (the topmost non-project
 * header keeps slot 0), or at priority 0 when there are none. The remaining
 * non-project headers keep their relative order and fill the slots after the
 * block.
 *
 * Called after a project task creates/reuses its todo header and after a
 * project is moved, so "Home Improvement above Automated Stock Market" in the
 * projects view is mirrored by the todo headers. No-op when the todo has no
 * project header (or it is already in order).
 */
export async function syncProjectHeaderOrder() {
  const [projects, headers] = await Promise.all([
    projectsApi.getAll(),
    headersApi.getAll(),
  ]);
  const projectPriority = new Map(
    projects.map((p) => [p.name.trim().toLowerCase(), p.priority]),
  );
  const isProjectHeader = (h) =>
    projectPriority.has(h.name.trim().toLowerCase());

  // headers arrive sorted by priority ascending (index === priority)
  const projectHeaders = headers
    .filter(isProjectHeader)
    .sort(
      (a, b) =>
        projectPriority.get(a.name.trim().toLowerCase()) -
        projectPriority.get(b.name.trim().toLowerCase()),
    );
  if (projectHeaders.length === 0) return;

  const nonProjectHeaders = headers.filter((h) => !isProjectHeader(h));
  const desired =
    nonProjectHeaders.length > 0
      ? [nonProjectHeaders[0], ...projectHeaders, ...nonProjectHeaders.slice(1)]
      : projectHeaders;

  // Realize the target order with minimal move-to-priority updates: walk the
  // list top-down, and whenever the header at slot i is wrong, move the one
  // that belongs there up to i. Slots below i are already final, so a move up
  // only shifts the (wrong) headers in between — mirrored locally in `work`.
  const work = [...headers];
  for (let i = 0; i < desired.length; i++) {
    if (work[i]._id === desired[i]._id) continue;
    const j = work.findIndex((h) => h._id === desired[i]._id);
    const [moved] = work.splice(j, 1);
    work.splice(i, 0, moved);
    await headersApi.update(moved._id, { priority: i });
  }
}

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
 * After a todo task was edited, mirror its name and date onto every project
 * task linked to it. A `date`-type ECD becomes the project task's date; any
 * other ECD (cleared to none, or switched to a recurring type) sets the
 * project task's date to null — the link itself is kept either way.
 */
export async function syncProjectTasksForTodoEdit(taskId, name, ecd) {
  const date = ecd && ecd.type === "date" ? ecd.value : null;
  const projects = await projectsApi.getAll();
  for (const project of projects) {
    let changed = false;
    const tasks = project.tasks.map((task) => {
      if (
        task.todoTaskId === taskId &&
        (task.name !== name || task.date !== date)
      ) {
        changed = true;
        return { ...task, name, date };
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
