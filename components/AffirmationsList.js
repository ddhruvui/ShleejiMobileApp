import React, { useState, useEffect, useCallback, useImperativeHandle } from "react";
import { StyleSheet, Text, Pressable, Alert, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as affirmationsApi from "../api/affirmations";
import AffirmationModal from "./AffirmationModal";
import { Banner, Button, EmptyState, SkeletonList } from "./ui";
import { colors, radii, spacing, tints, type } from "../theme";

/**
 * Daily affirmations (backend `/affirmations`, synced with the web app):
 * tinted cards to read every day; tap one to edit or delete it. Renders inline
 * (no ScrollView of its own) so the Dream tab can stack it under the board.
 *
 * `addRef.current` exposes `openAdd()` (the tab's "+" reaches in through it)
 * and `reload()` (pull-to-refresh; resolves when the list has reloaded).
 * `onCountChange(n)` reports how many there are, for the header summary.
 */
export default function AffirmationsList({ addRef, onCountChange }) {
  const [affirmations, setAffirmations] = useState([]);
  const [loading, setLoading] = useState(true);
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
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    onCountChange?.(loading || error ? null : affirmations.length);
  }, [affirmations.length, loading, error, onCountChange]);

  const openAdd = () => setModalState({ mode: "add" });

  useImperativeHandle(addRef, () => ({ openAdd, reload: loadAll }));

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
      return <SkeletonList groups={2} variant="tiles" testID="affirmations-loading" />;
    }

    if (error) {
      // Only this section failed — the board above still works, so keep the
      // failure inline instead of taking over the whole tab.
      return (
        <View style={styles.errorCard}>
          <Ionicons name="cloud-offline-outline" size={22} color={colors.danger} />
          <View style={styles.errorText}>
            <Text style={styles.errorTitle}>Failed to load: {error}</Text>
            <Text style={styles.errorHint}>Is the backend running?</Text>
          </View>
          <Button title="Retry" variant="tonal" size="sm" onPress={loadAll} />
        </View>
      );
    }

    if (affirmations.length === 0 && !actionError) {
      return (
        <EmptyState
          compact
          icon="heart-outline"
          title="No affirmations yet"
          message="Add a short line to read every day."
          actionLabel="Add affirmation"
          onAction={openAdd}
          style={styles.empty}
        />
      );
    }

    return affirmations.map((affirmation, i) => {
      const tint = tints[i % tints.length];
      return (
        <Pressable
          key={affirmation._id}
          onPress={() => setModalState({ mode: "edit", affirmation })}
          accessibilityRole="button"
          accessibilityLabel={affirmation.name}
          accessibilityHint="Opens the affirmation to edit"
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: tint.bg, borderColor: tint.border },
            pressed && styles.cardPressed,
          ]}
        >
          <Text style={styles.cardText}>{affirmation.name}</Text>
        </Pressable>
      );
    });
  };

  return (
    <>
      {actionError && (
        <Banner tone="danger" icon="alert" onDismiss={() => setActionError(null)}>
          {`Action failed: ${actionError}`}
        </Banner>
      )}

      {renderBody()}

      <AffirmationModal
        visible={modalState !== null}
        affirmation={
          modalState?.mode === "edit" ? modalState.affirmation : null
        }
        onConfirm={modalState?.mode === "edit" ? handleEdit : handleAdd}
        onDelete={handleDelete}
        onCancel={() => setModalState(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
  },
  errorTitle: {
    ...type.callout,
    color: colors.dangerText,
  },
  errorHint: {
    ...type.footnote,
    marginTop: 2,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.lg + 2,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  cardText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: colors.text,
  },
});
