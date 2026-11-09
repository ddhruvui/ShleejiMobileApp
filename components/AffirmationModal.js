import React, { useState, useRef, useEffect } from "react";
import { Sheet, SheetActions, Button, IconButton, TextField } from "./ui";

/**
 * Dual-purpose add/edit sheet for affirmations.
 *
 * - `affirmation` null  → add mode
 * - `affirmation` set   → edit mode (pre-filled, shows Delete)
 */
export default function AffirmationModal({
  visible,
  affirmation,
  onConfirm,
  onDelete,
  onCancel,
}) {
  const [name, setName] = useState("");
  const nameRef = useRef(null);

  const isEdit = affirmation != null;

  useEffect(() => {
    if (visible) {
      setName(affirmation ? affirmation.name : "");
      setTimeout(() => nameRef.current?.focus(), 250);
    }
  }, [visible]);

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={isEdit ? "Edit affirmation" : "Add affirmation"}
      subtitle={isEdit ? undefined : "A short line to read every day"}
      headerRight={
        isEdit ? (
          <IconButton
            icon="trash-outline"
            label="Delete affirmation"
            variant="danger"
            onPress={onDelete}
          />
        ) : null
      }
      footer={
        <SheetActions>
          <Button title="Cancel" variant="secondary" size="lg" onPress={onCancel} style={{ flex: 1 }} />
          <Button
            title={isEdit ? "Save" : "Add"}
            size="lg"
            onPress={handleConfirm}
            disabled={!name.trim()}
            style={{ flex: 2 }}
          />
        </SheetActions>
      }
    >
      <TextField
        ref={nameRef}
        label="Affirmation"
        placeholder="I am calm and focused"
        value={name}
        onChangeText={setName}
        multiline
        minHeight={96}
        inputStyle={{ fontSize: 18, lineHeight: 26 }}
      />
    </Sheet>
  );
}
