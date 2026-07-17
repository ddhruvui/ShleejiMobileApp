/**
 * API service for Calls collection (people to ring biweekly or monthly).
 *
 * Endpoints:
 *   GET    /calls          – get all calls sorted by createdAt ASC
 *   POST   /calls          – create new call { name, frequency }
 *   PUT    /calls/:id      – update call { name?, frequency?, done? }
 *   DELETE /calls/:id      – delete call
 *
 * The backend's nightly cron resets `done` for biweekly calls on the 15th
 * and for all calls on the last day of the month.
 */

import { apiFetch } from "./client";

/** GET /calls — returns all calls sorted by createdAt ASC */
export const getAll = () => apiFetch("/calls");

/** POST /calls — creates a new call ({ name, frequency }) */
export const create = (body) =>
  apiFetch("/calls", {
    method: "POST",
    body: JSON.stringify(body),
  });

/** PUT /calls/:id — updates name/frequency/done (done→true stamps doneAt) */
export const update = (id, body) =>
  apiFetch(`/calls/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

/** DELETE /calls/:id — deletes call, returns { deleted: id } */
export const remove = (id) =>
  apiFetch(`/calls/${id}`, {
    method: "DELETE",
  });
