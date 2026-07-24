/**
 * API service for Projects collection.
 *
 * A project is a long-term effort (e.g. "Automated Stock Market") with an
 * ordered list of tasks/steps (e.g. "get data from EODHD"). Projects carry a
 * contiguous 0-based priority like headers; within a project undone tasks
 * always come before done tasks (the server re-sorts on every write).
 *
 * The todo connection is client-driven: giving a project task a date creates
 * a one-time date-ECD task in the todo under a header named after the
 * project (reused case-insensitively, created otherwise) and stores its _id
 * in todoTaskId. When the nightly cron deletes the done todo task it marks
 * the project task done and clears the link — the step leaves the todo but
 * is retained in the project.
 *
 * Endpoints:
 *   GET    /projects        – get all projects sorted by priority ASC
 *   POST   /projects        – create new project { name, tasks }
 *   PUT    /projects/:id    – update name, tasks (replaced wholesale) and/or priority
 *   DELETE /projects/:id    – delete project (created todo tasks remain)
 */

import { apiFetch } from "./client";

/** GET /projects — returns all projects sorted by priority ASC */
export const getAll = () => apiFetch("/projects");

/** POST /projects — creates a new project, priority auto-assigned */
export const create = (body) =>
  apiFetch("/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });

/** PUT /projects/:id — updates project name, tasks and/or priority */
export const update = (id, body) =>
  apiFetch(`/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

/** DELETE /projects/:id — deletes a project (created todo tasks remain) */
export const remove = (id) =>
  apiFetch(`/projects/${id}`, {
    method: "DELETE",
  });
