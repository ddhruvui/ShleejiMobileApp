import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react-native";
import LifeEventsSection from "../components/LifeEventsSection";
import * as lifeEventsApi from "../api/lifeevents";
import * as tasksApi from "../api/tasks";

jest.mock("../api/lifeevents", () => ({
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

const LIFE_EVENTS = [
  {
    _id: "l1",
    name: "Mom's birthday",
    date: "12/11",
    done: false,
    priority: 0,
    todoTaskId: "t1",
  },
  { _id: "l2", name: "Anniversary", date: "7/3", done: true, priority: 1 },
];

function renderSection() {
  const addRef = React.createRef();
  const onTasksChanged = jest.fn();
  render(<LifeEventsSection onTasksChanged={onTasksChanged} addRef={addRef} />);
  return { addRef, onTasksChanged };
}

beforeEach(() => {
  jest.clearAllMocks();
  lifeEventsApi.getAll.mockResolvedValue(LIFE_EVENTS);
  lifeEventsApi.update.mockResolvedValue({});
  tasksApi.update.mockResolvedValue({});
});

describe("LifeEventsSection", () => {
  it("renders life events in server order with readable annual dates", async () => {
    renderSection();
    expect(await screen.findByText("Mom's birthday")).toBeTruthy();
    expect(screen.getByText("Anniversary")).toBeTruthy();
    // "D/M" shown as "12 Nov" — the stored value is left as is
    expect(screen.getByText("12 Nov")).toBeTruthy();
    expect(screen.getByText("7 Mar")).toBeTruthy();
    expect(screen.getByText("in todo")).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: 'Mark "Anniversary" not done' }),
    ).toBeChecked();
  });

  it("shows the empty state with the original wording", async () => {
    lifeEventsApi.getAll.mockResolvedValue([]);
    renderSection();
    expect(
      await screen.findByText("No life events yet — add one!"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "A life event is a date that repeats every year (like a birthday); it lands in your todo on the day.",
      ),
    ).toBeTruthy();
  });

  it("toggles done and mirrors it onto the linked todo task", async () => {
    const { onTasksChanged } = renderSection();
    fireEvent.press(
      await screen.findByRole("checkbox", { name: 'Mark "Mom\'s birthday" done' }),
    );

    await waitFor(() => expect(lifeEventsApi.getAll).toHaveBeenCalledTimes(2));
    expect(lifeEventsApi.update).toHaveBeenCalledWith("l1", { done: true });
    expect(tasksApi.update).toHaveBeenCalledWith("t1", { done: true });
    expect(lifeEventsApi.update.mock.invocationCallOrder[0]).toBeLessThan(
      tasksApi.update.mock.invocationCallOrder[0],
    );
    expect(onTasksChanged).toHaveBeenCalledTimes(1);
  });

  it("toggles done without touching the todo when there is no linked task", async () => {
    const { onTasksChanged } = renderSection();
    fireEvent.press(
      await screen.findByRole("checkbox", { name: 'Mark "Anniversary" not done' }),
    );
    await waitFor(() =>
      expect(lifeEventsApi.update).toHaveBeenCalledWith("l2", { done: false }),
    );
    await waitFor(() => expect(lifeEventsApi.getAll).toHaveBeenCalledTimes(2));
    expect(tasksApi.update).not.toHaveBeenCalled();
    expect(onTasksChanged).not.toHaveBeenCalled();
  });

  it("adds a life event through addRef.openAdd()", async () => {
    lifeEventsApi.create.mockResolvedValue({ _id: "l3" });
    const { addRef } = renderSection();
    await screen.findByText("Mom's birthday");

    act(() => addRef.current.openAdd());

    expect(
      screen.getByRole("button", { name: "Add life event" }),
    ).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText("Life event"), " Dad's birthday ");
    fireEvent.press(screen.getByRole("button", { name: "November" }));
    fireEvent.press(screen.getByRole("button", { name: "12 November" }));
    fireEvent.press(screen.getByRole("button", { name: "Add life event" }));

    await waitFor(() =>
      expect(lifeEventsApi.create).toHaveBeenCalledWith({
        name: "Dad's birthday",
        date: "12/11",
      }),
    );
    await waitFor(() => expect(lifeEventsApi.getAll).toHaveBeenCalledTimes(2));
  });

  it("clamps the day when switching to a shorter month (Feb 29 allowed)", async () => {
    lifeEventsApi.create.mockResolvedValue({ _id: "l3" });
    const { addRef } = renderSection();
    await screen.findByText("Mom's birthday");

    act(() => addRef.current.openAdd());
    fireEvent.changeText(screen.getByLabelText("Life event"), "Leap day");
    fireEvent.press(screen.getByRole("button", { name: "31 January" }));
    fireEvent.press(screen.getByRole("button", { name: "February" }));
    expect(screen.queryByRole("button", { name: "30 February" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Add life event" }));

    await waitFor(() =>
      expect(lifeEventsApi.create).toHaveBeenCalledWith({
        name: "Leap day",
        date: "29/2",
      }),
    );
  });

  it("renames from the ⋯ menu and mirrors the name onto the linked todo task", async () => {
    const { onTasksChanged } = renderSection();
    fireEvent.press(
      await screen.findByRole("button", {
        name: "More actions for Mom's birthday",
      }),
    );
    // Move up is unavailable for the first row
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    fireEvent.press(screen.getByRole("button", { name: "Edit life event" }));

    // The edit sheet opens only after the menu has closed
    const nameField = await waitFor(() =>
      screen.getByDisplayValue("Mom's birthday"),
    );
    fireEvent.changeText(nameField, "Mum's birthday");
    fireEvent.press(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(lifeEventsApi.update).toHaveBeenCalledWith("l1", {
        name: "Mum's birthday",
        date: "12/11",
      }),
    );
    await waitFor(() =>
      expect(tasksApi.update).toHaveBeenCalledWith("t1", {
        name: "Mum's birthday",
      }),
    );
    expect(onTasksChanged).toHaveBeenCalledTimes(1);
  });

  it("moves a life event down from the ⋯ menu", async () => {
    renderSection();
    fireEvent.press(
      await screen.findByRole("button", {
        name: "More actions for Mom's birthday",
      }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Move down" }));
    await waitFor(() =>
      expect(lifeEventsApi.update).toHaveBeenCalledWith("l1", { priority: 1 }),
    );
  });

  it("opens the edit sheet when a row is tapped", async () => {
    renderSection();
    fireEvent.press(await screen.findByTestId("lifeevent-l2"));
    expect(screen.getByText("Edit life event")).toBeTruthy();
    expect(screen.getByDisplayValue("Anniversary")).toBeTruthy();
  });

  it("deletes from the ⋯ menu after confirming", async () => {
    lifeEventsApi.remove.mockResolvedValue({ deleted: "l2" });
    renderSection();
    fireEvent.press(
      await screen.findByRole("button", { name: "More actions for Anniversary" }),
    );
    fireEvent.press(screen.getByRole("button", { name: "Delete life event" }));
    expect(
      await screen.findByText(
        `Delete life event "Anniversary"? It will no longer be added to your todo each year (this year's task, if already added, stays).`,
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(lifeEventsApi.remove).toHaveBeenCalledWith("l2"));
  });

  it("surfaces a failed toggle in a dismissible danger banner", async () => {
    lifeEventsApi.update.mockRejectedValue(new Error("boom"));
    renderSection();
    fireEvent.press(
      await screen.findByRole("checkbox", { name: 'Mark "Mom\'s birthday" done' }),
    );
    expect(await screen.findByText("Action failed: boom")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText("Action failed: boom")).toBeNull();
  });
});
