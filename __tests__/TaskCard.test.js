import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react-native";
import TaskCard, { resolveEcd } from "../components/TaskCard";
import { addDaysToDateKey, todayDateKey } from "../utils/ecd";

const today = todayDateKey();

function setup(taskOverrides = {}, props = {}) {
  const handlers = {
    onToggleDone: jest.fn(),
    onEdit: jest.fn(),
    onMoveUp: jest.fn(),
    onMoveDown: jest.fn(),
    onDelete: jest.fn(),
  };
  const task = {
    _id: "t1",
    name: "Review Q4 roadmap",
    done: false,
    notes: "Infra first",
    ecd: { type: "date", value: today },
    ...taskOverrides,
  };
  render(<TaskCard task={task} isFirst={false} isLast={false} {...handlers} {...props} />);
  return { task, ...handlers };
}

describe("resolveEcd", () => {
  it("labels today, tomorrow and overdue with matching tones", () => {
    expect(resolveEcd({ ecd: { type: "date", value: today } })).toMatchObject({
      label: "Today",
      tone: "primary",
    });
    expect(
      resolveEcd({ ecd: { type: "date", value: addDaysToDateKey(today, 1) } }).label,
    ).toBe("Tomorrow");
    const overdue = resolveEcd({ ecd: { type: "date", value: "2026-11-07" } }, "2026-11-09");
    expect(overdue).toMatchObject({ label: "Overdue · 11/07", tone: "danger" });
  });

  it("never calls a finished task overdue", () => {
    const r = resolveEcd({ done: true, ecd: { type: "date", value: "2026-11-07" } }, "2026-11-09");
    expect(r).toMatchObject({ label: "11/07", tone: "neutral" });
  });

  it("describes recurring schedules and shows nothing for undated tasks", () => {
    expect(resolveEcd({ ecd: { type: "day_of_week", value: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] } }).label).toBe("Daily");
    expect(resolveEcd({ ecd: { type: "day_of_month", value: [15, 1] } }).label).toBe("1st, 15th");
    expect(resolveEcd({ ecd: null })).toBeNull();
  });
});

describe("TaskCard", () => {
  it("shows the name, due label and notes", () => {
    setup();
    expect(screen.getByText("Review Q4 roadmap")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Infra first")).toBeTruthy();
  });

  it("keeps checkbox and ⋯ outside the row button so screen readers reach them", () => {
    setup();
    const row = screen.getByTestId("task-t1");
    expect(within(row).queryByRole("checkbox")).toBeNull();
    expect(within(row).queryByLabelText("More actions for Review Q4 roadmap")).toBeNull();
  });

  it("toggles done from its own checkbox", () => {
    const { onToggleDone } = setup();
    fireEvent.press(screen.getByRole("checkbox", { name: 'Mark "Review Q4 roadmap" done' }));
    expect(onToggleDone).toHaveBeenCalledWith("t1");
  });

  it("opens the edit sheet when the row is tapped and saves through onEdit", async () => {
    const { onEdit } = setup();
    fireEvent.press(screen.getByTestId("task-t1"));
    expect(screen.getByText("Edit task")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Task name"), "Review Q4 plan");
    fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(onEdit).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ name: "Review Q4 plan", ecd: { type: "date", value: today } }),
    );
  });

  it("runs Delete from the ⋯ menu", async () => {
    const { onDelete } = setup();
    fireEvent.press(screen.getByLabelText("More actions for Review Q4 roadmap"));
    fireEvent.press(screen.getByRole("button", { name: "Delete task" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("t1"));
  });

  it("keeps a done task from moving above an undone one (the done barrier)", () => {
    setup({ done: true }, { prevTaskDone: false, nextTaskDone: true });
    fireEvent.press(screen.getByLabelText("More actions for Review Q4 roadmap"));
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeEnabled();
  });

  it("locks name and schedule for goal-managed habits", () => {
    setup(
      { name: "Walk 20 min", ecd: { type: "day_of_week", value: ["Mon", "Wed"] } },
      { goalManaged: true, streak: { current: 5, longest: 9 } },
    );
    expect(
      screen.getByLabelText(
        "Current streak: 5 scheduled days in a row (best 9), counting only Mon, Wed",
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId("task-t1"));
    expect(screen.getByLabelText("Task name").props.editable).toBe(false);
    expect(screen.getByText("↻ Mon, Wed, for life")).toBeTruthy();
  });
});
