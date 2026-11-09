import React, { createRef } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from "@testing-library/react-native";
import GoalsSection from "../components/GoalsSection";
import * as goalsApi from "../api/goals";
import * as tasksApi from "../api/tasks";
import * as headersApi from "../api/headers";
import * as insightsApi from "../api/insights";

// Every network-backed module the panel (and utils/goalSync) imports — no
// test ever reaches the backend.
jest.mock("../api/goals", () => ({
  getAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));
jest.mock("../api/tasks", () => ({
  getAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));
jest.mock("../api/headers", () => ({
  getAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));
jest.mock("../api/insights", () => ({
  getStats: jest.fn(),
  getLatest: jest.fn(),
  generate: jest.fn(),
}));

const HEALTH = {
  _id: "g1",
  name: "Improve Health and Energy Every Single Day",
  priority: 0,
  // Stored unsorted on purpose: the started step must still render first.
  steps: [
    { name: "Have 1 fruit a day", status: "pending" },
    { name: "Wake up at 6", status: "under_progress", days: ["Mon", "Wed", "Fri"] },
    { name: "Walk 10k steps", status: "pending" },
  ],
};

const READING = {
  _id: "g2",
  name: "Read more",
  priority: 1,
  steps: [],
};

const ONE_STEP = { _id: "h1", name: "One Step At A Time" };

function renderPanel(props = {}) {
  const addRef = createRef();
  const onTasksChanged = jest.fn();
  render(<GoalsSection addRef={addRef} onTasksChanged={onTasksChanged} {...props} />);
  return { addRef, onTasksChanged };
}

/** Rows render in sorted (started-first) order; read the step names off them. */
function stepNamesInOrder() {
  return screen
    .getAllByRole("checkbox")
    .map((cb) => cb.props.accessibilityLabel.replace(/^(Start|Pause) "(.*)"$/, "$2"));
}

beforeEach(() => {
  jest.clearAllMocks();
  goalsApi.getAll.mockResolvedValue([HEALTH, READING]);
  goalsApi.create.mockResolvedValue({});
  goalsApi.update.mockResolvedValue({});
  goalsApi.remove.mockResolvedValue({});
  headersApi.getAll.mockResolvedValue([ONE_STEP]);
  headersApi.create.mockResolvedValue(ONE_STEP);
  tasksApi.getAll.mockResolvedValue([
    { _id: "t1", name: "wake up at 6", headerId: "h1" },
  ]);
  tasksApi.create.mockResolvedValue({});
  tasksApi.update.mockResolvedValue({});
  tasksApi.remove.mockResolvedValue({});
  insightsApi.getStats.mockResolvedValue({
    habits: [
      {
        headerName: "One Step At A Time",
        taskName: "Wake up at 6",
        currentStreak: 4,
        longestStreak: 9,
      },
    ],
  });
});

describe("GoalsSection — rendering", () => {
  it("renders goals from the API with progress, badges and the streak", async () => {
    renderPanel();

    // Full goal name, not truncated to a single line
    const name = await screen.findByText(HEALTH.name);
    expect(name.props.numberOfLines).toBe(2);
    expect(screen.getByText("Read more")).toBeTruthy();

    // Same numbers as the old "1/3 under progress" pill
    expect(screen.getByText("1 of 3 under progress")).toBeTruthy();
    expect(screen.getByText("33%")).toBeTruthy();
    expect(screen.getByTestId("goal-g1-progress").props.accessibilityValue.now).toBe(33);

    // Under-progress steps sort above the pending backlog
    expect(stepNamesInOrder()).toEqual([
      "Wake up at 6",
      "Have 1 fruit a day",
      "Walk 10k steps",
    ]);
    expect(screen.getByRole("checkbox", { name: 'Pause "Wake up at 6"' })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: 'Start "Have 1 fruit a day"' })).not.toBeChecked();

    expect(screen.getByText("Under progress")).toBeTruthy();
    expect(screen.getAllByText("Not started")).toHaveLength(2);
    expect(screen.getByText("Mon, Wed, Fri")).toBeTruthy();

    // Streak from GET /insights/stats, matched by task name
    expect(
      await screen.findByLabelText(
        "Current streak: 4 scheduled days in a row (best 9), counting only Mon, Wed, Fri",
      ),
    ).toBeTruthy();

    // A goal with no steps says so, and has no progress line
    expect(screen.getByText("No steps yet — add one!")).toBeTruthy();
    expect(screen.queryByText("0 of 0 under progress")).toBeNull();
  });

  it("hides the streak badge silently when stats fail", async () => {
    insightsApi.getStats.mockRejectedValue(new Error("stats down"));
    renderPanel();
    await screen.findByText(HEALTH.name);
    expect(screen.queryByLabelText(/Current streak/)).toBeNull();
    expect(screen.queryByText(/stats down/)).toBeNull();
  });

  it("shows the empty state when there are no goals", async () => {
    goalsApi.getAll.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText("No goals yet — add one!")).toBeTruthy();
    expect(screen.getByText(/Pause anytime to shelve one\./)).toBeTruthy();
  });

  it("gives every icon-only control an accessible name", async () => {
    renderPanel();
    await screen.findByText(HEALTH.name);
    expect(screen.getByLabelText(`Add step to ${HEALTH.name}`)).toBeTruthy();
    expect(screen.getByLabelText(`More actions for ${HEALTH.name}`)).toBeTruthy();
    expect(screen.getByLabelText("More actions for Walk 10k steps")).toBeTruthy();
  });
});

