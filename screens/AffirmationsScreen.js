import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Text, Pressable, ScrollView, RefreshControl, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as affirmationsApi from "../api/affirmations";
import AddButton from "../components/AddButton";
import AffirmationModal from "../components/AffirmationModal";
import {
  Banner,
  EmptyState,
  ErrorState,
  ScreenHeader,
  SkeletonList,
} from "../components/ui";
import { colors, radii, spacing, tints, useBottomClearance } from "../theme";

export default function AffirmationsScreen() {
  const [affirmations, setAffirmations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const bottomClearance = useBottomClearance();

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

  const openAdd = () => setModalState({ mode: "add" });

  /* ── Render ── */

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.padded}>
          <SkeletonList groups={3} variant="tiles" />
        </View>
      );
    }

    if (error) {
      return <ErrorState message={error} onRetry={loadAll} />;
    }

    if (affirmations.length === 0 && !actionError) {
      return (
        <EmptyState
          icon="heart-outline"
          title="No affirmations yet"
          message="Add a short line to read every day."
          actionLabel="Add affirmation"
          onAction={openAdd}
          style={{ paddingBottom: bottomClearance }}
        />
      );
    }

    return (
      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {actionError && (
          <Banner tone="danger" icon="alert" onDismiss={() => setActionError(null)}>
            {`Action failed: ${actionError}`}
          </Banner>
        )}

        {affirmations.map((affirmation, i) => {
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
              <Ionicons
                name="chatbox-ellipses-outline"
                size={18}
                color={tint.fg}
                style={styles.quote}
              />
              <Text style={[styles.cardText, { color: colors.text }]}>{affirmation.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  };

  const count = affirmations.length;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Affirmations"
        subtitle={
          !loading && !error && count > 0
            ? `${count} to read today`
            : undefined
        }
        right={<AddButton label="Add affirmation" onPress={openAdd} />}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  padded: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
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
  quote: {
    marginBottom: spacing.sm - 2,
  },
  cardText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});
