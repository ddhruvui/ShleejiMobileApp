import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as insightsApi from "../api/insights";

/**
 * Insights view: exact habit/task stats from the archive, plus the latest
 * AI coaching report with an on-demand "Generate now" button.
 * Rendered inside TodoScreen's ScrollView when the Insights toggle is active.
 */
export default function InsightsSection() {
  const [stats, setStats] = useState(null);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statsData = await insightsApi.getStats();
      setStats(statsData);
    } catch (err) {
      setError(err.message);
    }
    try {
      const latest = await insightsApi.getLatest();
      setInsight(latest);
    } catch {
      // No report yet is a normal state, not an error
      setInsight(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const fresh = await insightsApi.generate();
      setInsight(fresh);
    } catch (err) {
      setError(err.message);
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#6200ee" />
        <Text style={styles.emptyText}>Loading insights…</Text>
      </View>
    );
  }

  const hasArchiveData = stats && stats.eventCount > 0;
  const report = insight?.report;

  return (
    <View>
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>Insights error: {error}</Text>
        </View>
      )}

      {/* ── Habits ── */}
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.headerName}>Habits</Text>
        </View>
        <View style={styles.sectionBody}>
          {stats && stats.habits.length > 0 ? (
            stats.habits.map((h) => (
              <View
                key={`${h.taskName}-${h.headerName}`}
                style={styles.habitCard}
              >
                <View style={styles.habitTitleRow}>
                  <Text style={styles.habitTitle} numberOfLines={1}>
                    {h.taskName}
                  </Text>
                  <Text style={styles.habitHeader}>{h.headerName || ""}</Text>
                </View>
                <Text style={styles.habitRate}>
                  {h.completionRate}%{"  "}
                  <Text style={styles.habitDetail}>
                    {h.completed}/{h.scheduled} · streak {h.currentStreak}{" "}
                    (best {h.longestStreak})
                  </Text>
                </Text>
                <View style={styles.dotRow}>
                  {h.recentResults.map((r) => (
                    <View
                      key={r.dueDate}
                      style={[
                        styles.dot,
                        r.completed ? styles.dotHit : styles.dotMiss,
                      ]}
                    />
                  ))}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No habit history yet. Habits are tasks scheduled by day of week —
              results are recorded each night.
            </Text>
          )}
        </View>
      </View>

      {/* ── Tasks ── */}
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.headerName}>Tasks</Text>
        </View>
        <View style={styles.sectionBody}>
          {hasArchiveData ? (
            <>
              <Text style={styles.bodyText}>
                <Text style={styles.bold}>
                  {stats.oneTimeTasks.completedCount}
                </Text>{" "}
                one-time tasks completed in the last {stats.periodDays} days
                {stats.oneTimeTasks.avgSlippageDays !== null && (
                  <>
                    {" "}
                    · average slip of{" "}
                    <Text style={styles.bold}>
                      {stats.oneTimeTasks.avgSlippageDays} days
                    </Text>{" "}
                    past the planned date
                  </>
                )}
              </Text>
              {stats.reschedules.length > 0 && (
                <>
                  <Text style={[styles.bodyText, styles.bold, styles.spaced]}>
                    Most rescheduled:
                  </Text>
                  {stats.reschedules.slice(0, 5).map((r) => (
                    <Text
                      key={`${r.taskName}-${r.headerName}`}
                      style={styles.listItem}
                    >
                      • {r.taskName} — moved {r.total}×
                      {r.pushedLater > 0
                        ? ` (${r.pushedLater}× pushed later)`
                        : ""}
                    </Text>
                  ))}
                </>
              )}
            </>
          ) : (
            <Text style={styles.emptyText}>
              No task history yet — completed tasks are archived by the nightly
              job.
            </Text>
          )}
        </View>
      </View>

      {/* ── Coach (AI report) ── */}
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.headerName}>Coach</Text>
          <TouchableOpacity
            style={[
              styles.generateBtn,
              (generating || !hasArchiveData) && styles.generateBtnDisabled,
            ]}
            onPress={handleGenerate}
            disabled={generating || !hasArchiveData}
            activeOpacity={0.7}
          >
            {generating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.generateText}>Generate now</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.sectionBody}>
          {report ? (
            <>
              <Text style={styles.metaText}>
                Generated {new Date(insight.generatedAt).toLocaleString()}
              </Text>
              <Text style={styles.summaryText}>{report.summary}</Text>
              <ReportBlock
                title="On track"
                items={report.habitsOnTrack}
                color="#2da44e"
                icon="checkmark-circle-outline"
              />
              <ReportBlock
                title="Slipping"
                items={report.habitsSlipping}
                color="#cf222e"
                icon="trending-down-outline"
              />
              <ReportBlock
                title="Tasks"
                items={report.taskInsights}
                color="#656d76"
                icon="list-outline"
              />
              <ReportBlock
                title="Procrastination flags"
                items={report.procrastinationFlags}
                color="#cf222e"
                icon="flag-outline"
              />
              <ReportBlock
                title="Calls to make"
                items={report.callReminders}
                color="#656d76"
                icon="call-outline"
              />
              <ReportBlock
                title="Suggestions"
                items={report.suggestions}
                color="#2da44e"
                icon="bulb-outline"
              />
            </>
          ) : (
            <Text style={styles.emptyText}>
              No AI report yet — one is generated automatically each night, or
              tap "Generate now".
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function ReportBlock({ title, items, color, icon }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={[styles.reportBlock, { borderLeftColor: color }]}>
      <View style={styles.reportTitleRow}>
        <Ionicons name={icon} size={15} color={color} />
        <Text style={[styles.reportTitle, { color }]}>{title}</Text>
      </View>
      {items.map((item, i) => (
        <Text key={i} style={styles.listItem}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    paddingVertical: 32,
  },
  section: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#eaeef2",
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eaeef2",
    backgroundColor: "#f6f8fa",
  },
  headerName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2328",
  },
  sectionBody: {
    padding: 14,
  },
  habitCard: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  habitTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  habitTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2328",
    flex: 1,
  },
  habitHeader: {
    fontSize: 12,
    color: "#656d76",
  },
  habitRate: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2328",
    marginVertical: 6,
  },
  habitDetail: {
    fontSize: 12,
    fontWeight: "400",
    color: "#656d76",
  },
  dotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotHit: {
    backgroundColor: "#2da44e",
  },
  dotMiss: {
    backgroundColor: "#cf222e",
    opacity: 0.55,
  },
  bodyText: {
    fontSize: 14,
    color: "#1f2328",
    lineHeight: 20,
  },
  bold: {
    fontWeight: "700",
  },
  spaced: {
    marginTop: 10,
    marginBottom: 4,
  },
  listItem: {
    fontSize: 13,
    color: "#1f2328",
    lineHeight: 19,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#656d76",
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1f2328",
    lineHeight: 21,
    marginBottom: 12,
  },
  reportBlock: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginBottom: 12,
  },
  reportTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  generateBtn: {
    backgroundColor: "#6200ee",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    minWidth: 110,
    alignItems: "center",
  },
  generateBtnDisabled: {
    opacity: 0.5,
  },
  generateText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  errorBar: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fde8e8",
  },
  errorText: {
    fontSize: 13,
    color: "#e74c3c",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    color: "#656d76",
    paddingVertical: 12,
  },
});