describe("GoalsSection — add goal", () => {
  it("opens the sheet through addRef and creates the goal with pending steps", async () => {
    const { addRef } = renderPanel();
    await screen.findByText(HEALTH.name);

    act(() => addRef.current.openAdd());
    expect(screen.getByText("Add goal")).toBeTruthy();

    // Add stays disabled until the goal has a name
    const add = screen.getByRole("button", { name: "Add" });
    expect(add).toBeDisabled();

    fireEvent.changeText(screen.getByLabelText("Goal name"), "  Run a marathon  ");
    fireEvent.changeText(screen.getByLabelText("Steps"), "Jog 1k\n\n  Jog 5k  \n");
    expect(screen.getByText(/— 2 steps/)).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(goalsApi.create).toHaveBeenCalledWith({
        name: "Run a marathon",
        steps: [
          { name: "Jog 1k", status: "pending" },
          { name: "Jog 5k", status: "pending" },
        ],
      }),
    );
    // Reloads, then closes the sheet
    await waitFor(() => expect(screen.queryByText("Add goal")).toBeNull());
    expect(goalsApi.getAll).toHaveBeenCalledTimes(2);
  });

  it("surfaces a failed create in a dismissible danger banner", async () => {
    goalsApi.create.mockRejectedValue(new Error("Name taken"));
    const { addRef } = renderPanel();
    await screen.findByText(HEALTH.name);

    act(() => addRef.current.openAdd());
    fireEvent.changeText(screen.getByLabelText("Goal name"), "Read more");
    fireEvent.press(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Action failed: Name taken")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss error"));
    expect(screen.queryByText("Action failed: Name taken")).toBeNull();
  });

  it("adds one step through the goal's + button", async () => {
    renderPanel();
    await screen.findByText(HEALTH.name);

    fireEvent.press(screen.getByLabelText(`Add step to ${HEALTH.name}`));
    fireEvent.changeText(screen.getByLabelText("Step name"), " Stretch ");
    fireEvent.press(screen.getByRole("button", { name: "Add step" }));

    await waitFor(() =>
      expect(goalsApi.update).toHaveBeenCalledWith("g1", {
        steps: [...HEALTH.steps, { name: "Stretch", status: "pending" }],
      }),
    );
  });
});

