/**
 * API service for Goals collection.
 *
 * A goal is a long-term aim (e.g. "Improve Health") with an ordered backlog
 * of small steps/habits built one at a time. Starting a step creates a daily
 * task under the "One Step At A Time" header — the goal itself only tracks
 * each step's status (pending → active → under_progress). Under-progress
 * habits are lifelong: their daily task stays until the step is paused.
 *
 * Endpoints:
 *   GET    /goals           – get all goals sorted by name ASC
 *   POST   /goals           – create new goal { name, steps }
 *   PUT    /goals/:id       – update goal name and/or steps (replaced wholesale)
 *   DELETE /goals/:id       – delete goal
 */

import { apiFetch } from "./client";

/** GET /goals — returns all goals sorted by name ASC */
export const getAll = () => apiFetch("/goals");

/** POST /goals — creates a new goal */
export const create = (body) =>
  apiFetch("/goals", {
    method: "POST",
    body: JSON.stringify(body),
  });

/** PUT /goals/:id — updates goal name and/or steps */
export const update = (id, body) =>
  apiFetch(`/goals/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

/** DELETE /goals/:id — deletes a goal */
export const remove = (id) =>
  apiFetch(`/goals/${id}`, {
    method: "DELETE",
  });
