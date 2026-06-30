/**
 * ECD (Expected Completion Date) utility functions.
 */

const DOW_VALUES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DOW_BY_JS_INDEX = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

/**
 * Returns today's date as a YYYY-MM-DD key.
 */
function todayDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns true if the task's ECD matches today's date, day of week,
 * day of month, or day of year.
 */
export function isTaskDueToday(ecd) {
  if (!ecd) return false;
  const now = new Date();
  switch (ecd.type) {
    case "date":
      return ecd.value === todayDateKey();
    case "day_of_week":
      return ecd.value.includes(DOW_BY_JS_INDEX[now.getDay()]);
    case "day_of_month":
      return ecd.value.includes(now.getDate());
    case "day_of_year": {
      const todayDOY = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
      return ecd.value === todayDOY;
    }
    default:
      return false;
  }
}

/**
 * Returns true if the task's ECD is in the past and not a yearly event.
 * This includes past dates, but excludes day_of_week, day_of_month, and day_of_year.
 */
export function isTaskPast(ecd) {
  if (!ecd) return false;
  const now = new Date();

  // Only show past dates; exclude recurring patterns (week, month, year)
  if (ecd.type === "date") {
    return (
      ecd.value <
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    );
  }

  return false;
}

/**
 * Resolves a task's ECD to a concrete calendar date key (YYYY-MM-DD) used to
 * group tasks in the By Date view. Fixed dates and yearly dates resolve to a
 * single day. Recurring weekly/monthly patterns have no single calendar date,
 * so they resolve to today's date when due today and null otherwise. Undated
 * tasks return null.
 */
export function getEcdDateKey(ecd) {
  if (!ecd) return null;
  if (ecd.type === "date") return ecd.value; // already YYYY-MM-DD
  if (ecd.type === "day_of_year") {
    // value is D/M/YYYY
    const m = ecd.value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Recurring weekly/monthly patterns surface under today's date when due today.
  if (ecd.type === "day_of_week" || ecd.type === "day_of_month") {
    return isTaskDueToday(ecd) ? todayDateKey() : null;
  }
  return null;
}

/**
 * Formats a YYYY-MM-DD key into a readable heading, e.g. "Fri, Jun 26, 2026".
 * Parsed from components to avoid timezone shifts.
 */
export function formatDateKey(key) {
  const [y, mo, d] = key.split("-").map((n) => parseInt(n, 10));
  const date = new Date(y, mo - 1, d);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    date.getDay()
  ];
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][mo - 1];
  return `${weekday}, ${month} ${d}, ${y}`;
}

export function isValidYearDate(value) {
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value.trim());
}

export function buildEcdFromInputs({ mode, dateVal, dowVal, domVal, yearVal }) {
  if (mode === "none") return { ecd: null, error: null };

  if (mode === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal))
      return { ecd: null, error: "Date must use YYYY-MM-DD format." };
    return { ecd: { type: "date", value: dateVal }, error: null };
  }

  if (mode === "week") {
    if (dowVal.length === 0)
      return { ecd: null, error: "Select at least one weekday." };
    if (!dowVal.every((day) => DOW_VALUES.includes(day)))
      return { ecd: null, error: "Weekdays must be Mon-Sun abbreviations." };
    return { ecd: { type: "day_of_week", value: dowVal }, error: null };
  }

  if (mode === "month") {
    const hasInvalid = domVal.some(
      (value) => !Number.isInteger(value) || value < 1 || value > 31,
    );
    if (domVal.length === 0 || hasInvalid)
      return {
        ecd: null,
        error: "Monthly dates must be numbers from 1 to 31.",
      };
    return { ecd: { type: "day_of_month", value: domVal }, error: null };
  }

  // mode === "year"
  if (!isValidYearDate(yearVal))
    return { ecd: null, error: "Yearly date must use D/M/YYYY format." };
  return { ecd: { type: "day_of_year", value: yearVal.trim() }, error: null };
}
