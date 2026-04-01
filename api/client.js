/**
 * Base HTTP client for the TaskAtHand API.
 * Base URL: https://taskathandbe.onrender.com
 * For local use - http://10.0.2.2:3002
 */

import { Platform } from "react-native";

const BASE_URL = "https://taskathandbe.onrender.com";

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await res.json();

  if (data && typeof data === "object" && "error" in data) {
    throw new Error(data.error || `API error ${res.status}`);
  }

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }

  return data;
}
