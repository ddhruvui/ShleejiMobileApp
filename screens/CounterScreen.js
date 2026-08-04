import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const STORAGE_KEY = "clickCount";
const MADA_STORAGE_KEY = "madaCount";

export default function CounterScreen() {
  const [clicks, setClicks] = useState(0);
  const [mada, setMada] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved click count and mada count on mount
  useEffect(() => {
    (async () => {
      try {
        const [savedClicks, savedMada] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(MADA_STORAGE_KEY),
        ]);
        if (savedClicks !== null) {
          setClicks(parseInt(savedClicks, 10));
        }
        if (savedMada !== null) {
          setMada(parseInt(savedMada, 10));
        }
      } catch (e) {
        console.error("Failed to load counts", e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Persist click count and mada count whenever they change (after initial load)
  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY, clicks.toString()).catch((e) =>
        console.error("Failed to save click count", e),
      );
    }
  }, [clicks, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(MADA_STORAGE_KEY, mada.toString()).catch((e) =>
        console.error("Failed to save mada count", e),
      );
    }
  }, [mada, isLoaded]);

  const handleTap = useCallback(() => {
    setClicks((prev) => {
      const next = prev + 1;
      if (next >= 108) {
        setMada((m) => m + 1);
        return 0;
      }
      return next;
    });
  }, []);

  const handleAddPress = useCallback(() => {
    setAddInput("");
    setAddModalVisible(true);
  }, []);

  const handleConfirmAdd = useCallback(() => {
    const num = parseInt(addInput, 10);
    if (isNaN(num) || num <= 0) {
      setAddModalVisible(false);
      return;
    }
    setClicks((prevClicks) => {
      const totalClicks = prevClicks + num;
      const extraMada = Math.floor(totalClicks / 108);
      const remainingClicks = totalClicks % 108;
      if (extraMada > 0) {
        setMada((m) => m + extraMada);
      }
      return remainingClicks;
    });
    setAddModalVisible(false);
  }, [addInput]);

  const handleCancelAdd = useCallback(() => {
    setAddModalVisible(false);
  }, []);

  const handleResetPress = useCallback(() => {
    setModalVisible(true);
  }, []);

  const handleConfirmReset = useCallback(() => {
    setClicks(0);
    setMada(0);
    setModalVisible(false);
  }, []);

  const handleCancelReset = useCallback(() => {
    setModalVisible(false);
  }, []);

  if (!isLoaded) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ fontSize: 18, color: "#888" }}>Loading…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ─── Header: count + reset ─── */}
      <View style={styles.header}>
        <View style={styles.countersRow}>
          <View style={styles.countWrapper}>
            <Text style={styles.label}>CLICKS</Text>
            <Text style={styles.count}>{clicks}</Text>
          </View>
          <View style={styles.countWrapper}>
            <Text style={styles.label}>MADA</Text>
            <Text style={styles.count}>{mada}</Text>
          </View>
        </View>

        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleResetPress}
            activeOpacity={0.7}
          >
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleAddPress}
            activeOpacity={0.7}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Trackpad: tap anywhere to increment ─── */}
      <TouchableOpacity
        style={styles.trackpad}
        onPress={handleTap}
        activeOpacity={0.85}
      >
        <Text style={styles.trackpadHint}>Tap anywhere to count</Text>
      </TouchableOpacity>

      {/* ─── Reset confirmation modal ─── */}
      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={handleCancelReset}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Reset Counter?</Text>
            <Text style={styles.modalBody}>
              This will reset both your click and mada counts to 0. Are you
              sure?
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={handleCancelReset}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={handleConfirmReset}
              >
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Add number modal ─── */}
      <Modal
        animationType="fade"
        transparent
        visible={addModalVisible}
        onRequestClose={handleCancelAdd}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Count</Text>
            <Text style={styles.modalBody}>
              Enter a number to add. Every 108 will count as 1 mada.
            </Text>
            <TextInput
              style={styles.addInput}
              keyboardType="number-pad"
              placeholder="e.g. 217"
              placeholderTextColor="#aaa"
              value={addInput}
              onChangeText={setAddInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={handleCancelAdd}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.confirmBtn,
                  { backgroundColor: "#1e88e5" },
                ]}
                onPress={handleConfirmAdd}
              >
                <Text style={styles.confirmBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },

  /* Header */
  header: {
    backgroundColor: "#1e88e5",
    paddingTop: 54,
    paddingBottom: 28,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  countersRow: {
    flexDirection: "row",
    gap: 32,
    flexShrink: 1,
  },
  countWrapper: {
    flexShrink: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  count: {
    fontSize: 56,
    fontWeight: "800",
    color: "#fff",
  },
  resetBtn: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  resetBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e88e5",
  },

  /* Header buttons */
  headerButtons: {
    gap: 10,
    alignItems: "stretch",
  },
  addBtn: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e88e5",
  },
  addInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    color: "#222",
    marginBottom: 20,
    textAlign: "center",
  },

  /* Trackpad */
  trackpad: {
    flex: 1,
    margin: 16,
    marginBottom: 120,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#1e88e5",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  trackpadHint: {
    fontSize: 18,
    color: "#aaa",
    fontWeight: "500",
  },

  /* Modal */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: "82%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: "#e0e0e0",
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  confirmBtn: {
    backgroundColor: "#e53935",
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
