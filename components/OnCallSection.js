import React, {
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as onCallApi from "../api/oncall";
import OnCallModal from "./OnCallModal";
import ConfirmModal from "./ConfirmModal";
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

const RED = "#cf222e";
const RED_TEXT = "#a40e26";
const RED_SOFT = "rgba(207,34,46,0.08)";
const RED_BORDER = "rgba(207,34,46,0.55)";
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#1e88e5" />
        <Text style={styles.loadingText}>Loading on-call shifts…</Text>
      </View>
    );
  }

  const today = dateKeyOf(now);
  const { items, freeAfter } = onCallAgenda(shifts, now);
  const shiftCount = items.filter((i) => i.kind === "shift").length;
  const totalMinutes = items.reduce(
    (sum, i) => (i.kind === "shift" ? sum + shiftMinutes(i.shift) : sum),
    0,
  );

  return (
    <View>
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>Action failed: {error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={18} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      )}

      {shiftCount === 0 ? (
        <Text style={styles.emptyText}>
          No upcoming on-call shifts — add one with the + above. Type the
          shorthand you already use, like 11/16 9-22. On-call is kept separate
          and never changes your tasks.
        </Text>
      ) : (
        <View style={styles.list}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Upcoming</Text>
            <Text style={styles.totals}>
              {shiftCount} {shiftCount === 1 ? "shift" : "shifts"} ·{" "}
              {formatDuration(totalMinutes)} on call
            </Text>
          </View>
          {items.map((item) => {
            if (item.kind === "gap") {
              return (
                <View
                  key={`gap-${item.from.getTime()}`}
                  style={[styles.gapRow, item.fromNow && styles.gapRowNow]}
                >
                  <View style={styles.gapRail} />
                  <View style={styles.rowMain}>
                    <Text style={styles.gapTitle}>
                      Not on call{item.fromNow ? " now" : ""}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {item.fromNow
                        ? `until ${formatMoment(item.to, now)}`
                        : `from ${formatMoment(item.from, now)} to ${formatMoment(item.to, now)}`}
                    </Text>
                  </View>
                  <Text style={styles.gapSpan}>{formatSpan(item.minutes)}</Text>
                </View>
              );
            }
            const { shift } = item;
            const active = isActive(shift, now);
            return (
              <View
                key={shift._id}
                style={[
                  styles.row,
                  shift.type === "primary" ? styles.rowPrimary : styles.rowSecondary,
                ]}
              >
                <View style={styles.rowMain}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTimes}>
                      {shift.start} – {shift.end}
                    </Text>
                    {isOvernight(shift) && <Text style={styles.plus1}>+1</Text>}
                    {shift.type === "secondary" && (
                      <Text style={styles.pill}>secondary</Text>
                    )}
                    {active && (
                      <Text style={[styles.pill, styles.pillNow]}>now</Text>
                    )}
                  </View>
                  <Text style={styles.rowMeta}>
                    {shift.date === today ? "Today · " : ""}
                    {formatDateKey(shift.date)} ·{" "}
                    {formatDuration(shiftMinutes(shift))}
                    {shift.note ? ` · ${shift.note}` : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setModalState({ mode: "edit", shift })}
                  accessibilityLabel={`Edit on-call shift ${shift.date}`}
                >
                  <Ionicons name="pencil" size={16} color="#656d76" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setDeleteTarget(shift)}
                  accessibilityLabel={`Delete on-call shift ${shift.date}`}
                >
                  <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            );
          })}
          {freeAfter && (
            <View style={styles.endRow}>
              <Text style={styles.endText}>
                Nothing scheduled after {formatMoment(freeAfter, now)}
              </Text>
            </View>
          )}
        </View>
      )}

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

const styles = StyleSheet.create({
  centered: { alignItems: "center", paddingVertical: 32 },
  loadingText: { marginTop: 8, fontSize: 14, color: "#656d76" },
  errorBar: {
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
  errorText: { fontSize: 13, color: "#e74c3c", flex: 1, marginRight: 8 },
  emptyText: {
    fontSize: 14,
    color: "#656d76",
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 24,
    paddingHorizontal: 8,
  },
  list: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#eaeef2",
    borderRadius: 10,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 11,
    paddingLeft: 11,
    paddingRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
    borderLeftWidth: 3,
  },
  rowPrimary: { borderLeftColor: RED },
  rowSecondary: { borderLeftColor: RED_BORDER, borderStyle: "dashed" },
  rowMain: { flex: 1, minWidth: 0 },
  rowHeader: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  rowTimes: { fontSize: 14, fontWeight: "600", color: "#1f2328" },
  plus1: { fontSize: 11, color: "#656d76" },
  pill: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: RED_BORDER,
    color: RED_TEXT,
    overflow: "hidden",
  },
  pillNow: { backgroundColor: RED, borderColor: RED, color: "#fff" },
  rowMeta: { fontSize: 12, color: "#656d76", marginTop: 2 },
  listHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
  },
  listTitle: { fontSize: 15, fontWeight: "700", color: "#1f2328" },
  totals: { fontSize: 11, color: "#656d76" },
  /* Off-call gap: a quiet row with a dashed grey rail where a shift's
     coloured edge would be — the absence of cover, not an entry. */
  gapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingLeft: 14,
    paddingRight: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
    backgroundColor: "#f6f8fa",
  },
  gapRowNow: { backgroundColor: "#eef6ee" },
  gapRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderLeftWidth: 3,
    borderLeftColor: "#d0d7de",
    borderStyle: "dashed",
  },
  gapTitle: { fontSize: 13, fontWeight: "600", color: "#1f2328" },
  gapSpan: {
    fontSize: 11,
    fontWeight: "600",
    color: "#57606a",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#eaeef2",
    overflow: "hidden",
  },
  endRow: { paddingVertical: 10, paddingLeft: 14 },
  endText: { fontSize: 12, color: "#656d76" },
  iconBtn: { padding: 6 },
});
