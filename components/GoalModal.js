import React, { useState, useRef, useEffect } from "react";
import { Sheet, SheetActions, Button, TextField } from "./ui";

/**
 * Creates a goal: a name plus its starting backlog, one step per line. The
 * Goals panel only ever opens it to add — goals have no edit pencil, so a
 * goal can't be renamed after creation — but the `goal` prop is kept so the
 * form still reads correctly if it is ever given an existing goal.
 */
export default function GoalModal({ visible, goal, onConfirm, onCancel }) {
  const [name, setName] = useState("");
  const [stepsText, setStepsText] = useState("");
  const inputRef = useRef(null);
  const stepsRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setName(goal?.name || "");
      setStepsText(goal ? goal.steps.map((s) => s.name).join("\n") : "");
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [visible, goal]);

  const parsedSteps = stepsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm({ name: trimmed, stepNames: parsedSteps });
  }

  const disabled = !name.trim();
  const hint = `One step per line, in the order you want to build them — ${
    parsedSteps.length
  } step${parsedSteps.length === 1 ? "" : "s"}${
    goal ? ". Steps keeping their name keep their progress." : ""
  }`;

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={goal ? "Edit goal" : "Add goal"}
      subtitle={goal ? undefined : "A long-term aim, built one small step at a time"}
      footer={
        <SheetActions>
          <Button
            title="Cancel"
            variant="secondary"
            size="lg"
            onPress={onCancel}
            style={{ flex: 1 }}
          />
          <Button
            title={goal ? "Save" : "Add"}
            size="lg"
            onPress={handleSubmit}
            disabled={disabled}
            style={{ flex: 2 }}
          />
        </SheetActions>
      }
    >
      <TextField
        ref={inputRef}
        label="Goal name"
        placeholder="e.g. Improve Health"
        value={name}
        onChangeText={setName}
        returnKeyType="next"
        onSubmitEditing={() => stepsRef.current?.focus()}
      />
      <TextField
        ref={stepsRef}
        label="Steps"
        placeholder={"One small step per line…\nWake up at 6\nHave 1 fruit a day"}
        value={stepsText}
        onChangeText={setStepsText}
        multiline
        minHeight={132}
        helper={hint}
      />
    </Sheet>
  );
}
