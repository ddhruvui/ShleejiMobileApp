import React, { useState, useRef, useEffect } from "react";
import { Sheet, SheetActions, Button, TextField, FieldLabel, SegmentedControl } from "./ui";

const FREQUENCIES = [
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
];

/**
 * Dual-purpose add/edit sheet for calls (people to ring).
 *
 * - `call` null  → add mode
 * - `call` set   → edit mode (pre-filled)
 *
 * onConfirm receives { name, frequency }.
 */
export default function CallModal({ visible, call, onConfirm, onCancel }) {
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("biweekly");
  const nameRef = useRef(null);

  const isEdit = call != null;

  useEffect(() => {
    if (visible) {
      setName(call ? call.name : "");
      setFrequency(call ? call.frequency : "biweekly");
      setTimeout(() => nameRef.current?.focus(), 250);
    }
  }, [visible]);

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm({ name: trimmed, frequency });
  }

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={isEdit ? "Edit call" : "Add call"}
      subtitle={isEdit ? undefined : "Someone to ring every cycle"}
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
        label="Person to call"
        placeholder="Grandma"
        value={name}
        onChangeText={setName}
        returnKeyType="done"
      />
      <FieldLabel>How often</FieldLabel>
      <SegmentedControl
        options={FREQUENCIES}
        value={frequency}
        onChange={setFrequency}
        style={{ marginBottom: 16 }}
      />
    </Sheet>
  );
}
