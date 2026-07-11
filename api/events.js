/**
 * API service for Events collection.
 *
 * Events are reusable task bundles (e.g. "Burger Night" with its shopping
 * list). Adding an event to the todo creates a new header named after the
 * event with the selected tasks under it — the template is never consumed.
 *
 * Endpoints:
 *   GET    /events           – get all events sorted by name ASC
 *   POST   /events           – create new event { name, tasks }
 *   PUT    /events/:id       – update event name and/or task list
 *   DELETE /events/:id       – delete event template
 */

import { apiFetch } from "./client";

/** GET /events — returns all events sorted by name ASC */
export const getAll = () => apiFetch("/events");

/** POST /events — creates a new event template */
export const create = (body) =>
  apiFetch("/events", {
    method: "POST",
    body: JSON.stringify(body),
  });

/** PUT /events/:id — updates event name and/or task list */
export const update = (id, body) =>
  apiFetch(`/events/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

/** DELETE /events/:id — deletes an event template */
export const remove = (id) =>
  apiFetch(`/events/${id}`, {
    method: "DELETE",
  });
