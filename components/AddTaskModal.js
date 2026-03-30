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

function todayInputVal() {
  return new Date().toISOString().slice(0, 10);
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
      setTimeout(() => nameRef.current?.focus(), 100);
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
                <Text style={styles.title}>
                  Add task{" "}
                  <Text style={styles.titleFolder}>— {headerName}</Text>
                </Text>

                {formError && <Text style={styles.errorText}>{formError}</Text>}

                <TextInput
                  ref={nameRef}
                  style={styles.nameInput}
                  placeholder="Task name…"
                  placeholderTextColor="#999"
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

                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notes (optional)…"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmBtn,
                      !name.trim() && styles.disabledBtn,
                    ]}
                    onPress={handleAdd}
                    disabled={!name.trim()}
                  >
                    <Text style={styles.confirmText}>Add task</Text>
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
    marginBottom: 16,
  },
  titleFolder: {
    fontWeight: "400",
    color: "#656d76",
    fontSize: 15,
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 13,
    marginBottom: 10,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2328",
    marginBottom: 16,
    backgroundColor: "#fafafa",
  },
  notesInput: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1f2328",
    minHeight: 80,
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
  disabledBtn: {
    opacity: 0.5,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
