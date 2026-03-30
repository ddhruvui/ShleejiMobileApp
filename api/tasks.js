/**
 * API service for Tasks collection.
 *
 * Endpoints:
 *   GET    /tasks?headerId=:id  – get all tasks for a header
 *   POST   /tasks               – create new task
 *   PUT    /tasks/:id           – update task
 *   DELETE /tasks/:id           – delete task
 */

import { apiFetch } from "./client";

/** GET /tasks?headerId=:id — returns all tasks for a header sorted by priority ASC */
export const getAll = (headerId) => apiFetch(`/tasks?headerId=${headerId}`);

/** POST /tasks — creates a new task, priority auto-assigned */
export const create = (body) =>
  apiFetch("/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });

/** PUT /tasks/:id — updates a task */
export const update = (id, body) =>
  apiFetch(`/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

/** DELETE /tasks/:id — deletes a task */
export const remove = (id) =>
  apiFetch(`/tasks/${id}`, {
    method: "DELETE",
  });
