import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react-native";
import ProjectsSection from "../components/ProjectsSection";
import * as projectsApi from "../api/projects";
import * as headersApi from "../api/headers";
import * as tasksApi from "../api/tasks";
import { dateShortcuts } from "../components/EcdPicker";
import { todayDateKey } from "../utils/ecd";

/* No test ever reaches the real (production) backend. */
jest.mock("../api/projects", () => ({
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
jest.mock("../api/tasks", () => ({
  getAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));

const FUTURE = "2099-03-01";
const FUTURE_LATER = "2099-04-15";

/**
 * Fresh fixtures per call. The task order is the server's: dated undone,
 * then undated undone, then done.
 */
function stockProject() {
  return {
    _id: "p1",
    name: "Automated Stock Market",
    priority: 0,
    tasks: [
      {
        name: "Get EODHD data",
        notes: "",
        date: FUTURE,
        done: false,
        todoTaskId: "t1",
      },
      {
        name: "Build the backtester",
        notes: "use vectorbt",
        date: FUTURE_LATER,
        done: false,
        todoTaskId: "t2",
      },
      {
        name: "Pick a broker",
        notes: "",
        date: null,
        done: false,
        todoTaskId: null,
      },
      {
        name: "Sketch the idea",
        notes: "",
        date: null,
        done: true,
        todoTaskId: null,
      },
    ],
  };
}

function pianoProject() {
  return { _id: "p2", name: "Learn Piano", priority: 1, tasks: [] };
}

async function renderSection(props = {}) {
  const onTasksChanged = jest.fn();
  const addRef = React.createRef();
  render(
    <ProjectsSection
      onTasksChanged={onTasksChanged}
      addRef={addRef}
      {...props}
    />,
  );
  await screen.findByText("Automated Stock Market");
  return { onTasksChanged, addRef };
}

async function openMenu(label) {
  fireEvent.press(screen.getByLabelText(`More actions for ${label}`));
  await screen.findByRole("button", { name: "Move up" });
}

function closeMenu() {
  fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
}

beforeEach(() => {
  jest.clearAllMocks();
  projectsApi.getAll.mockImplementation(() =>
    Promise.resolve([stockProject(), pianoProject()]),
  );
  projectsApi.create.mockResolvedValue({});
  projectsApi.update.mockResolvedValue({});
  projectsApi.remove.mockResolvedValue({});
  headersApi.getAll.mockResolvedValue([]);
  headersApi.create.mockResolvedValue({ _id: "h1" });
  tasksApi.getAll.mockResolvedValue([]);
  tasksApi.create.mockResolvedValue({ _id: "todo-new" });
  tasksApi.update.mockResolvedValue({});
  tasksApi.remove.mockResolvedValue({});
});

describe("ProjectsSection rendering", () => {
  it("renders every project from the API with its tasks and progress", async () => {
    await renderSection();

    expect(projectsApi.getAll).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Learn Piano")).toBeTruthy();
    // Full project name, done/total meta line and a progress bar
    expect(screen.getByText("1/4 done")).toBeTruthy();
    expect(
      screen.getByTestId("project-progress-p1").props.accessibilityValue.now,
    ).toBe(25);
    expect(screen.queryByTestId("project-progress-p2")).toBeNull();
    // Task rows: name, date badge, "No date" badge, notes preview
    expect(screen.getByText("Get EODHD data")).toBeTruthy();
    expect(screen.getByText("03/01/99")).toBeTruthy();
    expect(screen.getAllByText("No date")).toHaveLength(2);
    expect(screen.getByText("use vectorbt")).toBeTruthy();
    // Done task is checked
    expect(
      screen.getByRole("checkbox", { name: 'Mark "Sketch the idea" not done' }),
    ).toBeChecked();
    // A project with no tasks keeps its hint
    expect(
      screen.getByText(
        "No tasks yet — add the steps that get this project done.",
      ),
    ).toBeTruthy();
    // Icon-only controls carry accessible names
    expect(
      screen.getByLabelText("Add task to Automated Stock Market"),
    ).toBeTruthy();
    expect(screen.getByLabelText("More actions for Learn Piano")).toBeTruthy();
  });

  it("tones the date badge: Today in brand, overdue-and-undone in red", async () => {
    projectsApi.getAll.mockResolvedValue([
      {
        _id: "p1",
        name: "Automated Stock Market",
        priority: 0,
        tasks: [
          { name: "Due now", date: todayDateKey(), done: false },
          { name: "Late", date: "2001-02-03", done: false },
          { name: "Late but done", date: "2001-02-04", done: true },
        ],
      },
    ]);
    await renderSection();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Overdue · 02/03/01")).toBeTruthy();
    // Done tasks are never overdue
    expect(screen.getByText("02/04/01")).toBeTruthy();
  });

  it("shows the compact empty state with the original guidance", async () => {
    projectsApi.getAll.mockResolvedValue([]);
    render(<ProjectsSection onTasksChanged={jest.fn()} addRef={React.createRef()} />);
    expect(await screen.findByText("No projects yet — add one!")).toBeTruthy();
    expect(
      screen.getByText(/A long term project \(e\.g\. "Automated Stock Market"\)/),
    ).toBeTruthy();
  });
});

describe("adding a project through addRef.openAdd()", () => {
  it("opens the sheet, submits the trimmed name and reloads", async () => {
    const { addRef } = await renderSection();
    projectsApi.getAll.mockImplementation(() =>
      Promise.resolve([
        stockProject(),
        pianoProject(),
        { _id: "p3", name: "Write a novel", priority: 2, tasks: [] },
      ]),
    );

    act(() => addRef.current.openAdd());
    expect(screen.getByText("Add project")).toBeTruthy();
    const add = screen.getByRole("button", { name: "Add" });
    expect(add).toBeDisabled();

    fireEvent.changeText(screen.getByLabelText("Project name"), "  Write a novel  ");
    fireEvent.press(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(projectsApi.create).toHaveBeenCalledWith({ name: "Write a novel" }),
    );
    expect(await screen.findByText("Write a novel")).toBeTruthy();
    expect(projectsApi.getAll).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByLabelText("Project name")).toBeNull());
  });

  it("keeps the sheet open and shows a dismissible banner when the save fails", async () => {
    const { addRef } = await renderSection();
    projectsApi.create.mockRejectedValueOnce(new Error("Network down"));

    act(() => addRef.current.openAdd());
    fireEvent.changeText(screen.getByLabelText("Project name"), "Write a novel");
    fireEvent.press(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Action failed: Network down")).toBeTruthy();
    expect(screen.getByLabelText("Project name")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText("Action failed: Network down")).toBeNull();
  });
});

describe("project ⋯ menu", () => {
  it("disables Move up on the first project and Move down on the last", async () => {
    await renderSection();

    await openMenu("Automated Stock Market");
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeEnabled();
    closeMenu();

    await openMenu("Learn Piano");
    expect(screen.getByRole("button", { name: "Move up" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
  });

  it("deletes a project after the sheet closes and the dialog confirms", async () => {
    const { onTasksChanged } = await renderSection();

    await openMenu("Learn Piano");
    fireEvent.press(screen.getByRole("button", { name: "Delete project" }));

    // The action runs after the sheet has closed
    expect(
      await screen.findByText(
        'Delete project "Learn Piano"? Tasks already added to the todo stay.',
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(projectsApi.remove).toHaveBeenCalledWith("p2"));
    await waitFor(() => expect(onTasksChanged).toHaveBeenCalledTimes(1));
    expect(projectsApi.getAll).toHaveBeenCalledTimes(2);
  });

  it("moves a project with a priority write, then reloads the todo", async () => {
    const { onTasksChanged } = await renderSection();

    await openMenu("Automated Stock Market");
    fireEvent.press(screen.getByRole("button", { name: "Move down" }));

    await waitFor(() =>
      expect(projectsApi.update).toHaveBeenCalledWith("p1", { priority: 1 }),
    );
    await waitFor(() => expect(onTasksChanged).toHaveBeenCalled());
  });
});

describe("project task rows", () => {
  it("never offers a move across the dated/undated or done barrier", async () => {
    await renderSection();

    // Dated undone, first: down stays inside the dated group
    await openMenu("Get EODHD data");
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeEnabled();
    closeMenu();

    // Last dated undone: the next task is undated
    await openMenu("Build the backtester");
    expect(screen.getByRole("button", { name: "Move up" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
    closeMenu();

    // Only undated undone: above is dated, below is done
    await openMenu("Pick a broker");
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
    closeMenu();

    // Done, last: above is undone
    await openMenu("Sketch the idea");
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();

    // A disabled move does nothing at all
    fireEvent.press(screen.getByRole("button", { name: "Move up" }));
    await new Promise((r) => setTimeout(r, 700));
    expect(projectsApi.update).not.toHaveBeenCalled();
  });

  it("swaps within a group and mirrors the order into the todo", async () => {
    const { onTasksChanged } = await renderSection();
    headersApi.getAll.mockResolvedValue([
      { _id: "h1", name: "Automated Stock Market", projectId: "p1" },
    ]);
    tasksApi.getAll.mockResolvedValue([
      { _id: "t1", priority: 0 },
      { _id: "t2", priority: 1 },
    ]);

    await openMenu("Get EODHD data");
    fireEvent.press(screen.getByRole("button", { name: "Move down" }));

    await waitFor(() =>
      expect(tasksApi.update).toHaveBeenCalledWith("t1", { priority: 1 }),
    );
    const [first, second, ...rest] = stockProject().tasks;
    expect(projectsApi.update).toHaveBeenCalledWith("p1", {
      tasks: [second, first, ...rest],
    });
    expect(tasksApi.getAll).toHaveBeenCalledWith("h1");
    // Sequential: project write, header lookup, todo read, todo write
    expect(projectsApi.update.mock.invocationCallOrder[0]).toBeLessThan(
      headersApi.getAll.mock.invocationCallOrder[0],
    );
    expect(headersApi.getAll.mock.invocationCallOrder[0]).toBeLessThan(
      tasksApi.getAll.mock.invocationCallOrder[0],
    );
    expect(tasksApi.getAll.mock.invocationCallOrder[0]).toBeLessThan(
      tasksApi.update.mock.invocationCallOrder[0],
    );
    expect(onTasksChanged).toHaveBeenCalledTimes(1);
  });

  it("adds a dated task: header via POST /headers, then the todo task, then the project", async () => {
    const { onTasksChanged } = await renderSection();
    const tomorrow = dateShortcuts()[1].value;

    fireEvent.press(screen.getByLabelText("Add task to Automated Stock Market"));
    expect(screen.getByText("in Automated Stock Market")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Task name"), "  Paper trade  ");
    fireEvent.press(screen.getByRole("button", { name: "Date" }));
    fireEvent.press(screen.getByRole("button", { name: "Tomorrow" }));
    expect(screen.getByRole("button", { name: "Tomorrow" })).toBeSelected();
    expect(
      screen.getByText('Will appear in the todo under "Automated Stock Market"'),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Add task" }));

    await waitFor(() => expect(projectsApi.update).toHaveBeenCalled());
    expect(headersApi.create).toHaveBeenCalledWith({
      name: "Automated Stock Market",
      projectId: "p1",
    });
    expect(tasksApi.create).toHaveBeenCalledWith({
      name: "Paper trade",
      headerId: "h1",
      notes: 'Step towards "Automated Stock Market"',
      ecd: { type: "date", value: tomorrow },
    });
    expect(projectsApi.update).toHaveBeenCalledWith("p1", {
      tasks: [
        ...stockProject().tasks,
        {
          name: "Paper trade",
          notes: "",
          date: tomorrow,
          done: false,
          todoTaskId: "todo-new",
        },
      ],
    });
    expect(headersApi.create.mock.invocationCallOrder[0]).toBeLessThan(
      tasksApi.create.mock.invocationCallOrder[0],
    );
    expect(tasksApi.create.mock.invocationCallOrder[0]).toBeLessThan(
      projectsApi.update.mock.invocationCallOrder[0],
    );
    await waitFor(() => expect(onTasksChanged).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByLabelText("Task name")).toBeNull());
  });

  it("opens the edit sheet prefilled when the row is tapped", async () => {
    await renderSection();

    fireEvent.press(screen.getByText("Build the backtester"));

    expect(screen.getByText("Edit task")).toBeTruthy();
    expect(screen.getByLabelText("Task name").props.value).toBe(
      "Build the backtester",
    );
    expect(screen.getByLabelText("Notes").props.value).toBe("use vectorbt");
    expect(screen.getByRole("button", { name: "Date" })).toBeSelected();
    expect(screen.getByText("Wed, 15 April 2099")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("toggles done through the linked todo task first", async () => {
    const { onTasksChanged } = await renderSection();

    fireEvent.press(
      screen.getByRole("checkbox", { name: 'Mark "Get EODHD data" done' }),
    );

    await waitFor(() => expect(projectsApi.update).toHaveBeenCalled());
    expect(tasksApi.update).toHaveBeenCalledWith("t1", { done: true });
    expect(tasksApi.update.mock.invocationCallOrder[0]).toBeLessThan(
      projectsApi.update.mock.invocationCallOrder[0],
    );
    await waitFor(() => expect(onTasksChanged).toHaveBeenCalledTimes(1));
  });

  it("deletes a task from its menu, removing the todo entry with a reason", async () => {
    const { onTasksChanged } = await renderSection();

    await openMenu("Get EODHD data");
    fireEvent.press(screen.getByRole("button", { name: "Delete task" }));

    expect(
      await screen.findByText(
        'Delete task "Get EODHD data" from "Automated Stock Market"? Its todo entry is removed too.',
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(tasksApi.remove).toHaveBeenCalledWith(
        "t1",
        "Removed from long term project",
      ),
    );
    await waitFor(() =>
      expect(projectsApi.update).toHaveBeenCalledWith("p1", {
        tasks: stockProject().tasks.slice(1),
      }),
    );
    await waitFor(() => expect(onTasksChanged).toHaveBeenCalledTimes(1));
  });
});
