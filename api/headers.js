/**
 * API service for Headers collection.
 *
 * Endpoints:
 *   GET    /headers          – get all headers sorted by priority ASC
 *   POST   /headers          – create new header (priority auto-assigned)
 *   PUT    /headers/:id      – update header name and/or priority
 *   DELETE /headers/:id      – delete header and all its tasks
 */

import { apiFetch } from "./client";

/** GET /headers — returns all headers sorted by priority ASC */
export const getAll = () => apiFetch("/headers");

/** POST /headers — creates a new header, priority auto-assigned */
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
