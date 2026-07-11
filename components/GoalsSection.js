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
import GoalModal from "./GoalModal";
import ConfirmModal from "./ConfirmModal";
import { ONE_STEP_HEADER } from "../utils/goalSync";

/** Started steps become daily habits so Insights can track them. */
const DAILY_ECD = {
  type: "day_of_week",
  value: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

export default function GoalsSection({ onTasksChanged }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyStep, setBusyStep] = useState(null);

  // Modal states
  const [goalModalState, setGoalModalState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
    if (!goalModalState) return;
    try {
      if (goalModalState.mode === "add") {
        await goalsApi.create({
          name: draft.name,
          steps: draft.stepNames.map((name) => ({ name, status: "pending" })),
        });
      } else {
        // Steps that keep their name keep their status; new lines start pending
        const previous = goalModalState.goal.steps;
        const steps = draft.stepNames.map((name) => {
          const match = previous.find(
            (s) => s.name.trim().toLowerCase() === name.trim().toLowerCase(),
          );
          return { name, status: match ? match.status : "pending" };
        });
        await goalsApi.update(goalModalState.goal._id, {
          name: draft.name,
          steps,
        });
      }
      await loadGoals();
      setGoalModalState(null);
      setError(null);
    } catch (err) {
      setError(err.message);
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
    const steps = goal.steps.map((s, i) =>
      i === stepIndex ? { ...s, status } : s,
    );
    await goalsApi.update(goal._id, { steps });
  };

  const handleStartStep = async (goal, stepIndex) => {
    const step = goal.steps[stepIndex];
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
    const step = goal.steps[stepIndex];
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
        <TouchableOpacity
          style={styles.addGoalBtn}
          onPress={() => setGoalModalState({ mode: "add" })}
          activeOpacity={0.7}
        >
          <Text style={styles.addGoalText}>+ Add Goal</Text>
        </TouchableOpacity>
      </View>

      {goals.map((goal) => {
        // Anything non-pending counts (covers legacy statuses from old data)
        const underProgressCount = goal.steps.filter(
          (s) => s.status !== "pending",
        ).length;
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
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={() => setGoalModalState({ mode: "edit", goal })}
                >
                  <Ionicons name="pencil" size={16} color="#656d76" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={() => setDeleteTarget(goal)}
                >
                  <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.stepList}>
              {goal.steps.map((step, i) => {
                const busy = busyStep === `${goal._id}:${i}`;
                const isLast = i === goal.steps.length - 1;
                const started = step.status !== "pending";
                return (
                  <View
                    key={`${step.name}-${i}`}
                    style={[styles.stepRow, isLast && styles.stepRowLast]}
                  >
                    <View
                      style={[
                        styles.stepMarker,
                        started && styles.stepMarkerStarted,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepMarkerText,
                          started && styles.stepMarkerTextStarted,
                        ]}
                      >
                        {started ? "∞" : i + 1}
                      </Text>
                    </View>
                    <Text style={styles.stepName} numberOfLines={2}>
                      {step.name}
                    </Text>
                    <View style={styles.stepActions}>
                      {started ? (
                        <TouchableOpacity
                          style={[styles.iconBtn, busy && styles.busyBtn]}
                          onPress={() => handlePauseStep(goal, i)}
                          disabled={busy}
                        >
                          <Ionicons
                            name="pause-outline"
                            size={16}
                            color="#656d76"
                          />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.startBtn, busy && styles.busyBtn]}
                          onPress={() => handleStartStep(goal, i)}
                          disabled={busy}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.startBtnText}>Start</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
              {goal.steps.length === 0 && (
                <Text style={styles.noStepsText}>
                  No steps yet — edit the goal to list the small habits that
                  get you there.
                </Text>
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
        visible={!!goalModalState}
        goal={goalModalState?.mode === "edit" ? goalModalState.goal : undefined}
        onConfirm={handleSaveGoal}
        onCancel={() => setGoalModalState(null)}
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
  addGoalBtn: {
    backgroundColor: "#6200ee",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addGoalText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
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
  stepMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d7de",
    justifyContent: "center",
    alignItems: "center",
  },
  stepMarkerStarted: {
    borderColor: "#1a7f37",
    backgroundColor: "#f0fdf4",
  },
  stepMarkerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#656d76",
  },
  stepMarkerTextStarted: {
    color: "#1a7f37",
  },
  stepName: {
    flex: 1,
    fontSize: 15,
    color: "#1f2328",
  },
  stepActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  startBtn: {
    borderWidth: 1,
    borderColor: "#bc4c00",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  startBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#bc4c00",
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d0d7de",
    justifyContent: "center",
    alignItems: "center",
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
