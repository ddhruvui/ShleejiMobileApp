import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react-native";
import TodoScreen, { todayLine } from "../../screens/TodoScreen";
import * as headersApi from "../../api/headers";
import * as tasksApi from "../../api/tasks";
import * as vacationsApi from "../../api/vacations";
import { addDaysToDateKey, todayDateKey } from "../../utils/ecd";
import { pauseAllStartedSteps } from "../../utils/goalSync";
import {
  syncProjectTasksForTodoDone,
  unlinkProjectTasksForTodoTasks,
} from "../../utils/projectSync";

jest.mock("../../api/headers", () => ({
  getAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(() => Promise.resolve({})),
  remove: jest.fn(() => Promise.resolve({})),
}));
jest.mock("../../api/tasks", () => ({
  getAll: jest.fn(),
  create: jest.fn(() => Promise.resolve({})),
  update: jest.fn(() => Promise.resolve({})),
  remove: jest.fn(() => Promise.resolve({})),
}));
jest.mock("../../api/vacations", () => ({
  getStatus: jest.fn(),
  getAll: jest.fn(() => Promise.resolve([])),
}));
jest.mock("../../api/oncall", () => ({ getAll: jest.fn(() => Promise.resolve([])) }));
jest.mock("../../utils/goalSync", () => ({
  ...jest.requireActual("../../utils/goalSync"),
  fetchOneStepStreaks: jest.fn(() => Promise.resolve(null)),
  pauseStepsMatchingTask: jest.fn(() => Promise.resolve()),
  pauseAllStartedSteps: jest.fn(() => Promise.resolve()),
}));
jest.mock("../../utils/projectSync", () => ({
  syncProjectTasksForTodoDone: jest.fn(() => Promise.resolve()),
  syncProjectTasksForTodoEdit: jest.fn(() => Promise.resolve()),
  syncProjectTaskOrderForTodo: jest.fn(() => Promise.resolve()),
  unlinkProjectTasksForTodoTasks: jest.fn(() => Promise.resolve()),
}));
jest.mock("../../utils/lifeEventSync", () => ({
  syncLifeEventsForTodoDone: jest.fn(() => Promise.resolve()),
  syncLifeEventsForTodoEdit: jest.fn(() => Promise.resolve()),
  unlinkLifeEventsForTodoTasks: jest.fn(() => Promise.resolve()),
}));

// Panels are tested on their own; here they only need to show up and expose
// the add hook the title-bar "+" reaches into.
const mockOpenAdd = jest.fn();
function mockPanel(label) {
  const React = require("react");
  const { Text } = require("react-native");
  return function Panel({ addRef }) {
    React.useImperativeHandle(addRef, () => ({ openAdd: () => mockOpenAdd(label) }));
    return <Text>{`${label} panel`}</Text>;
  };
}
jest.mock("../../components/InsightsSection", () => mockPanel("Insights"));
jest.mock("../../components/EventsSection", () => mockPanel("Events"));
jest.mock("../../components/LifeEventsSection", () => mockPanel("Life Events"));
jest.mock("../../components/GoalsSection", () => mockPanel("Goals"));
jest.mock("../../components/ProjectsSection", () => mockPanel("Projects"));
jest.mock("../../components/VacationSection", () => mockPanel("Vacation"));
jest.mock("../../components/OnCallSection", () => mockPanel("On-call"));

const today = todayDateKey();
const HEADERS = [
  { _id: "w", name: "Work", priority: 0 },
  { _id: "o", name: "One Step At A Time", priority: 1 },
];
const TASKS = {
  w: [
    { _id: "t1", headerId: "w", name: "Review roadmap", done: false, priority: 0, ecd: { type: "date", value: today } },
    { _id: "t2", headerId: "w", name: "Fix flaky CI", done: false, priority: 1, ecd: { type: "date", value: addDaysToDateKey(today, -2) } },
    { _id: "t3", headerId: "w", name: "Book flights", done: true, priority: 2, ecd: null },
  ],
  o: [
    { _id: "h1", headerId: "o", name: "Walk 20 min", done: false, priority: 0, ecd: { type: "day_of_week", value: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] } },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  headersApi.getAll.mockResolvedValue(HEADERS);
  tasksApi.getAll.mockImplementation((id) => Promise.resolve(TASKS[id]));
  vacationsApi.getStatus.mockResolvedValue({ onVacation: false });
});

async function renderTodo() {
  render(<TodoScreen />);
  await screen.findByText("Review roadmap");
}

