import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import EcdPicker from "./EcdPicker";
import { buildEcdFromInputs } from "../utils/ecd";

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
    dateVal: today.toISOString().slice(0, 10),
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
      setFormError(null);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [visible, taskName, notes, ecd]);

  function handleSave() {
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
    onConfirm({ name: trimmedName, notes: draft, ecd: newEcd });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modal}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>{taskName}</Text>

                <TextInput
                  style={styles.nameInput}
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  placeholder="Task name"
                  placeholderTextColor="#999"
                />

                {formError && <Text style={styles.errorText}>{formError}</Text>}

                {createdAt && updatedAt && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      <Text style={styles.metaLabel}>Created </Text>
                      {formatDate(createdAt)}
                    </Text>
                    <Text style={styles.metaSep}> · </Text>
                    <Text style={styles.metaText}>
                      <Text style={styles.metaLabel}>Updated </Text>
                      {formatDate(updatedAt)}
                    </Text>
                  </View>
                )}

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

                <TextInput
                  ref={textareaRef}
                  style={styles.notesInput}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Add notes…"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={handleSave}
                  >
                    <Text style={styles.confirmText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  keyboardView: {
    width: "100%",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: 360,
    maxWidth: "95%",
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2328",
    marginBottom: 12,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2328",
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 13,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  metaText: {
    fontSize: 12,
    color: "#656d76",
  },
  metaLabel: {
    fontWeight: "600",
  },
  metaSep: {
    color: "#656d76",
    fontSize: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1f2328",
    minHeight: 100,
    backgroundColor: "#fafafa",
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
  },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#6200ee",
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
