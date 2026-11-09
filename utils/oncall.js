/**
 * On-call shift helpers — a mirror of TaskAtHandFE's `src/utils/oncall.ts`.
 * Keep the two in step.
 *
 * Everything here works in the **local** timezone: shifts are wall-clock
 * times, and "has it ended" / "is it on now" must follow the user's own clock.
 * Date keys are parsed by component, never via `new Date("YYYY-MM-DD")`.
 */

import { addDaysToDateKey } from "./ecd";

export const MINUTES_PER_DAY = 24 * 60;


const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "HH:mm" (00:00–23:59) → minutes since midnight, or null. */
export function startMinutes(value) {
  const match = TIME_PATTERN.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Like `startMinutes`, plus "24:00" (1440). */
export function endMinutes(value) {
  return value === "24:00" ? MINUTES_PER_DAY : startMinutes(value);
}

/** Shift length in minutes; an end at or before the start wraps past midnight. */
export function shiftMinutes(shift) {
  const start = startMinutes(shift.start);
  const end = endMinutes(shift.end);
  if (start === null || end === null || start === end) return 0;
  return end > start ? end - start : end + MINUTES_PER_DAY - start;
}

/** Whether the shift runs into the next calendar day. */
export function isOvernight(shift) {
  const start = startMinutes(shift.start) ?? 0;
  return start + shiftMinutes(shift) > MINUTES_PER_DAY;
}

/** The local Date a shift starts. */
export function shiftStart(shift) {
  const [y, m, d] = shift.date.split("-").map(Number);
  return new Date(y, m - 1, d, 0, startMinutes(shift.start) ?? 0);
}

/** The local Date a shift ends. */
export function shiftEnd(shift) {
  const start = shiftStart(shift);
  return new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
    start.getHours(),
    start.getMinutes() + shiftMinutes(shift),
  );
}

export const isEnded = (shift, now) =>
  shiftEnd(shift) <= now;

export const isActive = (shift, now) =>
  shiftStart(shift) <= now && now < shiftEnd(shift);

/** Shifts that have not ended yet, in start order. */
export function upcomingShifts(shifts, now) {
  return shifts
    .filter((s) => !isEnded(s, now))
    .sort((a, b) => shiftStart(a).getTime() - shiftStart(b).getTime());
}

/** The shift running right now (primary wins a tie), or null. */
export function activeShift(shifts, now) {
  const running = shifts.filter((s) => isActive(s, now));
  return running.find((s) => s.type === "primary") ?? running[0] ?? null;
}

/** 780 → "13h", 510 → "8h 30m", 45 → "45m". */
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Minutes from `now` until a shift ends (floored at 0). */
export function minutesLeft(shift, now) {
  return Math.max(
    0,
    Math.floor((shiftEnd(shift).getTime() - now.getTime()) / 60000),
  );
}

const pad = (n) => String(n).padStart(2, "0");

/** Minutes since midnight → "HH:mm" (1440 → "24:00"). */
export function toTime(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** A Date → its local "YYYY-MM-DD" key. */
export function dateKeyOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const QUICK_PATTERN =
  /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?(?:\s+(p|primary|s|sec|secondary))?$/i;

/**
 * Parse the quick-add shorthand: "11/16 9-22", "11/12 22:30-6", "11/16 9-22 s".
 *
 * Month/day with no year picks the next occurrence on or after yesterday
 * (yesterday so an overnight shift that started then can still be logged).
 * Hours are 0–24; "24" is only an end. A trailing `s`/`sec`/`secondary` makes
 * it secondary; anything else is primary.
 *
 * @returns the shift, or null when the text doesn't parse or the times are equal
 */
export function parseQuickAdd(text, now) {
  const match = QUICK_PATTERN.exec(text.trim());
  if (!match) return null;
  const [, mo, d, sh, sm = "0", eh, em = "0", kind] = match;
  const month = Number(mo);
  const day = Number(d);
  const startH = Number(sh);
  const endH = Number(eh);
  const startM = Number(sm);
  const endM = Number(em);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (startH > 23 || startM > 59 || endM > 59) return null;
  if (endH > 24 || (endH === 24 && endM !== 0)) return null;

  const yesterday = addDaysToDateKey(dateKeyOf(now), -1);
  let year = now.getFullYear();
  let candidate = new Date(year, month - 1, day);
  if (candidate.getMonth() !== month - 1) return null; // e.g. 2/30
  if (dateKeyOf(candidate) < yesterday) {
    year += 1;
    candidate = new Date(year, month - 1, day);
    if (candidate.getMonth() !== month - 1) return null;
  }

  const start = toTime(startH * 60 + startM);
  const end = toTime(endH * 60 + endM);
  if (shiftMinutes({ start, end }) === 0) return null;

  const type =
    kind && kind.toLowerCase().startsWith("s") ? "secondary" : "primary";
  return { date: dateKeyOf(candidate), start, end, type };
}

/** The Monday on or before a date key. */
export function weekStartKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = Sun
  return addDaysToDateKey(key, -((dow + 6) % 7));
}

/** One bar on the timeline: a shift's slice of a single day. */
/**
 * Split shifts into per-day segments for the 7 days from `weekStart`.
 * An overnight shift becomes two bars: [start, 24:00) on its day and
 * [00:00, end) on the next.
 */
export function weekSegments(shifts, weekStart) {
  const days = Array.from({ length: 7 }, (_, i) => ({
    date: addDaysToDateKey(weekStart, i),
    segments: [],
  }));
  const byDate = new Map(days.map((d) => [d.date, d]));

  for (const shift of shifts) {
    const from = startMinutes(shift.start);
    const length = shiftMinutes(shift);
    if (from === null || length === 0) continue;
    const to = from + length;
    if (to <= MINUTES_PER_DAY) {
      byDate.get(shift.date)?.segments.push({ shift, from, to, part: "whole" });
    } else {
      byDate
        .get(shift.date)
        ?.segments.push({ shift, from, to: MINUTES_PER_DAY, part: "start" });
      byDate
        .get(addDaysToDateKey(shift.date, 1))
        ?.segments.push({
          shift,
          from: 0,
          to: to - MINUTES_PER_DAY,
          part: "end",
        });
    }
  }
  for (const day of days) day.segments.sort((a, b) => a.from - b.from);
  return days;
}

/** Minutes of each type that fall inside the week. */
export function weekTotals(shifts, weekStart) {
  const totals = { primary: 0, secondary: 0 };
  for (const day of weekSegments(shifts, weekStart)) {
    for (const seg of day.segments) totals[seg.shift.type] += seg.to - seg.from;
  }
  return totals;
}
