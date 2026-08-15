/**
 * Keeps goals in sync with the "One Step At A Time" todo header.
 *
 * A goal step is under progress exactly while its daily task lives under
 * that header. Starting a step creates the task on the weekdays the step is
 * set to (`days`); pausing removes it. When the task (or the whole header) is
 * deleted from the todo instead, these helpers flip the matching steps back
 * to pending so the two views agree.
 *
 * Mirrors TaskAtHandFE's src/utils/goalSync.ts.
 */

import * as goalsApi from "../api/goals";

/** Todo header that holds the habits currently under progress. */
export const ONE_STEP_HEADER = "One Step At A Time";

/**
 * Canonical week order. The backend stores a step's `days` sorted into it, so
 * building the ECD in the same order keeps the goal row and the todo card
 * showing the identical day list.
 */
export const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Case-insensitive check for the "One Step At A Time" header. */
export function isOneStepHeaderName(name) {
  return name.trim().toLowerCase() === ONE_STEP_HEADER.toLowerCase();
}

/**
 * The weekdays a step's habit runs on, in week order. A step saved before
 * `days` existed carries none, and back then every started step became a
 * seven-day task — so an absent list means the whole week, not "no days".
 */
export function stepDays(step) {
  if (!step.days || step.days.length === 0) return [...WEEK_DAYS];
  return WEEK_DAYS.filter((day) => step.days.includes(day));
}

/** The recurring ECD a started step's daily task carries. */
export function daysToEcd(days) {
  return {
    type: "day_of_week",
    value: WEEK_DAYS.filter((d) => days.includes(d)),
  };
}

/**
 * Badge text for a step's schedule: the full week collapses to "Daily",
 * anything narrower lists the days it is actually expected on — which is also
 * the set its streak is counted over.
 */
export function daysLabel(days) {
  return days.length === WEEK_DAYS.length ? "Daily" : days.join(", ");
}

function asPending(step) {
  return { ...step, status: "pending" };
}

/**
 * After a daily task was deleted from the "One Step At A Time" header,
 * move every started step with that name (any goal) back to pending.
 */
export async function pauseStepsMatchingTask(taskName) {
  const key = taskName.trim().toLowerCase();
  const goals = await goalsApi.getAll();
  for (const goal of goals) {
    let changed = false;
    const steps = goal.steps.map((step) => {
      if (step.status !== "pending" && step.name.trim().toLowerCase() === key) {
        changed = true;
        return asPending(step);
      }
      return step;
    });
    if (changed) await goalsApi.update(goal._id, { steps });
  }
}

/**
 * After the "One Step At A Time" header itself was deleted (taking all
 * daily tasks with it), move every started step in every goal back to
 * pending.
 */
export async function pauseAllStartedSteps() {
  const goals = await goalsApi.getAll();
  for (const goal of goals) {
    if (goal.steps.some((step) => step.status !== "pending")) {
      await goalsApi.update(goal._id, { steps: goal.steps.map(asPending) });
    }
  }
}
