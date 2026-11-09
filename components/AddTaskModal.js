import React, { useState, useRef, useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import EcdPicker, { formatDateToISO } from "./EcdPicker";
import { Sheet, SheetActions, Button, TextField } from "./ui";
import { buildEcdFromInputs } from "../utils/ecd";
import { colors, spacing, type } from "../theme";

function todayInputVal() {
  // Local calendar date — toISOString() is UTC and reads as tomorrow in the evening
  return formatDateToISO(new Date());
}

function todayDMY() {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function AddTaskModal({
  visible,
  headerName,
  onConfirm,
  onCancel,
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState("none");
  const [dateVal, setDateVal] = useState(todayInputVal);
  const [dowVal, setDowVal] = useState(["Mon"]);
  const [domVal, setDomVal] = useState([1]);
  const [yearVal, setYearVal] = useState(todayDMY());
  const [formError, setFormError] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setName("");
      setNotes("");
      setMode("none");
      setDateVal(todayInputVal());
      setDowVal(["Mon"]);
      setDomVal([1]);
      setYearVal(todayDMY());
      setFormError(null);
      setTimeout(() => nameRef.current?.focus(), 250);
    }
  }, [visible]);

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;

    const { ecd, error } = buildEcdFromInputs({
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
    onConfirm({ name: trimmed, notes, ecd });
  }

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title="Add task"
      subtitle={headerName ? `in ${headerName}` : undefined}
      footer={
        <SheetActions>
          <Button title="Cancel" variant="secondary" size="lg" onPress={onCancel} style={{ flex: 1 }} />
          <Button
            title="Add task"
            size="lg"
            onPress={handleAdd}
            disabled={!name.trim()}
            style={{ flex: 2 }}
          />
        </SheetActions>
      }
    >
      {formError && <Text style={styles.errorText}>{formError}</Text>}

      <TextField
        ref={nameRef}
        label="Task name"
        placeholder="Draft OKRs for Q1"
        value={name}
        onChangeText={setName}
        returnKeyType="next"
      />

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

      <TextField
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        multiline
        minHeight={88}
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
});
