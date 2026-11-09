import React, { useState, useRef, useEffect } from "react";
import { Sheet, SheetActions, Button, TextField } from "./ui";

export default function ProjectModal({
  visible,
  projectName,
  onConfirm,
  onCancel,
}) {
  const [name, setName] = useState(projectName || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setName(projectName || "");
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [visible, projectName]);

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={projectName ? "Edit project" : "Add project"}
      subtitle={
        projectName
          ? "Its todo header, if it has one, is renamed too"
          : "A long term effort and the steps that get it done"
      }
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
            title={projectName ? "Save" : "Add"}
            size="lg"
            onPress={handleSubmit}
            disabled={!name.trim()}
            style={{ flex: 2 }}
          />
        </SheetActions>
      }
    >
      <TextField
        ref={inputRef}
        label="Project name"
        placeholder="Project name…"
        value={name}
        onChangeText={setName}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
      />
    </Sheet>
  );
}
