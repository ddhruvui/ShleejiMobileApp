/**
 * API service for Affirmations collection.
 *
 * Endpoints:
 *   GET    /affirmations          – get all affirmations sorted by createdAt ASC
 *   POST   /affirmations          – create new affirmation { name }
 *   PUT    /affirmations/:id      – update affirmation name
 *   DELETE /affirmations/:id      – delete affirmation
 */

import { apiFetch } from "./client";

/** GET /affirmations — returns all affirmations sorted by createdAt ASC */
export const getAll = () => apiFetch("/affirmations");

/** POST /affirmations — creates a new affirmation ({ name }) */
export const create = (body) =>
  apiFetch("/affirmations", {
    method: "POST",
    body: JSON.stringify(body),
  });

/** PUT /affirmations/:id — updates affirmation name */
export const update = (id, body) =>
  apiFetch(`/affirmations/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

/** DELETE /affirmations/:id — deletes affirmation, returns { deleted: id } */
export const remove = (id) =>
  apiFetch(`/affirmations/${id}`, {
    method: "DELETE",
  });