describe("GoalsSection — menus", () => {
  it("runs a goal menu action after the sheet closes (Move down)", async () => {
    renderPanel();
    await screen.findByText(HEALTH.name);

    fireEvent.press(screen.getByLabelText(`More actions for ${HEALTH.name}`));
    // First goal: can't move up, can move down
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    fireEvent.press(screen.getByRole("button", { name: "Move down" }));

    await waitFor(() =>
      expect(goalsApi.update).toHaveBeenCalledWith("g1", { priority: 1 }),
    );
  });

  it("deletes a goal through the menu and the centred confirm", async () => {
    renderPanel();
    await screen.findByText(HEALTH.name);

    fireEvent.press(screen.getByLabelText("More actions for Read more"));
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
    fireEvent.press(screen.getByRole("button", { name: "Delete goal" }));

    expect(
      await screen.findByText('Delete goal "Read more"? Tasks already added to the todo stay.'),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(goalsApi.remove).toHaveBeenCalledWith("g2"));
    await waitFor(() => expect(screen.queryByText("Read more")).toBeNull());
  });

  it("never offers a move across the started/pending barrier", async () => {
    renderPanel();
    await screen.findByText(HEALTH.name);

    // First pending step sits right below a started one: Move up is disabled
    fireEvent.press(screen.getByLabelText("More actions for Have 1 fruit a day"));
    const moveUp = screen.getByRole("button", { name: "Move up" });
    expect(moveUp).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeEnabled();
    // Pending steps have no schedule to change yet
    expect(screen.queryByRole("button", { name: "Set days" })).toBeNull();
    fireEvent.press(moveUp);
    expect(goalsApi.update).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Move up" })).toBeNull(),
    );

    // The started step can't drop into the backlog either
    fireEvent.press(screen.getByLabelText("More actions for Wake up at 6"));
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Set days" })).toBeEnabled();
  });

  it("moves a step within its own group, persisting the sorted list", async () => {
    renderPanel();
    await screen.findByText(HEALTH.name);

    fireEvent.press(screen.getByLabelText("More actions for Have 1 fruit a day"));
    fireEvent.press(screen.getByRole("button", { name: "Move down" }));

    await waitFor(() =>
      expect(goalsApi.update).toHaveBeenCalledWith("g1", {
        steps: [HEALTH.steps[1], HEALTH.steps[2], HEALTH.steps[0]],
      }),
    );
  });

  it("deleting a started step also deletes its One Step At A Time task", async () => {
    const { onTasksChanged } = renderPanel();
    await screen.findByText(HEALTH.name);

    fireEvent.press(screen.getByLabelText("More actions for Wake up at 6"));
    fireEvent.press(screen.getByRole("button", { name: "Delete step" }));
    expect(
      await screen.findByText(
        `Delete step "Wake up at 6" from "${HEALTH.name}"? Its daily task in "One Step At A Time" is removed too.`,
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(tasksApi.remove).toHaveBeenCalledWith("t1"));
    await waitFor(() =>
      expect(goalsApi.update).toHaveBeenCalledWith("g1", {
        steps: [HEALTH.steps[0], HEALTH.steps[2]],
      }),
    );
    expect(tasksApi.remove.mock.invocationCallOrder[0]).toBeLessThan(
      goalsApi.update.mock.invocationCallOrder[0],
    );
    await waitFor(() => expect(onTasksChanged).toHaveBeenCalled());
  });

  it("opens the same menu from a long press on the row", async () => {
    renderPanel();
    await screen.findByText(HEALTH.name);
    fireEvent(screen.getByLabelText(/^Walk 10k steps, Not started/), "longPress");
    expect(screen.getByRole("button", { name: "Delete step" })).toBeTruthy();
  });
});

