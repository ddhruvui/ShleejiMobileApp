/**
 * Keeps life events in sync with the todo (mirrors the web FE's
 * src/utils/lifeEventSync.ts).
 *
 * The backend cron adds each life event to the todo once a year as a
 * one-time date task under the "Events" header, linked via todoTaskId. When
 * that todo task is toggled, renamed or deleted from the todo side, these
 * helpers update the matching life events so the two views agree. (The
 * nightly cron closes the loop server-side: deleting the done linked todo
 * task marks the event done and clears the link.)
 *
 * The event's annual date is deliberately NOT synced from the todo task's
 * ECD — rescheduling this year's occurrence in the todo doesn't move the
 * anniversary itself.
 */

import * as lifeEventsApi from "../api/lifeevents";

/**
 * After a todo task's done state was toggled, mirror the new state onto
 * every life event linked to it. The link is kept — the cron consumes it
 * when it deletes the done todo task.
 */
export async function syncLifeEventsForTodoDone(taskId, done) {
  const events = await lifeEventsApi.getAll();
  for (const event of events) {
    if (event.todoTaskId === taskId && event.done !== done) {
      await lifeEventsApi.update(event._id, { done });
    }
  }
}

/**
 * After a todo task was edited, mirror its name onto every life event
 * linked to it (the ECD is not mirrored — see module docs).
 */
export async function syncLifeEventsForTodoEdit(taskId, name) {
  const events = await lifeEventsApi.getAll();
  for (const event of events) {
    if (event.todoTaskId === taskId && event.name !== name) {
      await lifeEventsApi.update(event._id, { name });
    }
  }
}

/**
 * After todo tasks were deleted from the todo (directly or via a header
 * cascade), unlink the matching life events. The done state is left alone —
 * deleting the task isn't completing it, and the event fires again on its
 * next anniversary either way.
 */
export async function unlinkLifeEventsForTodoTasks(taskIds) {
  if (!taskIds || taskIds.length === 0) return;
  const idSet = new Set(taskIds);
  const events = await lifeEventsApi.getAll();
  for (const event of events) {
    if (event.todoTaskId && idSet.has(event.todoTaskId)) {
      await lifeEventsApi.update(event._id, { todoTaskId: null });
    }
  }
}
