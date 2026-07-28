/**
 * API service for Headers collection.
 *
 * Endpoints:
 *   GET    /headers          – get all headers sorted by priority ASC
 *   POST   /headers          – create new header (priority auto-assigned; with a
 *                              projectId it is placed in the project block and
 *                              the call is idempotent per project)
 *   PUT    /headers/:id      – update header name and/or priority
 *   DELETE /headers/:id      – delete header and all its tasks
 */

import { apiFetch } from "./client";

/** GET /headers — returns all headers sorted by priority ASC */
export const getAll = () => apiFetch("/headers");

/**
 * POST /headers — creates a new header, priority auto-assigned.
 * Pass `{ name, projectId }` to mark it as a long-term project's todo home:
 * the server places it in the project block and returns the existing header
 * (200) instead of creating a duplicate when the project already has one.
 */
export const create = (body) =>
  apiFetch("/headers", {
    method: "POST",
    body: JSON.stringify(body),
  });

/** PUT /headers/:id — updates header name and/or priority */
export const update = (id, body) =>
  apiFetch(`/headers/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

/** DELETE /headers/:id — deletes header and all its tasks */
export const remove = (id) =>
  apiFetch(`/headers/${id}`, {
    method: "DELETE",
  });
