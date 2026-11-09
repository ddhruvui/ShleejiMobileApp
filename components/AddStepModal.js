import React, { useState, useRef, useEffect } from "react";
import { Sheet, SheetActions, Button, TextField } from "./ui";

/**
 * Adds one step to a goal's backlog — the goals-side equivalent of adding a
 * task to a header, and deliberately shaped like HeaderModal/AddTaskModal so
 * the gesture matches the todo. A step carries no due date of its own:
 * starting it is what creates the daily task.
 */
export default function AddStepModal({
  visible,
  goalName,
  busy,
  onConfirm,
  onCancel,
}) {
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setName("");
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [visible]);

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title="Add step"
      subtitle={goalName || undefined}
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
            title="Add step"
            size="lg"
            onPress={handleSubmit}
            disabled={!name.trim()}
            loading={!!busy}
            style={{ flex: 2 }}
          />
        </SheetActions>
      }
    >
      <TextField
        ref={inputRef}
        label="Step name"
        placeholder="e.g. Wake up at 6"
        value={name}
        onChangeText={setName}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
        helper="Added to the backlog. Start it later to make it a daily habit."
      />
    </Sheet>
  );
}
