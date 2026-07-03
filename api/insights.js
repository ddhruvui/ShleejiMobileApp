/**
 * API functions for archive stats and AI insight reports.
 * Endpoints: GET /insights/stats, GET /insights/latest, POST /insights/generate
 */

import { apiFetch } from "./client";

export async function getStats(days = 28) {
  return apiFetch(`/insights/stats?days=${days}`);
}

export async function getLatest() {
  return apiFetch("/insights/latest");
}

export async function generate(days) {
  return apiFetch("/insights/generate", {
    method: "POST",
    body: JSON.stringify(days ? { days } : {}),
  });
}
