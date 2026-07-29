import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as goalsApi from "../api/goals";
import * as headersApi from "../api/headers";
import * as tasksApi from "../api/tasks";
import AddButton from "./AddButton";
import GoalModal from "./GoalModal";
import AddStepModal from "./AddStepModal";
import ConfirmModal from "./ConfirmModal";
import { ONE_STEP_HEADER } from "../utils/goalSync";

/** Started steps become daily habits so Insights can track them. */
const DAILY_ECD = {
  type: "day_of_week",
  value: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

/**
 * Under-progress steps sort above the pending backlog (stable within each
 * group) — the goals-side mirror of the todo's undone-above-done barrier.
 * Every step mutation persists this order, and the render applies it too so
 * legacy goals stored unsorted display correctly before their next write.
 */
function sortSteps(steps) {
  return [
    ...steps.filter((s) => s.status !== "pending"),
    ...steps.filter((s) => s.status === "pending"),
  ];
}

export default function GoalsSection({ onTasksChanged }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyStep, setBusyStep] = useState(null);

  // Modal states. There is no edit mode: the goal heading has no Edit button,
  // so a goal is created here and afterwards only its steps change.
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addStepGoal, setAddStepGoal] = useState(null);
  const [addingStep, setAddingStep] = useState(false);
  const [deleteStepTarget, setDeleteStepTarget] = useState(null);

  const loadGoals = useCallback(async () => {
    try {
      const all = await goalsApi.getAll();
      setGoals(all);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  /* ── Goal CRUD ── */

  const handleSaveGoal = async (draft) => {
    try {
      await goalsApi.create({
        name: draft.name,
        steps: draft.stepNames.map((name) => ({ name, status: "pending" })),
      });
      await loadGoals();
      setAddGoalOpen(false);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  /**
   * Append one step to a goal's backlog — the goals-side equivalent of adding
   * a task to a header. New steps start pending.
   */
  const handleAddStep = async (name) => {
    if (!addStepGoal) return;
    setAddingStep(true);
    try {
      await goalsApi.update(addStepGoal._id, {
        steps: [...addStepGoal.steps, { name, status: "pending" }],
      });
      await loadGoals();
      setAddStepGoal(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingStep(false);
    }
  };

  /** Reorder goals; the server shifts the others to keep 0..n-1 contiguous. */
  const handleMoveGoal = async (goal, delta) => {
    try {
      await goalsApi.update(goal._id, { priority: goal.priority + delta });
      await loadGoals();
      setError(null);
    } catch (err) {
      setError(err.message);
      await loadGoals();
    }
  };

  /** Reorder steps inside a goal — the step list is replaced wholesale.
   * Indices address the sorted (started-first) list the section renders, and
   * moves never cross the started/pending barrier. */
  const handleMoveStep = async (goal, stepIndex, delta) => {
    const steps = sortSteps(goal.steps);
    const target = stepIndex + delta;
    if (target < 0 || target >= steps.length) return;
    const crossesBarrier =
      (steps[stepIndex].status !== "pending") !==
      (steps[target].status !== "pending");
    if (crossesBarrier) return;
    [steps[stepIndex], steps[target]] = [steps[target], steps[stepIndex]];
    setBusyStep(`${goal._id}:${stepIndex}`);
    try {
      await goalsApi.update(goal._id, { steps });
      await loadGoals();
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyStep(null);
    }
  };

  const handleDeleteGoal = async () => {
    if (!deleteTarget) return;
    try {
      await goalsApi.remove(deleteTarget._id);
      setGoals((prev) => prev.filter((g) => g._id !== deleteTarget._id));
      setDeleteTarget(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  /* ── Step transitions ──
   * A step is under progress exactly while its daily task lives under the
   * "One Step At A Time" header. Start creates the task (header reused when
   * one exists, created otherwise — same find-or-create pattern as event
   * scheduling) and the habit is kept for life; Pause removes the task and
   * shelves the step. Deleting the task from the todo pauses the step too
   * (see utils/goalSync). */

  const findOneStepHeader = async () => {
    const all = await headersApi.getAll();
    return all.find(
      (h) => h.name.trim().toLowerCase() === ONE_STEP_HEADER.toLowerCase(),
    );
  };

  const updateStepStatus = async (goal, stepIndex, status) => {
    const steps = sortSteps(goal.steps).map((s, i) =>
      i === stepIndex ? { ...s, status } : s,
    );
    // Re-sort so the step joins its new group (a started step rises to the
    // under-progress block, a paused one drops back to the backlog)
    await goalsApi.update(goal._id, { steps: sortSteps(steps) });
  };

  const handleStartStep = async (goal, stepIndex) => {
    const step = sortSteps(goal.steps)[stepIndex];
    setBusyStep(`${goal._id}:${stepIndex}`);
    try {
      const header =
        (await findOneStepHeader()) ||
        (await headersApi.create({ name: ONE_STEP_HEADER }));
      const existing = await tasksApi.getAll(header._id);
      const alreadyThere = existing.some(
        (t) => t.name.trim().toLowerCase() === step.name.trim().toLowerCase(),
      );
      if (!alreadyThere) {
        await tasksApi.create({
          name: step.name,
          headerId: header._id,
          notes: `Step towards "${goal.name}"`,
          ecd: DAILY_ECD,
        });
      }
      await updateStepStatus(goal, stepIndex, "under_progress");
      await loadGoals();
      setError(null);
      setNotice(
        `Started "${step.name}" — under progress as a daily habit in "${ONE_STEP_HEADER}".`,
      );
      onTasksChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyStep(null);
    }
  };

  /* under_progress → pending: back to the backlog, daily task removed. */
  const handlePauseStep = async (goal, stepIndex) => {
    const step = sortSteps(goal.steps)[stepIndex];
    setBusyStep(`${goal._id}:${stepIndex}`);
    try {
      const header = await findOneStepHeader();
      if (header) {
        const tasks = await tasksApi.getAll(header._id);
        const match = tasks.find(
          (t) => t.name.trim().toLowerCase() === step.name.trim().toLowerCase(),
        );
        if (match) await tasksApi.remove(match._id);
      }
      await updateStepStatus(goal, stepIndex, "pending");
      await loadGoals();
      setError(null);
      setNotice(
        `"${step.name}" paused — moved back to the backlog and removed from the daily list.`,
      );
      onTasksChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyStep(null);
    }
  };

  /**
   * Remove a step from the backlog. An under-progress step still owns a daily
   * task under "One Step At A Time", so drop that first — same cleanup pause
   * does, otherwise the todo keeps an orphan habit no goal points at.
   */
  const handleDeleteStep = async () => {
    if (!deleteStepTarget) return;
    const { goal, index } = deleteStepTarget;
    const steps = sortSteps(goal.steps);
    const step = steps[index];
    setBusyStep(`${goal._id}:${index}`);
    try {
      if (step.status !== "pending") {
        const header = await findOneStepHeader();
        if (header) {
          const tasks = await tasksApi.getAll(header._id);
          const match = tasks.find(
            (t) =>
              t.name.trim().toLowerCase() === step.name.trim().toLowerCase(),
          );
          if (match) await tasksApi.remove(match._id);
        }
      }
      await goalsApi.update(goal._id, {
        steps: steps.filter((_, i) => i !== index),
      });
      await loadGoals();
      setDeleteStepTarget(null);
      setError(null);
      if (step.status !== "pending") onTasksChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyStep(null);
    }
  };

  /* ── Render ── */

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#6200ee" />
        <Text style={styles.loadingText}>Loading goals…</Text>
      </View>
    );
  }

  return (
    <View>
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>Action failed: {error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={18} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      )}
      {notice && (
        <View style={styles.noticeBar}>
          <Text style={styles.noticeText}>{notice}</Text>
          <TouchableOpacity onPress={() => setNotice(null)}>
            <Ionicons name="close" size={18} color="#1a7f37" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.toolbar}>
        <AddButton label="Add Goal" onPress={() => setAddGoalOpen(true)} />
      </View>

      {goals.map((goal, idx) => {
        // Anything non-pending counts (covers legacy statuses from old data)
        const underProgressCount = goal.steps.filter(
          (s) => s.status !== "pending",
        ).length;
        // Under-progress steps render above the pending backlog; all step
        // handlers index into this sorted list
        const steps = sortSteps(goal.steps);
        return (
          <View key={goal._id} style={styles.section}>
            <View style={styles.headerRow}>
              <Text style={styles.headerName} numberOfLines={1}>
                {goal.name}
              </Text>
              <View style={styles.headerActions}>
                {goal.steps.length > 0 && (
                  <Text style={styles.progressBadge}>
                    {underProgressCount}/{goal.steps.length} under progress
                  </Text>
                )}
                {/* Goal order is manual, like todo headers and projects —
                    the server shifts neighbours to stay contiguous. */}
                <TouchableOpacity
                  style={[styles.headerBtn, idx === 0 && styles.busyBtn]}
                  onPress={() => handleMoveGoal(goal, -1)}
                  disabled={idx === 0}
                >
                  <Ionicons name="arrow-up" size={16} color="#656d76" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.headerBtn,
                    idx === goals.length - 1 && styles.busyBtn,
                  ]}
                  onPress={() => handleMoveGoal(goal, 1)}
                  disabled={idx === goals.length - 1}
                >
                  <Ionicons name="arrow-down" size={16} color="#656d76" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={() => setDeleteTarget(goal)}
                >
                  <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                </TouchableOpacity>
                {/* Same trailing "+" the todo puts on a header, adding one
                    step at a time instead of retyping the whole list. */}
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={() => setAddStepGoal(goal)}
                >
                  <Ionicons name="add" size={18} color="#656d76" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.stepList}>
              {steps.map((step, i) => {
                const busy = busyStep === `${goal._id}:${i}`;
                const isLast = i === steps.length - 1;
                const started = step.status !== "pending";
                // Moves stay inside the step's own group — mirrors the todo's
                // done/undone barrier
                const canMoveUp =
                  i > 0 && (steps[i - 1].status !== "pending") === started;
                const canMoveDown =
                  !isLast && (steps[i + 1].status !== "pending") === started;
                return (
                  <View
                    key={`${step.name}-${i}`}
                    style={[styles.stepRow, isLast && styles.stepRowLast]}
                  >
                    {/* Checkbox drives the step lifecycle: checked = under
                        progress. Deliberately no done styling — a started
                        step is active, not finished. */}
                    <TouchableOpacity
                      style={[
                        styles.stepCheckbox,
                        started && styles.stepCheckboxChecked,
                        busy && styles.busyBtn,
                      ]}
                      onPress={() =>
                        started
                          ? handlePauseStep(goal, i)
                          : handleStartStep(goal, i)
                      }
                      disabled={busy}
                    >
                      {started && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </TouchableOpacity>
                    <View style={styles.stepBody}>
                      <Text style={styles.stepName} numberOfLines={2}>
                        {step.name}
                      </Text>
                      {/* Same slot the todo uses for the ECD badge. A started
                          step is a 7-day recurring task there, so it gets the
                          recurring styling too. */}
                      <View
                        style={[
                          styles.stepBadge,
                          started && styles.stepBadgeStarted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.stepBadgeText,
                            started && styles.stepBadgeTextStarted,
                          ]}
                        >
                          {started ? "↻ Daily" : "Not started"}
                        </Text>
                      </View>
                    </View>
                    {/* Same action cluster the todo puts on a task */}
                    <View style={styles.stepActions}>
                      <TouchableOpacity
                        style={[styles.iconBtn, !canMoveUp && styles.busyBtn]}
                        onPress={() => handleMoveStep(goal, i, -1)}
                        disabled={busy || !canMoveUp}
                      >
                        <Ionicons name="arrow-up" size={15} color="#656d76" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.iconBtn,
                          !canMoveDown && styles.busyBtn,
                        ]}
                        onPress={() => handleMoveStep(goal, i, 1)}
                        disabled={busy || !canMoveDown}
                      >
                        <Ionicons name="arrow-down" size={15} color="#656d76" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => setDeleteStepTarget({ goal, index: i })}
                        disabled={busy}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={15}
                          color="#e74c3c"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              {goal.steps.length === 0 && (
                <Text style={styles.noStepsText}>No steps yet — add one!</Text>
              )}
            </View>
          </View>
        );
      })}

      {goals.length === 0 && (
        <Text style={styles.emptyText}>
          No goals yet — add one! A goal (e.g. "Improve Health") lists the
          small habits that get you there, built one step at a time: start a
          step and it's under progress as a daily habit — for life — then
          start the next when it sticks. Pause anytime to shelve one.
        </Text>
      )}

      {/* Modals */}
      <GoalModal
        visible={addGoalOpen}
        onConfirm={handleSaveGoal}
        onCancel={() => setAddGoalOpen(false)}
      />

      <AddStepModal
        visible={!!addStepGoal}
        goalName={addStepGoal?.name}
        busy={addingStep}
        onConfirm={handleAddStep}
        onCancel={() => setAddStepGoal(null)}
      />

      <ConfirmModal
        visible={!!deleteStepTarget}
        message={
          deleteStepTarget
            ? `Delete step "${sortSteps(deleteStepTarget.goal.steps)[deleteStepTarget.index].name}" from "${deleteStepTarget.goal.name}"?${
                sortSteps(deleteStepTarget.goal.steps)[deleteStepTarget.index]
                  .status !== "pending"
                  ? ` Its daily task in "${ONE_STEP_HEADER}" is removed too.`
                  : ""
              }`
            : ""
        }
        onConfirm={handleDeleteStep}
        onCancel={() => setDeleteStepTarget(null)}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        message={`Delete goal "${deleteTarget?.name}"? Tasks already added to the todo stay.`}
        onConfirm={handleDeleteGoal}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: "#656d76",
  },
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fde8e8",
  },
  errorText: {
    fontSize: 13,
    color: "#e74c3c",
    flex: 1,
    marginRight: 8,
  },
  noticeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  noticeText: {
    fontSize: 13,
    color: "#1a7f37",
    flex: 1,
    marginRight: 8,
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#eaeef2",
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
    backgroundColor: "#f6f8fa",
  },
  headerName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2328",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  headerBtn: {
    padding: 6,
    borderRadius: 6,
  },
  progressBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#656d76",
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginRight: 4,
    overflow: "hidden",
  },
  stepList: {
    paddingHorizontal: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
  },
  stepRowLast: {
    borderBottomWidth: 0,
  },
  /* Step rows mirror the todo's TaskCard styling (square checkbox, inline
     badge in the ECD slot) so the two lists feel identical. */
  stepCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d0d7de",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  stepCheckboxChecked: {
    borderColor: "#6200ee",
    backgroundColor: "#6200ee",
  },
  stepBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  stepName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1f2328",
  },
  stepBadge: {
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  stepBadgeStarted: {
    backgroundColor: "#e8f0fe",
  },
  stepBadgeText: {
    fontSize: 11,
    color: "#656d76",
    fontWeight: "500",
  },
  stepBadgeTextStarted: {
    color: "#1a73e8",
  },
  /* Move/delete cluster on a step row, mirroring the todo task actions */
  stepActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  iconBtn: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
  },
  busyBtn: {
    opacity: 0.5,
  },
  noStepsText: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#656d76",
    paddingVertical: 10,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    color: "#656d76",
    paddingVertical: 24,
  },
});
