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
import { addDaysToDateKey, formatDateKey } from "../utils/ecd";
import {
  MINUTES_PER_DAY,
  dateKeyOf,
  formatDuration,
  isActive,
  isOvernight,
  shiftMinutes,
  upcomingShifts,
  weekSegments,
  weekStartKey,
  weekTotals,
} from "../utils/oncall";

const RED = "#cf222e";
const RED_TEXT = "#a40e26";
const RED_SOFT = "rgba(207,34,46,0.08)";
const RED_BORDER = "rgba(207,34,46,0.55)";
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-11-09" → "Nov 9", parsed by component (never `new Date(key)`). */
function shortDay(key) {
  const [, m, d] = key.split("-").map(Number);
  return `${SHORT_MONTHS[m - 1]} ${d}`;
}

const pct = (minutes) => `${(minutes / MINUTES_PER_DAY) * 100}%`;

/**
 * On-call view (option B, mirrors the web FE's OnCallPanel): a compact week
 * timeline of shift bars over a list of upcoming shifts.
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
  const [weekStart, setWeekStart] = useState(() =>
    weekStartKey(dateKeyOf(new Date())),
  );
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
  const thisWeek = weekStartKey(today);
  const upcoming = upcomingShifts(shifts, now);
  const days = weekSegments(upcoming, weekStart);
  const totals = weekTotals(upcoming, weekStart);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

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

      {/* ── Week timeline ── */}
      <View style={styles.card}>
        <View style={styles.weekHeader}>
          <TouchableOpacity
            onPress={() => setWeekStart(addDaysToDateKey(weekStart, -7))}
            disabled={weekStart <= thisWeek}
            style={[styles.navBtn, weekStart <= thisWeek && styles.navBtnDisabled]}
            accessibilityLabel="Previous week"
          >
            <Ionicons name="chevron-back" size={16} color="#656d76" />
          </TouchableOpacity>
          <Text style={styles.weekLabel}>
            {shortDay(weekStart)} – {shortDay(addDaysToDateKey(weekStart, 6))}
          </Text>
          <TouchableOpacity
            onPress={() => setWeekStart(addDaysToDateKey(weekStart, 7))}
            style={styles.navBtn}
            accessibilityLabel="Next week"
          >
            <Ionicons name="chevron-forward" size={16} color="#656d76" />
          </TouchableOpacity>
          <Text style={styles.totals}>
            {formatDuration(totals.primary)} primary
            {totals.secondary > 0
              ? ` · ${formatDuration(totals.secondary)} sec`
              : ""}
          </Text>
        </View>

        {days.map((day, i) => {
          const isToday = day.date === today;
          return (
            <View key={day.date} style={styles.dayRow}>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {DOW[i]}
              </Text>
              <View style={styles.track}>
                {day.segments.map((seg) => (
                  <View
                    key={`${seg.shift._id}-${seg.part}`}
                    style={[
                      styles.bar,
                      seg.shift.type === "primary"
                        ? styles.barPrimary
                        : styles.barSecondary,
                      { left: pct(seg.from), width: pct(seg.to - seg.from) },
                    ]}
                  />
                ))}
                {isToday && (
                  <View style={[styles.nowLine, { left: pct(nowMinutes) }]} />
                )}
              </View>
            </View>
          );
        })}
        <View style={styles.axis}>
          {["0", "6", "12", "18", "24"].map((h) => (
            <Text key={h} style={styles.axisText}>
              {h}
            </Text>
          ))}
        </View>
        <View style={styles.legend}>
          <View style={[styles.swatch, styles.barPrimary]} />
          <Text style={styles.legendText}>Primary</Text>
          <View style={[styles.swatch, styles.barSecondary]} />
          <Text style={styles.legendText}>Secondary</Text>
        </View>
      </View>

      {/* ── Upcoming list ── */}
      {upcoming.length === 0 ? (
        <Text style={styles.emptyText}>
          No upcoming on-call shifts — add one with the + above. Type the
          shorthand you already use, like 11/16 9-22. On-call is kept separate
          and never changes your tasks.
        </Text>
      ) : (
        <View style={styles.list}>
          {upcoming.map((shift) => {
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
  card: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eaeef2",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 12,
  },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  navBtn: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 6,
  },
  navBtnDisabled: { opacity: 0.4 },
  weekLabel: { fontSize: 13, fontWeight: "700", color: "#1f2328" },
  totals: { marginLeft: "auto", fontSize: 11, color: "#656d76" },
  dayRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  dayLabel: { width: 36, fontSize: 11, color: "#656d76" },
  dayLabelToday: { color: "#1f2328", fontWeight: "700" },
  track: {
    flex: 1,
    height: 16,
    borderRadius: 4,
    backgroundColor: "#f6f8fa",
    borderWidth: 1,
    borderColor: "#eaeef2",
  },
  bar: { position: "absolute", top: -1, bottom: -1, borderRadius: 4 },
  barPrimary: { backgroundColor: RED },
  barSecondary: {
    backgroundColor: RED_SOFT,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: RED_BORDER,
  },
  nowLine: {
    position: "absolute",
    top: -4,
    bottom: -4,
    width: 2,
    backgroundColor: "#1f2328",
  },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginLeft: 36,
    marginTop: 2,
  },
  axisText: { fontSize: 10, color: "#656d76" },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 36,
    marginTop: 8,
  },
  swatch: { width: 14, height: 10, borderRadius: 3 },
  legendText: { fontSize: 11, color: "#656d76", marginRight: 10 },
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
    paddingRight: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 11,
    paddingLeft: 11,
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
  iconBtn: { padding: 6 },
});
