import React, {
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
} from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import * as goalsApi from "../api/goals";
import * as headersApi from "../api/headers";
import * as tasksApi from "../api/tasks";
import GoalModal from "./GoalModal";
import AddStepModal from "./AddStepModal";
import StepDaysModal from "./StepDaysModal";
import ConfirmModal from "./ConfirmModal";
import {
  ActionSheet,
  Badge,
  Banner,
  Card,
  Checkbox,
  EmptyState,
  IconButton,
  LoadingState,
  ProgressBar,
} from "./ui";
import { colors, radii, spacing, type } from "../theme";
import {
  ONE_STEP_HEADER,
  daysLabel,
  daysToEcd,
  fetchOneStepStreaks,
  isOneStepHeaderName,
  stepDays,
  streakFor,
} from "../utils/goalSync";

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

export default function GoalsSection({ onTasksChanged, addRef }) {
  const [goals, setGoals] = useState([]);
  /** Current/best streak of a started step, keyed by lower-cased step name. */
  const [streaks, setStreaks] = useState(null);
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
  // Day picker, opened either to start a pending step or to reschedule a
  // started one. `mode` decides which of the two the confirm handler runs.
  const [daysTarget, setDaysTarget] = useState(null);

  // This panel has no toolbar of its own: TodoScreen's title-bar "+" opens the
  // add-goal modal through this handle while the Goals view is showing.
  useImperativeHandle(addRef, () => ({
    openAdd: () => setAddGoalOpen(true),
  }));

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

  /**
   * Habit streaks for the started steps — the same map the todo builds for its
   * "One Step At A Time" cards, so both views show a habit the same number.
   * A failure leaves it null and simply hides the badges.
   */
  const loadStreaks = useCallback(async () => {
    setStreaks(await fetchOneStepStreaks());
  }, []);

  useEffect(() => {
    loadGoals();
    loadStreaks();
  }, [loadGoals, loadStreaks]);

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
   * "One Step At A Time" header. Start creates the task on the weekdays the
   * user picked (header reused when one exists, created otherwise — same
   * find-or-create pattern as event scheduling) and the habit is kept for
   * life; Pause removes the task and shelves the step. Deleting the task from
   * the todo pauses the step too (see utils/goalSync). */

  const findOneStepHeader = async () => {
    const all = await headersApi.getAll();
    return all.find((h) => isOneStepHeaderName(h.name));
  };

  /** The started step's task under "One Step At A Time", matched by name. */
  const findStepTask = async (stepName) => {
    const header = await findOneStepHeader();
    if (!header) return null;
    const tasks = await tasksApi.getAll(header._id);
    return (
      tasks.find(
        (t) => t.name.trim().toLowerCase() === stepName.trim().toLowerCase(),
      ) || null
    );
  };

  const patchStep = async (goal, stepIndex, patch) => {
    const steps = sortSteps(goal.steps).map((s, i) =>
      i === stepIndex ? { ...s, ...patch } : s,
    );
    // Re-sort so the step joins its new group (a started step rises to the
    // under-progress block, a paused one drops back to the backlog)
    await goalsApi.update(goal._id, { steps: sortSteps(steps) });
  };

  const updateStepStatus = (goal, stepIndex, status) =>
    patchStep(goal, stepIndex, { status });

  /**
   * Begin a step on the chosen weekdays. The task's ECD is set from `days`
   * even when the task already exists, so a re-start can't leave the todo on
   * an older schedule than the goal claims.
   */
  const handleStartStep = async (goal, stepIndex, days) => {
    const step = sortSteps(goal.steps)[stepIndex];
    setBusyStep(`${goal._id}:${stepIndex}`);
    try {
      const header =
        (await findOneStepHeader()) ||
        (await headersApi.create({ name: ONE_STEP_HEADER }));
      const existing = await tasksApi.getAll(header._id);
      const alreadyThere = existing.find(
        (t) => t.name.trim().toLowerCase() === step.name.trim().toLowerCase(),
      );
      if (alreadyThere) {
        await tasksApi.update(alreadyThere._id, { ecd: daysToEcd(days) });
      } else {
        await tasksApi.create({
          name: step.name,
          headerId: header._id,
          notes: `Step towards "${goal.name}"`,
          ecd: daysToEcd(days),
        });
      }
      await patchStep(goal, stepIndex, { status: "under_progress", days });
      await loadGoals();
      setDaysTarget(null);
      setError(null);
      setNotice(
        `Started "${step.name}" — under progress every ${days.join(", ")} in "${ONE_STEP_HEADER}".`,
      );
      onTasksChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyStep(null);
    }
  };

  /**
   * Reschedule a step already under progress: the goal keeps the new days and
   * its task's ECD is rewritten to match, so the streak starts counting the
   * new set from the next nightly archive run.
   */
  const handleChangeDays = async (goal, stepIndex, days) => {
    const step = sortSteps(goal.steps)[stepIndex];
    setBusyStep(`${goal._id}:${stepIndex}`);
    try {
      const task = await findStepTask(step.name);
      if (task) await tasksApi.update(task._id, { ecd: daysToEcd(days) });
      await patchStep(goal, stepIndex, { days });
      await loadGoals();
      setDaysTarget(null);
      setError(null);
      setNotice(
        `"${step.name}" is now due every ${days.join(", ")} — its streak counts those days.`,
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
      const match = await findStepTask(step.name);
      if (match) await tasksApi.remove(match._id);
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
        const match = await findStepTask(step.name);
        if (match) await tasksApi.remove(match._id);
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
    return <LoadingState label="Loading goals…" style={styles.loading} />;
  }

  return (
    <View>
      {error && (
        <Banner
          tone="danger"
          icon="alert"
          onDismiss={() => setError(null)}
          dismissLabel="Dismiss error"
        >
          {`Action failed: ${error}`}
        </Banner>
      )}
      {notice && (
        <Banner
          tone="success"
          icon="checkmark"
          onDismiss={() => setNotice(null)}
          dismissLabel="Dismiss notice"
        >
          {notice}
        </Banner>
      )}

      {goals.map((goal, idx) => {
        // Under-progress steps render above the pending backlog; all step
        // handlers index into this sorted list
        const steps = sortSteps(goal.steps);
        return (
          <GoalCard
            key={goal._id}
            goal={goal}
            isFirst={idx === 0}
            isLast={idx === goals.length - 1}
            onAddStep={() => setAddStepGoal(goal)}
            onMoveGoal={(delta) => handleMoveGoal(goal, delta)}
            onDeleteGoal={() => setDeleteTarget(goal)}
          >
            {steps.map((step, i) => {
              const started = step.status !== "pending";
              const isLast = i === steps.length - 1;
              return (
                <StepRow
                  key={`${step.name}-${i}`}
                  step={step}
                  started={started}
                  isLast={isLast}
                  days={stepDays(step)}
                  streak={streakFor(streaks, step.name)}
                  busy={busyStep === `${goal._id}:${i}`}
                  // Moves stay inside the step's own group — mirrors the
                  // todo's done/undone barrier
                  canMoveUp={
                    i > 0 && (steps[i - 1].status !== "pending") === started
                  }
                  canMoveDown={
                    !isLast && (steps[i + 1].status !== "pending") === started
                  }
                  onToggle={() =>
                    started
                      ? handlePauseStep(goal, i)
                      : setDaysTarget({ goal, index: i, mode: "start" })
                  }
                  onSetDays={() =>
                    setDaysTarget({ goal, index: i, mode: "edit" })
                  }
                  onMoveUp={() => handleMoveStep(goal, i, -1)}
                  onMoveDown={() => handleMoveStep(goal, i, 1)}
                  onDelete={() => setDeleteStepTarget({ goal, index: i })}
                />
              );
            })}
          </GoalCard>
        );
      })}

      {goals.length === 0 && (
        <EmptyState
          compact
          icon="flag-outline"
          title="No goals yet — add one!"
          message={
            'A goal (e.g. "Improve Health") lists the small habits that get you there, built one step at a time: start a step, pick the weekdays it runs on and it\'s under progress — for life — then start the next when it sticks. Its streak counts only those days. Pause anytime to shelve one.'
          }
        />
      )}

      {/* Modals */}
      <GoalModal
        visible={addGoalOpen}
        onConfirm={handleSaveGoal}
        onCancel={() => setAddGoalOpen(false)}
      />

      <StepDaysModal
        visible={!!daysTarget}
        goalName={daysTarget?.goal.name}
        stepName={
          daysTarget
            ? sortSteps(daysTarget.goal.steps)[daysTarget.index].name
            : ""
        }
        initialDays={
          daysTarget
            ? stepDays(sortSteps(daysTarget.goal.steps)[daysTarget.index])
            : undefined
        }
        mode={daysTarget?.mode}
        busy={
          !!daysTarget &&
          busyStep === `${daysTarget.goal._id}:${daysTarget.index}`
        }
        onConfirm={(days) =>
          daysTarget?.mode === "start"
            ? handleStartStep(daysTarget.goal, daysTarget.index, days)
            : handleChangeDays(daysTarget.goal, daysTarget.index, days)
        }
        onCancel={() => setDaysTarget(null)}
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

/**
 * One goal: its full name, the "+" that adds a step and a "⋯" menu for the
 * goal-level actions, then the under-progress summary and the step rows.
 * Deliberately no edit action — a goal is created once and afterwards only
 * its steps change, so GoalModal stays create-only.
 */
function GoalCard({
  goal,
  isFirst,
  isLast,
  onAddStep,
  onMoveGoal,
  onDeleteGoal,
  children,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const total = goal.steps.length;
  // Anything non-pending counts (covers legacy statuses from old data)
  const underProgressCount = goal.steps.filter(
    (s) => s.status !== "pending",
  ).length;
  const progressLabel = `${underProgressCount} of ${total} under progress`;
  const percent = total > 0 ? Math.round((underProgressCount / total) * 100) : 0;

  // Goal order is manual, like todo headers and projects — the server
  // shifts neighbours to stay contiguous.
  const menuActions = [
    {
      key: "up",
      label: "Move up",
      icon: "arrow-up",
      disabled: isFirst,
      onPress: () => onMoveGoal(-1),
    },
    {
      key: "down",
      label: "Move down",
      icon: "arrow-down",
      disabled: isLast,
      onPress: () => onMoveGoal(1),
    },
    {
      key: "delete",
      label: "Delete goal",
      icon: "trash-outline",
      destructive: true,
      onPress: onDeleteGoal,
    },
  ];

  return (
    <>
      <Card padded={false} style={styles.card} testID={`goal-${goal._id}`}>
        <View style={styles.goalHeader}>
          <Text
            style={styles.goalName}
            numberOfLines={2}
            accessibilityRole="header"
          >
            {goal.name}
          </Text>
          <View style={styles.goalActions}>
            {/* Same trailing "+" the todo puts on a header, adding one step
                at a time instead of retyping the whole list. */}
            <IconButton
              icon="add"
              label={`Add step to ${goal.name}`}
              variant="tonal"
              size="sm"
              onPress={onAddStep}
            />
            <IconButton
              icon="ellipsis-horizontal"
              label={`More actions for ${goal.name}`}
              size="sm"
              onPress={() => setMenuOpen(true)}
            />
          </View>
        </View>

        {total > 0 && (
          <View style={styles.progress}>
            <View style={styles.progressRow}>
              <Text style={styles.progressText}>{progressLabel}</Text>
              <Text style={styles.progressPct}>{`${percent}%`}</Text>
            </View>
            <ProgressBar
              value={underProgressCount / total}
              tone="success"
              testID={`goal-${goal._id}-progress`}
            />
          </View>
        )}

        {children}
        {total === 0 && (
          <Text style={styles.noStepsText}>No steps yet — add one!</Text>
        )}
      </Card>

      <ActionSheet
        visible={menuOpen}
        title={goal.name}
        subtitle={total > 0 ? progressLabel : undefined}
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}

/**
 * A step row in TaskCard's shape so the two lists feel identical: checkbox,
 * name, badges in the todo's ECD slot and a "⋯" menu for the rest. Tapping
 * or long-pressing the row opens the same menu — a step has no edit form.
 */
function StepRow({
  step,
  started,
  isLast,
  days,
  streak,
  busy,
  canMoveUp,
  canMoveDown,
  onToggle,
  onSetDays,
  onMoveUp,
  onMoveDown,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const openMenu = () => setMenuOpen(true);
  const schedule = daysLabel(days);
  const status = started ? "Under progress" : "Not started";

  const menuActions = [
    // Only a started step has a schedule to change; a pending one is asked
    // for its days when it starts. The todo can't do it — EditTaskModal
    // locks the ECD of goal-managed tasks, so this is the only way in.
    ...(started
      ? [
          {
            key: "days",
            label: "Set days",
            icon: "calendar-outline",
            disabled: busy,
            onPress: onSetDays,
          },
        ]
      : []),
    {
      key: "up",
      label: "Move up",
      icon: "arrow-up",
      disabled: busy || !canMoveUp,
      onPress: onMoveUp,
    },
    {
      key: "down",
      label: "Move down",
      icon: "arrow-down",
      disabled: busy || !canMoveDown,
      onPress: onMoveDown,
    },
    {
      key: "delete",
      label: "Delete step",
      icon: "trash-outline",
      destructive: true,
      disabled: busy,
      onPress: onDelete,
    },
  ];

  return (
    <>
      {/* Checkbox, body and "⋯" are siblings so each is its own
          screen-reader stop; the whole row highlights while the body is
          pressed. */}
      <View
        style={[
          styles.stepRow,
          isLast && styles.stepRowLast,
          pressed && styles.stepRowPressed,
        ]}
      >
        {/* Checkbox drives the step lifecycle: checked = under progress.
            Deliberately no done styling — a started step is active, not
            finished. */}
        <Checkbox
          checked={started}
          label={started ? `Pause "${step.name}"` : `Start "${step.name}"`}
          onPress={onToggle}
          disabled={busy}
          style={styles.checkbox}
        />

        <Pressable
          onPress={openMenu}
          onLongPress={openMenu}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityRole="button"
          accessibilityLabel={`${step.name}, ${status}${
            started ? `, ${schedule}` : ""
          }`}
          accessibilityHint="Opens the actions for this step."
          style={styles.stepBody}
        >
          <Text style={styles.stepName} numberOfLines={2}>
            {step.name}
          </Text>
          {/* Same slot the todo uses for the ECD badge. A started step is a
              recurring task there, so it gets the same day list its task
              card shows. */}
          <View style={styles.metaRow}>
            <Badge label={status} tone={started ? "success" : "neutral"} />
            {started && (
              <Badge label={schedule} icon="calendar-outline" tone="neutral" />
            )}
            {/* Streak over the step's own days — a habit set to Mon/Wed/Fri
                isn't broken by an untouched Tuesday, because no result is
                archived for a day the task wasn't due. Same badge and
                wording TaskCard shows on the habit in the todo. */}
            {started && streak && (
              <Badge
                label={String(streak.current)}
                icon="flame"
                tone="accent"
                outline
                accessibilityLabel={`Current streak: ${streak.current} scheduled ${
                  streak.current === 1 ? "day" : "days"
                } in a row (best ${streak.longest}), counting only ${schedule}`}
              />
            )}
          </View>
        </Pressable>

        <IconButton
          icon="ellipsis-horizontal"
          label={`More actions for ${step.name}`}
          onPress={openMenu}
          size="sm"
          style={styles.more}
        />
      </View>

      <ActionSheet
        visible={menuOpen}
        title={step.name}
        subtitle={started ? `${status} · ${schedule}` : status}
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 0,
    paddingVertical: spacing.xxxl,
  },
  card: {
    marginBottom: spacing.lg,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },
  goalName: {
    ...type.headline,
    flex: 1,
  },
  goalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  progress: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs + 2,
  },
  progressText: {
    ...type.footnote,
    flex: 1,
  },
  progressPct: {
    ...type.caption,
    color: colors.successText,
  },
  /* Step rows mirror the todo's TaskCard (square checkbox, badges in the
     ECD slot, trailing "⋯") so the two lists feel identical. */
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.xs,
    paddingRight: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  stepRowLast: {
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
  stepRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  checkbox: {
    marginLeft: spacing.xs,
  },
  stepBody: {
    flex: 1,
    paddingVertical: spacing.md - 1,
    paddingRight: spacing.xs,
  },
  stepName: {
    ...type.callout,
    fontWeight: "500",
    lineHeight: 21,
  },
  /* Status, schedule and streak sit together in the todo's ECD slot */
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs + 2,
    marginTop: spacing.xs + 2,
  },
  more: {
    marginTop: spacing.xs + 2,
  },
  noStepsText: {
    ...type.footnote,
    fontStyle: "italic",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
});
