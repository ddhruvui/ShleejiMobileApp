import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as callsApi from "../api/calls";
import CallModal from "../components/CallModal";
import ConfirmModal from "../components/ConfirmModal";

const SECTIONS = [
  { frequency: "biweekly", title: "Biweekly" },
  { frequency: "monthly", title: "Monthly" },
];

export default function CallsScreen() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // null = closed, { mode: "add" } or { mode: "edit", call }
  const [modalState, setModalState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  /* ── Load all calls ── */
  const loadAll = useCallback(async () => {
    try {
      const all = await callsApi.getAll();
      setCalls(all);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

  /* ── CRUD (no optimistic updates: mutate via API, then refetch) ── */

  const handleSave = async ({ name, frequency }) => {
    const target = modalState?.mode === "edit" ? modalState.call : null;
    try {
      if (target) {
        await callsApi.update(target._id, { name, frequency });
      } else {
        await callsApi.create({ name, frequency });
      }
      await loadAll();
      setModalState(null);
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
      setModalState(null);
    }
  };

  const handleToggleCalled = async (call) => {
    try {
      await callsApi.update(call._id, { done: !call.done });
      await loadAll();
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    try {
      await callsApi.remove(target._id);
      await loadAll();
      setDeleteTarget(null);
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
      setDeleteTarget(null);
    }
  };

  /* ── Render ── */

  const renderCallRow = (call) => (
    <View key={call._id} style={[styles.row, call.done && styles.rowDone]}>
      <TouchableOpacity
        style={[styles.checkbox, call.done && styles.checkboxChecked]}
        onPress={() => handleToggleCalled(call)}
      >
        {call.done && <Ionicons name="checkmark" size={14} color="#fff" />}
      </TouchableOpacity>

      <Text
        style={[styles.name, call.done && styles.nameDone]}
        numberOfLines={2}
      >
        {call.name}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setModalState({ mode: "edit", call })}
        >
          <Ionicons name="pencil" size={16} color="#656d76" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setDeleteTarget(call)}
        >
          <Ionicons name="trash-outline" size={16} color="#e74c3c" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1e88e5" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#e74c3c" />
          <Text style={styles.errorTextLarge}>Failed to load: {error}</Text>
          <Text style={styles.errorHint}>Is the backend running?</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadAll}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (calls.length === 0 && !actionError) {
      return (
        <View style={styles.centered}>
          <Ionicons name="call-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>No calls yet</Text>
          <Text style={styles.emptySubtext}>
            Tap the + button to add someone to ring biweekly or monthly
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {actionError && (
          <View style={styles.actionErrorBar}>
            <Text style={styles.actionErrorText}>
              Action failed: {actionError}
            </Text>
            <TouchableOpacity onPress={() => setActionError(null)}>
              <Ionicons name="close" size={18} color="#e74c3c" />
            </TouchableOpacity>
          </View>
        )}

        {SECTIONS.map(({ frequency, title }) => {
          const sectionCalls = calls.filter((c) => c.frequency === frequency);
          return (
            <View key={frequency} style={styles.section}>
              <Text style={styles.sectionTitle}>{title}</Text>
              {sectionCalls.length === 0 ? (
                <Text style={styles.sectionEmpty}>No one yet</Text>
              ) : (
                <View style={styles.sectionCard}>
                  {sectionCalls.map(renderCallRow)}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calls</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalState({ mode: "add" })}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {renderBody()}

      <CallModal
        visible={modalState !== null}
        call={modalState?.mode === "edit" ? modalState.call : null}
        onConfirm={handleSave}
        onCancel={() => setModalState(null)}
      />

      <ConfirmModal
        visible={deleteTarget !== null}
        message={`Delete call "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 28,
    backgroundColor: "#1e88e5",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
  },
  addButton: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e88e5",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    paddingBottom: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#656d76",
  },
  errorTextLarge: {
    marginTop: 12,
    fontSize: 16,
    color: "#e74c3c",
    textAlign: "center",
  },
  errorHint: {
    marginTop: 4,
    fontSize: 14,
    color: "#999",
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#1e88e5",
  },
  retryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  emptyText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#999",
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#bbb",
    marginTop: 8,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  actionErrorBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fde8e8",
  },
  actionErrorText: {
    fontSize: 13,
    color: "#e74c3c",
    flex: 1,
    marginRight: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2328",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionEmpty: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
    backgroundColor: "#fff",
  },
  rowDone: {
    opacity: 0.6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d0d7de",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#6200ee",
    borderColor: "#6200ee",
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#1f2328",
    marginRight: 8,
  },
  nameDone: {
    textDecorationLine: "line-through",
    color: "#656d76",
  },
  actions: {
    flexDirection: "row",
    gap: 2,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 6,
  },
});
