import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as affirmationsApi from "../api/affirmations";
import AffirmationModal from "../components/AffirmationModal";

export default function AffirmationsScreen() {
  const [affirmations, setAffirmations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // null = closed, { mode: "add" } or { mode: "edit", affirmation }
  const [modalState, setModalState] = useState(null);

  /* ── Load all affirmations ── */
  const loadAll = useCallback(async () => {
    try {
      const all = await affirmationsApi.getAll();
      setAffirmations(all);
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

  /* ── CRUD ── */

  const handleAdd = async (name) => {
    try {
      const created = await affirmationsApi.create({ name });
      setAffirmations((prev) => [...prev, created]);
      setModalState(null);
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
      setModalState(null);
    }
  };

  const handleEdit = async (name) => {
    const target = modalState?.affirmation;
    if (!target) return;
    try {
      const updated = await affirmationsApi.update(target._id, { name });
      setAffirmations((prev) =>
        prev.map((a) => (a._id === updated._id ? updated : a)),
      );
      setModalState(null);
      setActionError(null);
    } catch (err) {
      setActionError(err.message);
      setModalState(null);
    }
  };

  const handleDelete = () => {
    const target = modalState?.affirmation;
    if (!target) return;
    Alert.alert(
      "Delete Affirmation",
      `Are you sure you want to delete "${target.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await affirmationsApi.remove(target._id);
              setAffirmations((prev) =>
                prev.filter((a) => a._id !== target._id),
              );
              setModalState(null);
              setActionError(null);
            } catch (err) {
              setActionError(err.message);
              setModalState(null);
            }
          },
        },
      ],
    );
  };

  /* ── Render ── */

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

    if (affirmations.length === 0 && !actionError) {
      return (
        <View style={styles.centered}>
          <Ionicons name="heart-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>No affirmations yet</Text>
          <Text style={styles.emptySubtext}>
            Tap the + button to add one to read daily
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

        {affirmations.map((affirmation) => (
          <TouchableOpacity
            key={affirmation._id}
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => setModalState({ mode: "edit", affirmation })}
          >
            <Text style={styles.cardText}>{affirmation.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Affirmations</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalState({ mode: "add" })}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {renderBody()}

      <AffirmationModal
        visible={modalState !== null}
        affirmation={modalState?.mode === "edit" ? modalState.affirmation : null}
        onConfirm={modalState?.mode === "edit" ? handleEdit : handleAdd}
        onDelete={handleDelete}
        onCancel={() => setModalState(null)}
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
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardText: {
    fontSize: 19,
    lineHeight: 28,
    fontWeight: "500",
    color: "#1f2328",
  },
});
