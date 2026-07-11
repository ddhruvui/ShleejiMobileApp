/**
 * Keeps goals in sync with the "One Step At A Time" todo header.
 *
 * A goal step is under progress exactly while its daily task lives under
 * that header. Starting a step creates the task; pausing removes it. When
 * the task (or the whole header) is deleted from the todo instead, these
 * helpers flip the matching steps back to pending so the two views agree.
 *
 * Mirrors TaskAtHandFE's src/utils/goalSync.ts.
 */

import * as goalsApi from "../api/goals";

/** Todo header that holds the habits currently under progress. */
export const ONE_STEP_HEADER = "One Step At A Time";

/** Case-insensitive check for the "One Step At A Time" header. */
export function isOneStepHeaderName(name) {
  return name.trim().toLowerCase() === ONE_STEP_HEADER.toLowerCase();
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
