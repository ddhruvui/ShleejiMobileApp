import React, {
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
} from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as onCallApi from "../api/oncall";
import OnCallModal from "./OnCallModal";
import ConfirmModal from "./ConfirmModal";
import {
  ActionSheet,
  Badge,
  Banner,
  Card,
  EmptyState,
  IconButton,
  LoadingState,
  SectionHeader,
} from "./ui";
import { formatDateKey } from "../utils/ecd";
import {
  dateKeyOf,
  formatDuration,
  formatMoment,
  formatSpan,
  isActive,
  isOvernight,
  onCallAgenda,
  shiftMinutes,
} from "../utils/oncall";
import { colors, radii, shadows, spacing, type } from "../theme";

/**
 * On-call view (mirrors the web FE's OnCallPanel): one agenda of upcoming
 * shifts with the off-call gaps between them — "Not on call from Mon 11/16
 * 22:00 to Tue 11/24 09:00" — instead of paging through weeks. Back-to-back
 * or overlapping shifts are one stretch of cover (no gap inside); when the
 * user isn't on call right now the agenda opens with "Not on call now".
 *
 * On-call is a record kept apart from the todo — nothing here touches tasks.
 * Primary shifts are solid red, secondary ones a dashed outline in the same
 * red family. Ended shifts are hidden the minute they end on the device
 * clock; the backend cron deletes them overnight.
 *
 * No toolbar of its own: TodoScreen's title-bar "+" opens the add sheet
 * through `addRef` while this view shows.
 */
