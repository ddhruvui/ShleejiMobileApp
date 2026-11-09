import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Text, Pressable, ScrollView, RefreshControl } from "react-native";
import * as callsApi from "../api/calls";
import AddButton from "../components/AddButton";
import CallModal from "../components/CallModal";
import ConfirmModal from "../components/ConfirmModal";
import {
  ActionSheet,
  Avatar,
  Banner,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  IconButton,
  ProgressBar,
  ScreenHeader,
  SectionHeader,
  SkeletonList,
} from "../components/ui";
import { colors, spacing, type, useBottomClearance } from "../theme";

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
  const bottomClearance = useBottomClearance();

  // null = closed, { mode: "add" } or { mode: "edit", call }
  const [modalState, setModalState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menuTarget, setMenuTarget] = useState(null);

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

  const openAdd = () => setModalState({ mode: "add" });

  /* ── Render ── */

  const renderCallRow = (call, idx) => (
    // Checkbox, name and "⋯" are siblings so each is its own screen-reader stop.
    <View key={call._id} style={[styles.row, idx > 0 && styles.rowDivider]}>
      <Checkbox
        checked={call.done}
        tone="success"
        label={call.done ? `Mark ${call.name} not called` : `Mark ${call.name} called`}
        onPress={() => handleToggleCalled(call)}
      />
      <Pressable
        onPress={() => setModalState({ mode: "edit", call })}
        onLongPress={() => setMenuTarget(call)}
        accessibilityRole="button"
        accessibilityLabel={`${call.name}${call.done ? ", called" : ""}`}
        accessibilityHint="Opens the call to edit. Long press for more actions."
        style={({ pressed }) => [styles.rowBody, pressed && styles.rowPressed]}
      >
        <Avatar name={call.name} size={34} />
        <Text style={[styles.name, call.done && styles.nameDone]} numberOfLines={2}>
          {call.name}
        </Text>
      </Pressable>
      <IconButton
        icon="ellipsis-horizontal"
        label={`More actions for ${call.name}`}
        size="sm"
        onPress={() => setMenuTarget(call)}
      />
    </View>
  );

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.padded}>
          <SkeletonList groups={2} rows={2} />
        </View>
      );
    }

    if (error) {
      return <ErrorState message={error} onRetry={loadAll} />;
    }

    if (calls.length === 0 && !actionError) {
      return (
        <EmptyState
          icon="call-outline"
          title="No calls yet"
          message="Add someone to ring biweekly or monthly."
          actionLabel="Add a call"
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

        {SECTIONS.map(({ frequency, title }) => {
          const sectionCalls = calls.filter((c) => c.frequency === frequency);
          const called = sectionCalls.filter((c) => c.done).length;
          return (
            <View key={frequency} style={styles.section}>
              <SectionHeader
                title={title}
                right={
                  sectionCalls.length > 0 ? (
                    <Text style={styles.sectionCount}>
                      {called} / {sectionCalls.length}
                    </Text>
                  ) : null
                }
              />
              {sectionCalls.length === 0 ? (
                <Text style={styles.sectionEmpty}>No one yet</Text>
              ) : (
                <>
                  <ProgressBar
                    value={called / sectionCalls.length}
                    tone={called === sectionCalls.length ? "success" : "primary"}
                    height={5}
                    style={styles.progress}
                  />
                  <Card padded={false} style={styles.sectionCard}>
                    {sectionCalls.map(renderCallRow)}
                  </Card>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const calledCount = calls.filter((c) => c.done).length;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Calls"
        subtitle={
          !loading && !error && calls.length > 0
            ? `${calledCount} of ${calls.length} called`
            : undefined
        }
        right={<AddButton label="Add call" onPress={openAdd} />}
      />

      {renderBody()}

      <ActionSheet
        visible={menuTarget !== null}
        title={menuTarget?.name}
        subtitle={menuTarget?.frequency === "monthly" ? "Monthly" : "Biweekly"}
        onClose={() => setMenuTarget(null)}
        // These closures capture this render's menuTarget, so they still see
        // the person after the menu has cleared it and finished closing.
        actions={[
          {
            key: "edit",
            label: "Edit call",
            icon: "pencil",
            onPress: () => setModalState({ mode: "edit", call: menuTarget }),
          },
          {
            key: "delete",
            label: "Delete call",
            icon: "trash-outline",
            destructive: true,
            onPress: () => setDeleteTarget(menuTarget),
          },
        ]}
      />

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
  section: {
    marginBottom: spacing.xl,
  },
  sectionCount: {
    ...type.caption,
    color: colors.textSecondary,
  },
  sectionEmpty: {
    ...type.subhead,
    color: colors.textTertiary,
    paddingHorizontal: spacing.xs,
  },
  progress: {
    marginHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionCard: {
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingRight: spacing.xs,
    paddingLeft: spacing.xs,
    backgroundColor: colors.surface,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: spacing.xs,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  name: {
    ...type.callout,
    flex: 1,
    marginLeft: spacing.sm,
  },
  nameDone: {
    textDecorationLine: "line-through",
    color: colors.textTertiary,
  },
});
