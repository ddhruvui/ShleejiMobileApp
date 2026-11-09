import {
  addDaysToDateKey,
  buildEcdFromInputs,
  formatDateKey,
  getEcdDateKey,
  isPushedLater,
  isTaskDueToday,
  todayDateKey,
} from "../../utils/ecd";
import { dateShortcuts, prettyDateKey, formatDateToISO } from "../../components/EcdPicker";

describe("ECD helpers", () => {
  afterEach(() => jest.useRealTimers());

  it("builds each ECD type and rejects bad input", () => {
    expect(buildEcdFromInputs({ mode: "none" })).toEqual({ ecd: null, error: null });
    expect(buildEcdFromInputs({ mode: "date", dateVal: "2026-11-12" }).ecd).toEqual({
      type: "date",
      value: "2026-11-12",
    });
    expect(buildEcdFromInputs({ mode: "date", dateVal: "12/11/2026" }).error).toMatch(
      /YYYY-MM-DD/,
    );
    expect(buildEcdFromInputs({ mode: "week", dowVal: ["Mon", "Fri"] }).ecd).toEqual({
      type: "day_of_week",
      value: ["Mon", "Fri"],
    });
    expect(buildEcdFromInputs({ mode: "week", dowVal: [] }).error).toBeTruthy();
    expect(buildEcdFromInputs({ mode: "month", domVal: [32] }).error).toBeTruthy();
    expect(buildEcdFromInputs({ mode: "year", yearVal: " 9/11/2026 " }).ecd).toEqual({
      type: "day_of_year",
      value: "9/11/2026",
    });
  });

  it("rolls date keys over month and year ends without timezone drift", () => {
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(formatDateKey("2026-11-09")).toBe("Mon, Nov 9, 2026");
  });

  it("only counts a later one-time date as a postpone", () => {
    const from = { type: "date", value: "2026-11-09" };
    expect(isPushedLater(from, { type: "date", value: "2026-11-10" })).toBe(true);
    expect(isPushedLater(from, { type: "date", value: "2026-11-08" })).toBe(false);
    expect(isPushedLater(from, { type: "day_of_week", value: ["Mon"] })).toBe(false);
  });

  it("surfaces recurring tasks under today only when due today", () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 9, 21, 30) }); // Mon 9 Nov, 9:30 pm
    expect(todayDateKey()).toBe("2026-11-09");
    expect(isTaskDueToday({ type: "day_of_week", value: ["Mon"] })).toBe(true);
    expect(getEcdDateKey({ type: "day_of_week", value: ["Mon"] })).toBe("2026-11-09");
    expect(getEcdDateKey({ type: "day_of_week", value: ["Tue"] })).toBeNull();
    expect(getEcdDateKey({ type: "day_of_year", value: "5/1/2027" })).toBe("2027-01-05");
  });
});

describe("date picker helpers", () => {
  it("formats the local calendar date, even late in the evening", () => {
    expect(formatDateToISO(new Date(2026, 10, 9, 23, 59))).toBe("2026-11-09");
  });

  it("offers today, tomorrow and the next Monday (never today)", () => {
    const fromMonday = dateShortcuts(new Date(2026, 10, 9)); // Monday
    expect(fromMonday.map((s) => s.value)).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-16",
    ]);
    const fromSunday = dateShortcuts(new Date(2026, 10, 15)); // Sunday
    expect(fromSunday[2].value).toBe("2026-11-16");
  });

  it("reads date keys aloud-friendly", () => {
    expect(prettyDateKey("2026-11-12")).toBe("Thu, 12 November 2026");
    expect(prettyDateKey("")).toBe("");
  });
});
