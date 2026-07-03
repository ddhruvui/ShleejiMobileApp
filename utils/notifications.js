/**
 * Local daily reminders: 8:30 AM and 4:00 PM (device local time) with the
 * day's pending tasks.
 *
 * Content for a scheduled notification is fixed at scheduling time, so we
 * (re)schedule the next few days' reminders every time task data loads or
 * changes — each app open refreshes the content. If the app isn't opened for
 * several days, reminders pause until the next open.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";

// Notifications are unsupported in Expo Go on Android since SDK 53 — even
// importing the module logs an error there, so it's lazy-loaded and skipped.
// Use a development/EAS build to test reminders on Android.
const isExpoGoAndroid =
  Platform.OS === "android" &&
  Constants.executionEnvironment === "storeClient";

let Notifications = null;
let handlerConfigured = false;

function getNotifications() {
  if (isExpoGoAndroid) return null;
  if (!Notifications) {
    Notifications = require("expo-notifications");
  }
  if (!handlerConfigured) {
    // Show notifications even when the app is foregrounded
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  }
  return Notifications;
}

const REMINDER_TIMES = [
  { hour: 8, minute: 30, title: "Good morning — today's tasks" },
  { hour: 16, minute: 0, title: "Afternoon check-in" },
];
const DAYS_AHEAD = 3; // schedule today + next 2 days
const MAX_NAMES = 4; // task names listed before "+N more"

const DOW_BY_JS_INDEX = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** True if a task's ECD makes it due on the given local date */
function isDueOnDate(ecd, date) {
  if (!ecd) return false;
  switch (ecd.type) {
    case "date":
      return ecd.value === localDateKey(date);
    case "day_of_week":
      return ecd.value.includes(DOW_BY_JS_INDEX[date.getDay()]);
    case "day_of_month":
      return ecd.value.includes(date.getDate());
    case "day_of_year": {
      const doy = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
      return ecd.value === doy;
    }
    default:
      return false;
  }
}

/**
 * Compute pending tasks for a given local date.
 * - Due that day and not done → pending. For future days, recurring tasks
 *   count even if currently done (the nightly job resets them).
 * - One-time date tasks already past and not done → counted as overdue.
 */
function pendingForDay(headers, date, isToday) {
  const dueNames = [];
  let overdueCount = 0;
  const dateKey = localDateKey(date);

  for (const header of headers) {
    for (const task of header.tasks || []) {
      if (isDueOnDate(task.ecd, date)) {
        const isRecurring = task.ecd && task.ecd.type !== "date";
        const pending = isToday ? !task.done : isRecurring || !task.done;
        if (pending) dueNames.push(task.name);
      } else if (task.ecd?.type === "date" && task.ecd.value < dateKey) {
        if (!task.done) overdueCount++;
      }
    }
  }

  return { dueNames, overdueCount };
}

function buildBody({ dueNames, overdueCount }) {
  const parts = [];
  if (dueNames.length > 0) {
    const shown = dueNames.slice(0, MAX_NAMES).join(", ");
    const more =
      dueNames.length > MAX_NAMES ? ` +${dueNames.length - MAX_NAMES} more` : "";
    parts.push(
      `${dueNames.length} pending: ${shown}${more}`,
    );
  }
  if (overdueCount > 0) {
    parts.push(`${overdueCount} overdue`);
  }
  return parts.join(" · ");
}

/**
 * Cancel and reschedule the daily reminders for the next few days based on
 * current task data. Safe to call often; never throws.
 * @param {Array} headers  Headers with their `tasks` arrays attached
 */
export async function syncDailyReminders(headers) {
  const Notifications = getNotifications();
  if (!Notifications) return; // Expo Go on Android — reminders need a real build

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("task-reminders", {
        name: "Task reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    for (let offset = 0; offset < DAYS_AHEAD; offset++) {
      const day = new Date(now);
      day.setDate(now.getDate() + offset);

      const pending = pendingForDay(headers, day, offset === 0);
      if (pending.dueNames.length === 0 && pending.overdueCount === 0) continue;
      const body = buildBody(pending);

      for (const slot of REMINDER_TIMES) {
        const fireAt = new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          slot.hour,
          slot.minute,
          0,
        );
        if (fireAt <= now) continue;

        await Notifications.scheduleNotificationAsync({
          content: { title: slot.title, body },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireAt,
            channelId: "task-reminders",
          },
        });
      }
    }
  } catch (error) {
    console.warn("[Notifications] Failed to sync reminders:", error.message);
  }
}
