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
 * Returns true if the task's ECD matches today's date, day of week,
 * day of month, or day of year.
 */
export function isTaskDueToday(ecd) {
  if (!ecd) return false;
  const now = new Date();
  switch (ecd.type) {
    case "date": {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      return ecd.value === `${y}-${m}-${d}`;
    }
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
