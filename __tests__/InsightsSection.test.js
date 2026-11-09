import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import InsightsSection from "../components/InsightsSection";
import * as insightsApi from "../api/insights";

jest.mock("../api/insights", () => ({
  getStats: jest.fn(),
  getLatest: jest.fn(),
  generate: jest.fn(),
}));

const STATS = {
  eventCount: 30,
  periodDays: 28,
  habits: [
    {
      taskName: "Meditate",
      headerName: "One Step At A Time",
      completionRate: 86,
      completed: 12,
      scheduled: 14,
      currentStreak: 5,
      longestStreak: 9,
      lifetimeCompleted: 40,
      pausedDays: 2,
      recentResults: [
        { dueDate: "2026-11-01", completed: true },
        { dueDate: "2026-11-02", completed: false, vacation: true },
        { dueDate: "2026-11-03", completed: false },
      ],
    },
  ],
  oneTimeTasks: { completedCount: 7, onTimeCount: 5, avgSlippageDays: 2 },
  reschedules: [
    { taskName: "File taxes", headerName: "Admin", total: 4, pushedLater: 3 },
  ],
  vacation: { onVacation: false, vacationDaysInWindow: 2 },
};

const LATEST = {
  generatedAt: "2026-11-08T06:00:00Z",
  report: {
    summary: "Solid week overall.",
    habitsOnTrack: ["Meditate is steady"],
    habitsSlipping: [],
    taskInsights: [],
    procrastinationFlags: ["Taxes keep moving"],
    callReminders: [],
    suggestions: ["Keep the morning slot"],
  },
};

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 10, 9, 8, 0, 0) });
  insightsApi.getStats.mockResolvedValue(STATS);
  insightsApi.getLatest.mockResolvedValue(LATEST);
  insightsApi.generate.mockResolvedValue(LATEST);
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe("InsightsSection", () => {
  it("shows the loading text, then the key numbers from the stats", async () => {
    render(<InsightsSection />);
    expect(screen.getByText("Loading insights…")).toBeTruthy();

    // Habit card
    expect(await screen.findByText("86%")).toBeTruthy();
    expect(screen.getByText("Meditate")).toBeTruthy();
    expect(screen.getByText("12/14")).toBeTruthy();
    expect(screen.getByText("streak 5 (best 9)")).toBeTruthy();
    expect(screen.getByText("Done 40 times all-time")).toBeTruthy();
    expect(screen.getByText("2 vacation days excluded")).toBeTruthy();
    expect(screen.getByText(/in this period are excluded from the rates below/)).toBeTruthy();

    // Tasks card
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("one-time tasks completed in the last 28 days")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("on or before the planned date")).toBeTruthy();
    expect(screen.getByText("2 days")).toBeTruthy();
    expect(screen.getByText("Most rescheduled:")).toBeTruthy();
    expect(screen.getByText("File taxes")).toBeTruthy();
    expect(screen.getByText("moved 4× (3× pushed later)")).toBeTruthy();

    // Ratios become progress bars: habit rate 86%, on-time 5/7 ≈ 71%
    const pct = (id) => screen.getByTestId(id).props.accessibilityValue.now;
    expect(pct("habit-rate-Meditate")).toBe(86);
    expect(pct("insights-on-time-bar")).toBe(71);

    // Coach report
    expect(screen.getByText("Solid week overall.")).toBeTruthy();
    expect(screen.getByText("• Taxes keep moving")).toBeTruthy();

    // Same order as before: Habits, Tasks, Coach
    const headers = screen.getAllByRole("header").map((h) => h.props.children);
    expect(headers).toEqual(["Habits", "Tasks", "Coach"]);
  });

  it("generates a fresh report on demand", async () => {
    render(<InsightsSection />);
    fireEvent.press(await screen.findByRole("button", { name: "Generate now" }));
    await waitFor(() => expect(insightsApi.generate).toHaveBeenCalledTimes(1));
  });

  it("surfaces a stats failure as a dismissible error banner", async () => {
    insightsApi.getStats.mockRejectedValue(new Error("boom"));
    insightsApi.getLatest.mockRejectedValue(new Error("none"));
    render(<InsightsSection />);
    expect(await screen.findByText("Insights error: boom")).toBeTruthy();
    expect(screen.getByText("No habit history yet")).toBeTruthy();
    expect(screen.getByText("No task history yet")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText("Insights error: boom")).toBeNull();
  });
});