describe("GoalsSection — step lifecycle", () => {
  it("checking a pending step asks for days, then starts it", async () => {
    const { onTasksChanged } = renderPanel();
    await screen.findByText(HEALTH.name);

    fireEvent.press(screen.getByRole("checkbox", { name: 'Start "Have 1 fruit a day"' }));
    // Sheet opens on the whole week (a step with no days means every day)
    expect(screen.getByRole("button", { name: "Every day" })).toBeSelected();

    fireEvent.press(screen.getByRole("button", { name: "Weekends" }));
    expect(screen.getByRole("button", { name: "Sat" })).toBeSelected();
    expect(screen.getByRole("button", { name: "Mon" })).not.toBeSelected();
    fireEvent.press(screen.getByRole("button", { name: "Start step" }));

    await waitFor(() =>
      expect(tasksApi.create).toHaveBeenCalledWith({
        name: "Have 1 fruit a day",
        headerId: "h1",
        notes: `Step towards "${HEALTH.name}"`,
        ecd: { type: "day_of_week", value: ["Sun", "Sat"] },
      }),
    );
    await waitFor(() =>
      expect(goalsApi.update).toHaveBeenCalledWith("g1", {
        steps: [
          HEALTH.steps[1],
          { ...HEALTH.steps[0], status: "under_progress", days: ["Sun", "Sat"] },
          HEALTH.steps[2],
        ],
      }),
    );
    expect(
      await screen.findByText(
        'Started "Have 1 fruit a day" — under progress every Sun, Sat in "One Step At A Time".',
      ),
    ).toBeTruthy();
    expect(onTasksChanged).toHaveBeenCalled();
  });

  it("keeps Start disabled until at least one day is picked", async () => {
    renderPanel();
    await screen.findByText(HEALTH.name);

    fireEvent.press(screen.getByRole("checkbox", { name: 'Start "Walk 10k steps"' }));
    fireEvent.press(screen.getByRole("button", { name: "Weekends" }));
    fireEvent.press(screen.getByRole("button", { name: "Sat" }));
    fireEvent.press(screen.getByRole("button", { name: "Sun" }));
    expect(
      screen.getByText("Pick at least one day — a habit needs a day to run on."),
    ).toBeTruthy();
    const start = screen.getByRole("button", { name: "Start step" });
    expect(start).toBeDisabled();
    fireEvent.press(start);
    expect(tasksApi.create).not.toHaveBeenCalled();
  });

  it("unchecking a started step pauses it and removes its task", async () => {
    const { onTasksChanged } = renderPanel();
    await screen.findByText(HEALTH.name);

    fireEvent.press(screen.getByRole("checkbox", { name: 'Pause "Wake up at 6"' }));

    await waitFor(() => expect(tasksApi.remove).toHaveBeenCalledWith("t1"));
    await waitFor(() =>
      expect(goalsApi.update).toHaveBeenCalledWith("g1", {
        // Patched in the sorted list, then re-sorted (stable): the paused
        // step heads the backlog
        steps: [
          { ...HEALTH.steps[1], status: "pending" },
          HEALTH.steps[0],
          HEALTH.steps[2],
        ],
      }),
    );
    expect(
      await screen.findByText(
        '"Wake up at 6" paused — moved back to the backlog and removed from the daily list.',
      ),
    ).toBeTruthy();
    expect(onTasksChanged).toHaveBeenCalled();
  });

  it("Set days reschedules a started step and rewrites its task's ECD", async () => {
    renderPanel();
    await screen.findByText(HEALTH.name);

    fireEvent.press(screen.getByLabelText("More actions for Wake up at 6"));
    fireEvent.press(screen.getByRole("button", { name: "Set days" }));

    // Runs after the action sheet has closed
    const save = await screen.findByRole("button", { name: "Save days" });
    expect(screen.getByText("Change days")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Wed" })).toBeSelected();
    fireEvent.press(screen.getByRole("button", { name: "Tue" }));
    fireEvent.press(save);

    await waitFor(() =>
      expect(tasksApi.update).toHaveBeenCalledWith("t1", {
        ecd: { type: "day_of_week", value: ["Mon", "Tue", "Wed", "Fri"] },
      }),
    );
    expect(
      await screen.findByText(
        '"Wake up at 6" is now due every Mon, Tue, Wed, Fri — its streak counts those days.',
      ),
    ).toBeTruthy();
    // The notice banner can be dismissed
    fireEvent.press(screen.getByLabelText("Dismiss notice"));
    expect(screen.queryByText(/is now due every/)).toBeNull();
  });
});

describe("GoalsSection — layout", () => {
  it("puts each goal on its own card", async () => {
    renderPanel();
    await screen.findByText(HEALTH.name);
    const card = screen.getByTestId("goal-g1");
    expect(within(card).getByText(HEALTH.name)).toBeTruthy();
    expect(within(card).queryByText("Read more")).toBeNull();
  });
});