export default function OnCallSection({ addRef, onShiftsChanged }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [modalState, setModalState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // The shift whose "⋯" menu (edit / delete) is open.
  const [menuFor, setMenuFor] = useState(null);

  useImperativeHandle(addRef, () => ({
    openAdd: () => setModalState({ mode: "add" }),
  }));

  const load = useCallback(async () => {
    try {
      setShifts(await onCallApi.getAll());
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  /* ── CRUD (no optimistic updates: mutate via API, then refetch) ── */

  const handleSave = async (draft) => {
    if (!modalState) return;
    try {
      if (modalState.mode === "add") {
        await onCallApi.create(draft);
      } else {
        await onCallApi.update(modalState.shift._id, draft);
      }
      setModalState(null);
      setError(null);
      await load();
      if (onShiftsChanged) await onShiftsChanged();
    } catch (err) {
      setModalState(null);
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onCallApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      setError(null);
      await load();
      if (onShiftsChanged) await onShiftsChanged();
    } catch (err) {
      setDeleteTarget(null);
      setError(err.message);
    }
  };

  if (loading) {
    return <LoadingState label="Loading on-call shifts…" style={styles.loading} />;
  }

  const today = dateKeyOf(now);
  const { items, freeAfter } = onCallAgenda(shifts, now);
  const shiftCount = items.filter((i) => i.kind === "shift").length;
  const totalMinutes = items.reduce(
    (sum, i) => (i.kind === "shift" ? sum + shiftMinutes(i.shift) : sum),
    0,
  );

  const menuActions = menuFor
    ? [
        {
          key: "edit",
          label: "Edit shift",
          icon: "pencil",
          onPress: () => setModalState({ mode: "edit", shift: menuFor }),
        },
        {
          key: "delete",
          label: "Delete shift",
          icon: "trash-outline",
          destructive: true,
          onPress: () => setDeleteTarget(menuFor),
        },
      ]
    : [];

  return (
    <View>
      {error && (
        <Banner tone="danger" icon="alert" onDismiss={() => setError(null)}>
          {`Action failed: ${error}`}
        </Banner>
      )}

      {shiftCount === 0 ? (
        <Card padded={false}>
          <EmptyState
            compact
            icon="notifications-outline"
            title="No upcoming on-call shifts — add one with the + above."
            message="Type the shorthand you already use, like 11/16 9-22. On-call is kept separate and never changes your tasks."
          />
        </Card>
      ) : (
        <View style={styles.agenda}>
          <SectionHeader
            title="Upcoming"
            right={
              <Text style={styles.totals}>
                {shiftCount} {shiftCount === 1 ? "shift" : "shifts"} ·{" "}
                {formatDuration(totalMinutes)} on call
              </Text>
            }
          />
          {items.map((item) => {
            if (item.kind === "gap") {
              return (
                <GapRow
                  key={`gap-${item.from.getTime()}`}
                  gap={item}
                  now={now}
                />
              );
            }
            const { shift } = item;
            return (
              <ShiftCard
                key={shift._id}
                shift={shift}
                active={isActive(shift, now)}
                isToday={shift.date === today}
                onEdit={() => setModalState({ mode: "edit", shift })}
                onMore={() => setMenuFor(shift)}
              />
            );
          })}
          {freeAfter && (
            <View style={styles.endRow}>
              <Ionicons name="flag-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.endText}>
                Nothing scheduled after {formatMoment(freeAfter, now)}
              </Text>
            </View>
          )}
        </View>
      )}

      <ActionSheet
        visible={!!menuFor}
        title={menuFor ? `${menuFor.start} – ${menuFor.end}` : undefined}
        subtitle={
          menuFor
            ? `${menuFor.type === "primary" ? "Primary" : "Secondary"} · ${formatDateKey(menuFor.date)}`
            : undefined
        }
        actions={menuActions}
        onClose={() => setMenuFor(null)}
        testID="oncall-menu"
      />

      {modalState && (
        <OnCallModal
          shift={modalState.mode === "edit" ? modalState.shift : undefined}
          onConfirm={handleSave}
          onCancel={() => setModalState(null)}
        />
      )}

      <ConfirmModal
        visible={!!deleteTarget}
        message={
          deleteTarget
            ? `Delete the ${deleteTarget.type} on-call shift on ${formatDateKey(deleteTarget.date)} (${deleteTarget.start}–${deleteTarget.end})?`
            : ""
        }
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

/**
 * One shift as a timeline card. Primary: solid red edge on a white card.
 * Secondary: a dashed red outline, no fill — the same split the on-call
 * banner and the add sheet's type picker draw. Tap edits; "⋯" for the menu.
 */
function ShiftCard({ shift, active, isToday, onEdit, onMore }) {
  const [pressed, setPressed] = useState(false);
  const primary = shift.type === "primary";
  const overnight = isOvernight(shift);
  const meta = `${isToday ? "Today · " : ""}${formatDateKey(shift.date)} · ${formatDuration(
    shiftMinutes(shift),
  )}${shift.note ? ` · ${shift.note}` : ""}`;
  return (
    // Body and "⋯" are siblings so each is its own screen-reader stop; the
    // whole card highlights while the body is pressed.
    <View
      style={[
        styles.shift,
        primary ? styles.shiftPrimary : styles.shiftSecondary,
        active && styles.shiftActive,
        pressed && styles.shiftPressed,
      ]}
    >
      <Pressable
        testID={`shift-${shift._id}`}
        onPress={onEdit}
        onLongPress={onMore}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={`${primary ? "Primary" : "Secondary"} on-call shift ${shift.start} to ${
          shift.end
        }${overnight ? " next day" : ""}${active ? ", on now" : ""}, ${meta}`}
        accessibilityHint="Edits the shift. Long press for more actions."
        style={styles.shiftMain}
      >
        <View style={styles.shiftHeader}>
          <Text style={styles.shiftTimes}>
            {shift.start} – {shift.end}
          </Text>
          {overnight && <Text style={styles.plus1}>+1</Text>}
          {!primary && <Badge label="secondary" tone="danger" outline />}
          {active && <Badge label="now" tone="danger" icon="radio-button-on" />}
        </View>
        <Text style={styles.shiftMeta}>{meta}</Text>
      </Pressable>
      <IconButton
        icon="ellipsis-horizontal"
        label={`More actions for on-call shift ${shift.date}`}
        onPress={onMore}
      />
    </View>
  );
}

/**
 * Off-call gap: a quiet, muted row with a dashed grey rail where a shift's
 * coloured edge would be — the absence of cover, not an entry. "Not on call
 * now" (the opening gap) gets a soft success tint: you're free.
 */
function GapRow({ gap, now }) {
  return (
    <View
      style={[styles.gap, gap.fromNow && styles.gapNow]}
      testID={gap.fromNow ? "oncall-gap-now" : "oncall-gap"}
    >
      <View style={styles.gapRail} />
      <View style={styles.shiftMain}>
        <Text style={styles.gapTitle}>Not on call{gap.fromNow ? " now" : ""}</Text>
        <Text style={styles.gapMeta}>
          {gap.fromNow
            ? `until ${formatMoment(gap.to, now)}`
            : `from ${formatMoment(gap.from, now)} to ${formatMoment(gap.to, now)}`}
        </Text>
      </View>
      <Badge label={formatSpan(gap.minutes)} tone={gap.fromNow ? "success" : "neutral"} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 0,
    paddingVertical: spacing.xxxl,
  },
  agenda: {
    marginBottom: spacing.xxl,
    gap: spacing.sm,
  },
  totals: {
    ...type.caption,
    fontWeight: "400",
  },
  shift: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 64,
    paddingVertical: spacing.sm + 2,
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.xs,
    borderRadius: radii.lg,
  },
  shiftPrimary: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dangerBorder,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    ...shadows.card,
  },
  shiftSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.danger,
  },
  shiftActive: {
    backgroundColor: colors.dangerSoft,
  },
  shiftPressed: {
    opacity: 0.85,
  },
  shiftMain: {
    flex: 1,
    minWidth: 0,
  },
  shiftHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm - 2,
  },
  shiftTimes: {
    ...type.headline,
  },
  plus1: {
    ...type.caption,
  },
  shiftMeta: {
    ...type.footnote,
    marginTop: spacing.xxs,
  },
  gap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingLeft: spacing.md + 2,
    paddingRight: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  gapNow: {
    backgroundColor: colors.successSoft,
  },
  gapRail: {
    position: "absolute",
    left: spacing.xs,
    top: spacing.sm,
    bottom: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.borderStrong,
    borderStyle: "dashed",
  },
  gapTitle: {
    ...type.subhead,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  gapMeta: {
    ...type.footnote,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  endRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  endText: {
    ...type.footnote,
    color: colors.textTertiary,
  },
});
