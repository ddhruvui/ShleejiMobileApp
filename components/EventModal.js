import React, { useState, useRef, useEffect } from "react";
import { Sheet, SheetActions, Button, TextField } from "./ui";

/**
 * Add/edit sheet for an event template (a reusable bundle of tasks).
 *
 * - `event` undefined → add mode
 * - `event` set       → edit mode (pre-filled)
 *
 * Tasks are typed one per line; blank lines are dropped and the order is
 * kept, since scheduling later creates the tasks in exactly this order.
 * onConfirm receives { name, tasks }.
 */
export default function EventModal({ visible, event, onConfirm, onCancel }) {
  const [name, setName] = useState("");
  const [tasksText, setTasksText] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setName(event?.name || "");
      setTasksText(event ? event.tasks.join("\n") : "");
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [visible, event]);

  const parsedTasks = tasksText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || parsedTasks.length === 0) return;
    onConfirm({ name: trimmed, tasks: parsedTasks });
  }

  const disabled = !name.trim() || parsedTasks.length === 0;

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={event ? "Edit event" : "Add event"}
      subtitle="A reusable bundle of tasks you can drop into your todo"
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
            title={event ? "Save" : "Add event"}
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
        label="Event name"
        placeholder="e.g. Burger Night"
        value={name}
        onChangeText={setName}
        returnKeyType="next"
      />
      <TextField
        label="Tasks"
        placeholder={"One task per line…\nProcure onion\nProcure bun"}
        value={tasksText}
        onChangeText={setTasksText}
        multiline
        minHeight={140}
        helper={`One task per line — ${parsedTasks.length} task${
          parsedTasks.length === 1 ? "" : "s"
        }`}
      />
    </Sheet>
  );
}
