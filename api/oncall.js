/**
 * API service for on-call shifts (mirrors TaskAtHandFE's src/api/oncall.ts).
 *
 * On-call is **recorded separately and never affects tasks** — the backend
 * cron, archive, stats and insights never read it. Cron step 12 deletes
 * shifts dated before yesterday.
 *
 * Shift: { _id, date "YYYY-MM-DD", start "HH:mm", end "HH:mm" (may be "24:00";
 * at or before start = runs past midnight), type "primary"|"secondary", note }
 *
 * Endpoints:
 *   GET    /oncall       – shifts dated yesterday (UTC) onward, by date then start
 *   POST   /oncall       – add { date, start, end, type?, note? } (type defaults to primary)
 *   PUT    /oncall/:id   – partial update, validated as a whole
 *   DELETE /oncall/:id   – delete
 */

import { apiFetch } from "./client";

export const getAll = () => apiFetch("/oncall");

export const create = (body) =>
  apiFetch("/oncall", { method: "POST", body: JSON.stringify(body) });

export const update = (id, body) =>
  apiFetch(`/oncall/${id}`, { method: "PUT", body: JSON.stringify(body) });

export const remove = (id) => apiFetch(`/oncall/${id}`, { method: "DELETE" });
