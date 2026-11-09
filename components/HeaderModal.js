import React, { useState, useRef, useEffect } from "react";
import { Sheet, SheetActions, Button, TextField } from "./ui";

export default function HeaderModal({
  visible,
  headerName,
  onConfirm,
  onCancel,
}) {
  const [name, setName] = useState(headerName || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setName(headerName || "");
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [visible, headerName]);

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  const editing = !!headerName;

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={editing ? "Rename header" : "Add header"}
      subtitle={editing ? undefined : "A group for related tasks"}
      footer={
        <SheetActions>
          <Button title="Cancel" variant="secondary" size="lg" onPress={onCancel} style={{ flex: 1 }} />
          <Button
            title={editing ? "Save" : "Add header"}
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
        label="Header name"
        placeholder="Work"
        value={name}
        onChangeText={setName}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
      />
    </Sheet>
  );
}
