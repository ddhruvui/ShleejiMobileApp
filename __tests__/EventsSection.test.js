import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react-native";
import EventsSection from "../components/EventsSection";
import { formatDateToISO } from "../components/EcdPicker";
import * as eventsApi from "../api/events";
import * as headersApi from "../api/headers";
import * as tasksApi from "../api/tasks";

jest.mock("../api/events", () => ({
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

const EVENTS = [
  {
    _id: "e1",
    name: "Burger Night",
    tasks: ["Procure onion", "Procure bun", "Grill patties"],
  },
  { _id: "e2", name: "Movie Night", tasks: ["Popcorn"] },
];

function renderSection(props = {}) {
  const addRef = React.createRef();
  const onTasksAdded = jest.fn();
  const onViewTodo = jest.fn();
  render(
    <EventsSection
      onTasksAdded={onTasksAdded}
      onViewTodo={onViewTodo}
      addRef={addRef}
      {...props}
    />,
  );
  return { addRef, onTasksAdded, onViewTodo };
}

beforeEach(() => {
  jest.clearAllMocks();
  eventsApi.getAll.mockResolvedValue(EVENTS);
});

describe("EventsSection", () => {
  it("renders the event templates from the API, first one expanded", async () => {
    renderSection();
    expect(await screen.findByText("Burger Night")).toBeTruthy();
    expect(screen.getByText("Movie Night")).toBeTruthy();
    // The first event starts open, showing its task list in template order
    expect(
      screen.getByRole("button", { name: "Collapse Burger Night" }),
    ).toBeTruthy();
    expect(screen.getByText("Procure onion")).toBeTruthy();
    expect(screen.getByText("Grill patties")).toBeTruthy();
    // Others start collapsed with a one-line preview instead of rows
    expect(
      screen.getByRole("button", { name: "Expand Movie Night" }),
    ).toBeTruthy();
    expect(screen.getByText("1 task · Popcorn")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add Burger Night to todo" }),
    ).toBeTruthy();
  });

  it("toggles the accordion when the header is tapped", async () => {
    renderSection();
    fireEvent.press(
      await screen.findByRole("button", { name: "Expand Movie Night" }),
    );
    expect(screen.getByText("Popcorn")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add Movie Night to todo" }),
    ).toBeTruthy();
  });

  it("shows the empty state with the original wording", async () => {
    eventsApi.getAll.mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText("No events yet — add one!")).toBeTruthy();
    expect(
      screen.getByText(
        'An event is a reusable bundle of tasks (e.g. "Burger Night") you can drop into your todo for any date.',
      ),
    ).toBeTruthy();
  });

  it("adds an event through addRef.openAdd()", async () => {
    eventsApi.create.mockResolvedValue({ _id: "e3" });
    const { addRef } = renderSection();
    await screen.findByText("Burger Night");

    act(() => addRef.current.openAdd());

    const save = screen.getByRole("button", { name: "Add event" });
    expect(save).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText("Event name"), "  Taco Tuesday ");
    fireEvent.changeText(
      screen.getByLabelText("Tasks"),
      "Buy shells\n\n  Chop onions \n",
    );
    expect(screen.getByText("One task per line — 2 tasks")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Add event" }));

    await waitFor(() =>
      expect(eventsApi.create).toHaveBeenCalledWith({
        name: "Taco Tuesday",
        tasks: ["Buy shells", "Chop onions"],
      }),
    );
    // Refetches after saving, then the sheet closes
    await waitFor(() => expect(eventsApi.getAll).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByLabelText("Event name")).toBeNull(),
    );
  });

  it("schedules an event by creating its tasks one at a time, in template order", async () => {
    headersApi.getAll.mockResolvedValue([{ _id: "h0", name: "Groceries" }]);
    headersApi.create.mockResolvedValue({ _id: "h1", name: "Burger Night" });
    const log = [];
    tasksApi.create.mockImplementation(async (body) => {
      log.push(`start ${body.name}`);
      // Yield so an overlapping (parallel) caller would interleave here
      await new Promise((resolve) => setTimeout(resolve, 5));
      log.push(`end ${body.name}`);
      return { _id: `t-${body.name}` };
    });
    const { onTasksAdded, onViewTodo } = renderSection();

    fireEvent.press(
      await screen.findByRole("button", { name: "Add Burger Night to todo" }),
    );
    // All tasks are pre-selected; the date defaults to today
    expect(
      screen.getByRole("checkbox", { name: "Procure onion" }),
    ).toBeChecked();
    fireEvent.press(screen.getByRole("button", { name: "Add 3 tasks" }));

    await waitFor(() => expect(onTasksAdded).toHaveBeenCalledTimes(1));

    expect(log).toEqual([
      "start Procure onion",
      "end Procure onion",
      "start Procure bun",
      "end Procure bun",
      "start Grill patties",
      "end Grill patties",
    ]);
    const today = formatDateToISO(new Date());
    expect(tasksApi.create.mock.calls.map(([body]) => body)).toEqual(
      ["Procure onion", "Procure bun", "Grill patties"].map((name) => ({
        name,
        headerId: "h1",
        notes: "",
        ecd: { type: "date", value: today },
      })),
    );
    // No header named after the event existed, so one was created first
    expect(headersApi.create).toHaveBeenCalledWith({ name: "Burger Night" });
    expect(headersApi.create.mock.invocationCallOrder[0]).toBeLessThan(
      tasksApi.create.mock.invocationCallOrder[0],
    );

    // Success notice keeps "View in todo" reachable
    expect(
      screen.getByText(/^Added 3 tasks under "Burger Night" for /),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "View in todo" }));
    expect(onViewTodo).toHaveBeenCalledTimes(1);
  });

  it("schedules a single task into an existing header (matched case-insensitively)", async () => {
    headersApi.getAll.mockResolvedValue([
      { _id: "h9", name: " burger night " },
    ]);
    tasksApi.create.mockResolvedValue({ _id: "t1" });
    renderSection();

    fireEvent.press(
      await screen.findByRole("button", { name: 'Add "Procure bun" to todo' }),
    );
    expect(
      screen.getByRole("checkbox", { name: "Procure bun" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Procure onion" }),
    ).not.toBeChecked();
    fireEvent.press(screen.getByRole("button", { name: "Add 1 task" }));

    await waitFor(() => expect(tasksApi.create).toHaveBeenCalledTimes(1));
    expect(headersApi.create).not.toHaveBeenCalled();
    expect(tasksApi.create.mock.calls[0][0]).toMatchObject({
      name: "Procure bun",
      headerId: "h9",
    });
  });

  it("deletes an event from the ⋯ menu after confirming", async () => {
    eventsApi.remove.mockResolvedValue({ deleted: "e1" });
    renderSection();

    fireEvent.press(
      await screen.findByRole("button", {
        name: "More actions for Burger Night",
      }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Delete event" }));

    // The action runs only after the sheet has closed
    expect(
      await screen.findByText(
        'Delete event "Burger Night"? Tasks already added to the todo stay.',
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(eventsApi.remove).toHaveBeenCalledWith("e1"));
    await waitFor(() =>
      expect(screen.queryByText("Burger Night")).toBeNull(),
    );
    expect(screen.getByText("Movie Night")).toBeTruthy();
  });

  it("surfaces a failed action in a dismissible danger banner", async () => {
    eventsApi.remove.mockRejectedValue(new Error("Network request failed"));
    renderSection();

    fireEvent.press(
      await screen.findByRole("button", {
        name: "More actions for Movie Night",
      }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Delete event" }));
    fireEvent.press(await screen.findByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("Action failed: Network request failed", {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
  });
});
