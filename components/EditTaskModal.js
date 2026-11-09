import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import EcdPicker, { formatDateToISO } from "./EcdPicker";
import { Sheet, SheetActions, Button, TextField, FieldLabel } from "./ui";
import { buildEcdFromInputs, isPushedLater } from "../utils/ecd";
import { colors, radii, spacing, type } from "../theme";

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function detectInitialState(ecd) {
  const today = new Date();
  const defaults = {
    mode: "none",
    dateVal: formatDateToISO(today), // local date, not UTC
    dowVal: ["Mon"],
    domVal: [1],
    yearVal: `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`,
  };

  if (!ecd) return defaults;

  switch (ecd.type) {
    case "date":
      return { ...defaults, mode: "date", dateVal: ecd.value };
    case "day_of_week":
      return { ...defaults, mode: "week", dowVal: ecd.value };
    case "day_of_month":
      return { ...defaults, mode: "month", domVal: ecd.value };
    case "day_of_year":
      return { ...defaults, mode: "year", yearVal: ecd.value };
    default:
      return defaults;
  }
}

export default function EditTaskModal({
  visible,
  taskName,
  notes,
  createdAt,
  updatedAt,
  ecd,
  // Habit owned by a goal (under "One Step At A Time"). The goal links to
  // this task by name and owns its weekday schedule, so name and ECD are
  // locked — only notes stay editable.
  goalManaged,
  onConfirm,
  onCancel,
}) {
  const initial = detectInitialState(ecd);
  const [nameDraft, setNameDraft] = useState(taskName || "");
  const [draft, setDraft] = useState(notes || "");
  const [mode, setMode] = useState(initial.mode);
  const [dateVal, setDateVal] = useState(initial.dateVal);
  const [dowVal, setDowVal] = useState(initial.dowVal);
  const [domVal, setDomVal] = useState(initial.domVal);
  const [yearVal, setYearVal] = useState(initial.yearVal);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (visible) {
      const init = detectInitialState(ecd);
      setNameDraft(taskName || "");
      setDraft(notes || "");
      setMode(init.mode);
      setDateVal(init.dateVal);
      setDowVal(init.dowVal);
      setDomVal(init.domVal);
      setYearVal(init.yearVal);
      setReason("");
      setFormError(null);
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [visible, taskName, notes, ecd]);

  // A postpone: the currently-selected inputs push the original one-time date
  // later. Detected live so the optional reason field can appear inline.
  const { ecd: previewEcd } = buildEcdFromInputs({
    mode,
    dateVal,
    dowVal: [...dowVal],
    domVal: [...domVal],
    yearVal,
  });
  const isPostpone = isPushedLater(ecd, previewEcd);

  // Read-only schedule line for a goal-managed habit. The full week reads as
  // "Every day"; anything narrower lists the days the goal started it on.
  const goalSchedule =
    ecd && ecd.type === "day_of_week" && ecd.value.length < 7
      ? ecd.value.join(", ")
      : "Every day";

  function handleSave() {
    // Goal-managed tasks save notes only — name and ecd pass through
    // unchanged so the goal's name-based link can never drift.
    if (goalManaged) {
      onConfirm({ name: taskName, notes: draft, ecd });
      return;
    }

    const trimmedName = nameDraft.trim();
    if (!trimmedName) {
      setFormError("Task name is required.");
      return;
    }

    const { ecd: newEcd, error } = buildEcdFromInputs({
      mode,
      dateVal,
      dowVal: [...dowVal],
      domVal: [...domVal],
      yearVal,
    });
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);

    // Attach the reason only for an actual postpone with a non-blank reason;
    // the backend treats a reason-less postpone as procrastination.
    const trimmedReason = reason.trim();
    const includeReason = isPushedLater(ecd, newEcd) && trimmedReason !== "";
    onConfirm({
      name: trimmedName,
      notes: draft,
      ecd: newEcd,
      ...(includeReason ? { reason: trimmedReason } : {}),
    });
  }

  const meta =
    createdAt && updatedAt
      ? `Created ${formatDate(createdAt)} · Updated ${formatDate(updatedAt)}`
      : undefined;

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title="Edit task"
      subtitle={meta}
      footer={
        <SheetActions>
          <Button title="Cancel" variant="secondary" size="lg" onPress={onCancel} style={{ flex: 1 }} />
          <Button title="Save" size="lg" onPress={handleSave} style={{ flex: 2 }} />
        </SheetActions>
      }
    >
      {formError && <Text style={styles.errorText}>{formError}</Text>}

      <TextField
        label="Task name"
        value={nameDraft}
        onChangeText={setNameDraft}
        placeholder="Task name"
        editable={!goalManaged}
        helper={
          goalManaged
            ? "Habit managed by its goal — name and schedule are locked. Change its days in the Goals view."
            : undefined
        }
      />

      {goalManaged ? (
        <View style={styles.lockedWrap}>
          <FieldLabel>Due</FieldLabel>
          <View style={styles.lockedEcd}>
            <Ionicons name="lock-closed" size={14} color={colors.successText} />
            <Text style={styles.lockedEcdText}>↻ {goalSchedule}, for life</Text>
          </View>
        </View>
      ) : (
        <EcdPicker
          mode={mode}
          setMode={setMode}
          dateVal={dateVal}
          setDateVal={setDateVal}
          dowVal={dowVal}
          setDowVal={setDowVal}
          domVal={domVal}
          setDomVal={setDomVal}
          yearVal={yearVal}
          setYearVal={setYearVal}
        />
      )}

      {isPostpone && (
        <View style={styles.postpone}>
          <TextField
            label="Why postpone? (optional)"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. blocked on a dependency, sick, real emergency…"
            multiline
            minHeight={64}
            helper="No reason is logged as procrastination; a valid one counts as a legitimate deferral."
            style={{ marginBottom: 0 }}
          />
        </View>
      )}

      <TextField
        ref={textareaRef}
        label="Notes"
        value={draft}
        onChangeText={setDraft}
        placeholder="Add notes…"
        multiline
        minHeight={100}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  errorText: {
    ...type.footnote,
    color: colors.dangerText,
    backgroundColor: colors.dangerSoft,
    padding: spacing.sm + 2,
    borderRadius: 10,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  lockedWrap: {
    marginBottom: spacing.lg,
  },
  lockedEcd: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  lockedEcdText: {
    ...type.callout,
    color: colors.successText,
  },
  postpone: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
});
