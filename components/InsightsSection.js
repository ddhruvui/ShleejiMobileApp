import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as insightsApi from "../api/insights";
import {
  Badge,
  Banner,
  BannerText,
  Button,
  Card,
  EmptyState,
  LoadingState,
  ProgressBar,
  SectionHeader,
} from "./ui";
import { colors, spacing, type } from "../theme";

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
    return <LoadingState compact label="Loading insights…" />;
  }

  const hasArchiveData = stats && stats.eventCount > 0;
  const report = insight?.report;
  const vacation = stats?.vacation;
  const onVacation = vacation?.onVacation === true;

  return (
    <View>
      {error && (
        <Banner tone="danger" icon="alert" onDismiss={() => setError(null)}>
          {`Insights error: ${error}`}
        </Banner>
      )}

      {/* ── Vacation notice ──
          Without this the numbers below look broken: a frozen window explains
          why nothing moved, and excluded days explain a denominator that
          shrank. */}
      {onVacation && (
        <Banner tone="info" icon="sunny">
          <BannerText>
            <Text style={styles.strong}>You're on vacation.</Text> These
            numbers are as of {vacation.frozenAt ?? "before you left"} and stay
            put until you're back — days off aren't counted against you, and
            coach reports are paused. Anything you do tick off still counts and
            will show up when you return.
          </BannerText>
        </Banner>
      )}
      {!onVacation && vacation?.justReturnedFrom && (
        <Banner tone="info" icon="home">
          <BannerText>
            <Text style={styles.strong}>Welcome back.</Text> You were away{" "}
            {vacation.justReturnedFrom.days} day
            {vacation.justReturnedFrom.days === 1 ? "" : "s"} — those days
            don't count as misses, and habit streaks start fresh from here.
          </BannerText>
        </Banner>
      )}
      {!onVacation && vacation?.vacationDaysInWindow > 0 && (
        <Text style={styles.vacationHint}>
          {vacation.vacationDaysInWindow} vacation day
          {vacation.vacationDaysInWindow === 1 ? "" : "s"} in this period are
          excluded from the rates below.
        </Text>
      )}

      {/* ── Habits ── */}
      <View style={styles.section}>
        <SectionHeader title="Habits" />
        {stats && stats.habits.length > 0 ? (
          stats.habits.map((h) => (
            <HabitCard key={`${h.taskName}-${h.headerName}`} habit={h} />
          ))
        ) : (
          <Card padded={false}>
            <EmptyState
              compact
              icon="repeat"
              title="No habit history yet"
              message="Habits are tasks scheduled by day of week — results are recorded each night."
            />
          </Card>
        )}
      </View>

      {/* ── Tasks ── */}
      <View style={styles.section}>
        <SectionHeader title="Tasks" />
        {hasArchiveData ? (
          <Card>
            <StatRow
              value={stats.oneTimeTasks.completedCount}
              label={`one-time tasks completed in the last ${stats.periodDays} days`}
              testID="insights-completed"
            />
            {/* On or before the planned date is a win — shown first, and
                the slip line only appears when something was actually
                late. Older backends don't send the counts, hence the
                guard. Mirrors the web FE's InsightsPanel. */}
            {stats.oneTimeTasks.onTimeCount !== undefined && (
              <StatRow
                value={stats.oneTimeTasks.onTimeCount}
                label="on or before the planned date"
                tone="success"
                ratio={
                  stats.oneTimeTasks.completedCount > 0
                    ? stats.oneTimeTasks.onTimeCount /
                      stats.oneTimeTasks.completedCount
                    : null
                }
                testID="insights-on-time"
              />
            )}
            {stats.oneTimeTasks.avgSlippageDays !== null &&
              stats.oneTimeTasks.avgSlippageDays > 0 && (
                <StatRow
                  value={`${stats.oneTimeTasks.avgSlippageDays} days`}
                  label="average slip past the planned date"
                  tone="danger"
                  testID="insights-slip"
                />
              )}

            {stats.reschedules.length > 0 && (
              <View style={styles.reschedules}>
                <Text style={styles.subheading}>Most rescheduled:</Text>
                {stats.reschedules.slice(0, 5).map((r, i) => (
                  <View
                    // name + header can repeat in the data, so add the position
                    key={`${r.taskName}-${r.headerName}-${i}`}
                    style={styles.rescheduleRow}
                  >
                    <Text style={styles.rescheduleName} numberOfLines={2}>
                      {r.taskName}
                    </Text>
                    <Text style={styles.rescheduleMeta}>
                      moved {r.total}×
                      {r.pushedLater > 0 ? ` (${r.pushedLater}× pushed later)` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        ) : (
          <Card padded={false}>
            <EmptyState
              compact
              icon="archive-outline"
              title="No task history yet"
              message="Completed tasks are archived by the nightly job."
            />
          </Card>
        )}
      </View>

      {/* ── Coach (AI report) ── */}
      <View style={styles.section}>
        <SectionHeader
          title="Coach"
          right={
            <Button
              title="Generate now"
              icon="sparkles"
              variant="tonal"
              onPress={handleGenerate}
              loading={generating}
              disabled={!hasArchiveData}
              // While away it still works, but it reads as "not now".
              style={onVacation && !generating && hasArchiveData ? styles.dimmed : undefined}
              testID="insights-generate"
            />
          }
        />
        <Card>
          {report ? (
            <>
              <Text style={styles.metaText}>
                Generated {new Date(insight.generatedAt).toLocaleString()}
              </Text>
              <Text style={styles.summaryText}>{report.summary}</Text>
              <ReportBlock
                title="On track"
                items={report.habitsOnTrack}
                tone="success"
                icon="checkmark-circle-outline"
              />
              <ReportBlock
                title="Slipping"
                items={report.habitsSlipping}
                tone="danger"
                icon="trending-down-outline"
              />
              <ReportBlock
                title="Tasks"
                items={report.taskInsights}
                tone="neutral"
                icon="list-outline"
              />
              <ReportBlock
                title="Procrastination flags"
                items={report.procrastinationFlags}
                tone="danger"
                icon="flag-outline"
              />
              <ReportBlock
                title="Calls to make"
                items={report.callReminders}
                tone="neutral"
                icon="call-outline"
              />
              <ReportBlock
                title="Suggestions"
                items={report.suggestions}
                tone="success"
                icon="bulb-outline"
              />
            </>
          ) : (
            <Text style={styles.emptyText}>
              {onVacation
                ? "Coach reports are paused while you're on vacation — the next one lands after you're back, with a plan for restarting."
                : 'No AI report yet — one is generated automatically each day, or tap "Generate now".'}
            </Text>
          )}
        </Card>
      </View>
    </View>
  );
}

/** One habit: big completion rate, its bar, streak and the recent-days dots. */
function HabitCard({ habit: h }) {
  return (
    <Card style={styles.habitCard}>
      <View style={styles.habitTitleRow}>
        <Text style={styles.habitTitle} numberOfLines={1}>
          {h.taskName}
        </Text>
        <Text style={styles.habitHeader}>{h.headerName || ""}</Text>
      </View>

      <View style={styles.rateRow}>
        <Text style={styles.bigNumber}>{h.completionRate}%</Text>
        <Text style={styles.rateDetail}>
          {h.completed}/{h.scheduled}
        </Text>
        <Badge
          label={`streak ${h.currentStreak} (best ${h.longestStreak})`}
          icon="flame"
          tone="accent"
          outline
          style={styles.streakBadge}
        />
      </View>
      <ProgressBar
        value={h.completionRate / 100}
        tone="success"
        style={styles.rateBar}
        testID={`habit-rate-${h.taskName}`}
      />

      {/* All-time count, deliberately separate from the windowed
          figures above — it ignores the reporting period entirely. */}
      {h.lifetimeCompleted !== undefined && (
        <Text style={styles.habitLifetime}>
          Done {h.lifetimeCompleted} time
          {h.lifetimeCompleted === 1 ? "" : "s"} all-time
        </Text>
      )}
      {h.pausedDays > 0 && (
        <Text style={styles.habitPaused}>
          {h.pausedDays} vacation day
          {h.pausedDays === 1 ? "" : "s"} excluded
        </Text>
      )}
      <View style={styles.dotRow}>
        {h.recentResults.map((r) => {
          // Three states, not two: a vacation day the user didn't act
          // on is neither a hit nor a miss. Drawing it as a miss would
          // make the excluded day look like a failure; dropping it
          // would make the streak restart look like a bug.
          const paused = !r.completed && r.vacation;
          return (
            <View
              key={r.dueDate}
              style={[
                styles.dot,
                r.completed ? styles.dotHit : paused ? styles.dotPaused : styles.dotMiss,
              ]}
            />
          );
        })}
      </View>
    </Card>
  );
}

const STAT_TONES = {
  neutral: colors.text,
  success: colors.successText,
  danger: colors.dangerText,
};

/** Big number on the left, what it counts on the right; optional ratio bar. */
function StatRow({ value, label, tone = "neutral", ratio = null, testID }) {
  return (
    <View style={styles.statRow} testID={testID}>
      <Text style={[styles.statValue, { color: STAT_TONES[tone] }]}>{value}</Text>
      <View style={styles.statBody}>
        <Text style={styles.statLabel}>{label}</Text>
        {ratio !== null ? (
          <ProgressBar
            value={ratio}
            tone="success"
            style={styles.statBar}
            testID={testID ? `${testID}-bar` : undefined}
          />
        ) : null}
      </View>
    </View>
  );
}

const REPORT_TONES = {
  success: { edge: colors.success, fg: colors.successText },
  danger: { edge: colors.danger, fg: colors.dangerText },
  neutral: { edge: colors.borderStrong, fg: colors.textSecondary },
};

function ReportBlock({ title, items, tone, icon }) {
  if (!items || items.length === 0) return null;
  const t = REPORT_TONES[tone] || REPORT_TONES.neutral;
  return (
    <View style={[styles.reportBlock, { borderLeftColor: t.edge }]}>
      <View style={styles.reportTitleRow}>
        <Ionicons name={icon} size={16} color={t.fg} />
        <Text style={[styles.reportTitle, { color: t.fg }]}>{title}</Text>
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
  section: {
    marginBottom: spacing.xxl,
  },
  strong: {
    fontWeight: "700",
  },
  vacationHint: {
    ...type.footnote,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },

  /* Habits */
  habitCard: {
    marginBottom: spacing.md,
  },
  habitTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  habitTitle: {
    ...type.headline,
    flex: 1,
  },
  habitHeader: {
    ...type.caption,
    fontWeight: "400",
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  bigNumber: {
    ...type.largeTitle,
  },
  rateDetail: {
    ...type.subhead,
    fontWeight: "600",
  },
  streakBadge: {
    alignSelf: "center",
  },
  rateBar: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  habitLifetime: {
    ...type.footnote,
    marginBottom: spacing.xxs,
  },
  habitPaused: {
    ...type.footnote,
    fontStyle: "italic",
    marginBottom: spacing.xs,
  },
  dotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotHit: {
    backgroundColor: colors.success,
  },
  dotMiss: {
    backgroundColor: colors.danger,
    opacity: 0.55,
  },
  /* A vacation day the user didn't act on: neither a hit nor a miss. Hollow so
     it reads as "nothing happened here" rather than a failure — which is
     exactly what it is, and also why the streak restarts after it. */
  dotPaused: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.textTertiary,
    borderStyle: "dashed",
  },

  /* Tasks */
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  statValue: {
    ...type.title,
    minWidth: 56,
  },
  statBody: {
    flex: 1,
  },
  statLabel: {
    ...type.subhead,
  },
  statBar: {
    marginTop: spacing.xs + 2,
  },
  reschedules: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  subheading: {
    ...type.overline,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  rescheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  rescheduleName: {
    ...type.callout,
    flex: 1,
  },
  rescheduleMeta: {
    ...type.footnote,
    color: colors.dangerText,
    fontWeight: "600",
  },

  /* Coach */
  dimmed: {
    opacity: 0.45,
  },
  metaText: {
    ...type.caption,
    fontWeight: "400",
    marginBottom: spacing.sm,
  },
  summaryText: {
    ...type.callout,
    marginBottom: spacing.md,
  },
  reportBlock: {
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
    marginBottom: spacing.md,
  },
  reportTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    marginBottom: spacing.xs,
  },
  reportTitle: {
    ...type.subhead,
    fontWeight: "700",
  },
  listItem: {
    ...type.footnote,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...type.subhead,
    textAlign: "center",
    paddingVertical: spacing.sm,
  },
});