describe("TodoScreen", () => {
  it("shows today's date and how many open tasks are due today", async () => {
    await renderTodo();
    expect(screen.getByText(`${todayLine()} · 2 due today`)).toBeTruthy();
    expect(screen.getByText("Work")).toBeTruthy();
    expect(screen.getByText("Overdue · " + addDaysToDateKey(today, -2).slice(5).replace("-", "/"))).toBeTruthy();
  });

  it("points the one title-bar + at whichever view is showing", async () => {
    await renderTodo();
    expect(screen.getByLabelText("Add header")).toBeTruthy();

    fireEvent.press(screen.getByTestId("chip-goals"));
    expect(screen.getByText("Goals panel")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Add goal"));
    expect(mockOpenAdd).toHaveBeenCalledWith("Goals");

    fireEvent.press(screen.getByTestId("chip-insights"));
    expect(screen.getByText("Insights panel")).toBeTruthy();
    expect(screen.queryByLabelText(/^Add /)).toBeNull(); // nothing to add in Insights

    fireEvent.press(screen.getByTestId("chip-insights")); // tap again → back to tasks
    expect(screen.getByText("Review roadmap")).toBeTruthy();
    expect(screen.getByLabelText("Add header")).toBeTruthy();
  });

  it("groups open tasks by date into Today and Overdue, hiding done ones", async () => {
    await renderTodo();
    fireEvent.press(screen.getByRole("tab", { name: "By date" }));
    // "Today" is both the section label and the task's due badge
    expect(screen.getAllByText("Today").length).toBeGreaterThan(1);
    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(screen.getByText("Walk 20 min")).toBeTruthy(); // recurring, due today
    expect(screen.queryByText("Book flights")).toBeNull();
  });

  it("toggles a task and mirrors it to linked projects", async () => {
    await renderTodo();
    fireEvent.press(screen.getByRole("checkbox", { name: 'Mark "Review roadmap" done' }));
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledWith("t1", { done: true }));
    await waitFor(() => expect(syncProjectTasksForTodoDone).toHaveBeenCalledWith("t1", true));
  });

  it("asks why before deleting an unfinished task", async () => {
    await renderTodo();
    fireEvent.press(screen.getByLabelText("More actions for Fix flaky CI"));
    fireEvent.press(screen.getByRole("button", { name: "Delete task" }));
    expect(await screen.findByText('Delete task "Fix flaky CI"?')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Why are you deleting this?"), "duplicate");
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(tasksApi.remove).toHaveBeenCalledWith("t2", "duplicate"));
    await waitFor(() => expect(screen.queryByText('Delete task "Fix flaky CI"?')).toBeNull());
  });

  it("reorders and deletes headers from their ⋯ menu", async () => {
    await renderTodo();
    fireEvent.press(screen.getByLabelText("More actions for Work"));
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    fireEvent.press(screen.getByRole("button", { name: "Move down" }));
    await waitFor(() => expect(headersApi.update).toHaveBeenCalledWith("w", { priority: 1 }));
    await waitFor(() => expect(headersApi.getAll).toHaveBeenCalledTimes(2)); // reloads order
  });

  it("pauses started goal steps when One Step At A Time is deleted", async () => {
    await renderTodo();
    fireEvent.press(screen.getByLabelText("More actions for One Step At A Time"));
    fireEvent.press(screen.getByRole("button", { name: "Delete header" }));
    expect(
      await screen.findByText('Delete header "One Step At A Time" and all its tasks?'),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(headersApi.remove).toHaveBeenCalledWith("o"));
    await waitFor(() => expect(pauseAllStartedSteps).toHaveBeenCalled());
    expect(unlinkProjectTasksForTodoTasks).toHaveBeenCalledWith(["h1"]);
    await waitFor(() => expect(screen.queryByText(/Delete header "One Step/)).toBeNull());
  });

  it("adds a task to a header from its +", async () => {
    await renderTodo();
    fireEvent.press(screen.getByLabelText("Add task to Work"));
    fireEvent.changeText(screen.getByLabelText("Task name"), "Write retro");
    fireEvent.press(screen.getByRole("button", { name: "Add task" }));
    await waitFor(() =>
      expect(tasksApi.create).toHaveBeenCalledWith({
        name: "Write retro",
        headerId: "w",
        notes: "",
        ecd: null,
      }),
    );
  });

  it("shows an active vacation and jumps to the Vacation view", async () => {
    vacationsApi.getStatus.mockResolvedValue({
      onVacation: true,
      active: { dayOfVacation: 2, totalDays: 5, note: "Goa" },
    });
    await renderTodo();
    const banner = await screen.findByTestId("vacation-banner");
    expect(within(banner).getByText(/day 2 of 5 · Goa/)).toBeTruthy();
    fireEvent.press(banner);
    expect(screen.getByText("Vacation panel")).toBeTruthy();
  });

  it("reports a failed action in a dismissible banner", async () => {
    tasksApi.update.mockRejectedValueOnce(new Error("Server down"));
    await renderTodo();
    fireEvent.press(screen.getByRole("checkbox", { name: 'Mark "Review roadmap" done' }));
    expect(await screen.findByText("Action failed: Server down")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText("Action failed: Server down")).toBeNull();
  });

  it("offers Retry when the list can't load", async () => {
    headersApi.getAll.mockRejectedValueOnce(new Error("Network request failed"));
    render(<TodoScreen />);
    expect(await screen.findByText("Network request failed")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Review roadmap")).toBeTruthy();
  });
});
