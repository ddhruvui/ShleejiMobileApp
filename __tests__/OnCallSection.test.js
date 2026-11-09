import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import OnCallSection from "../components/OnCallSection";
import * as onCallApi from "../api/oncall";

jest.mock("../api/oncall", () => ({
  getAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));

jest.mock("../api/tasks", () => ({}));
jest.mock("../api/headers", () => ({}));

// Mon 9 Nov 2026, 08:00 local — before the first shift starts.
const NOW = new Date(2026, 10, 9, 8, 0, 0);

const MORNING = {
  _id: "s1",
  date: "2026-11-09",
  start: "09:00",
  end: "17:00",
  type: "primary",
  note: "",
};
const TOMORROW = {
  _id: "s2",
  date: "2026-11-10",
  start: "09:00",
  end: "22:00",
  type: "secondary",
  note: "backup",
};

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  onCallApi.getAll.mockResolvedValue([MORNING, TOMORROW]);
  onCallApi.create.mockResolvedValue({});
  onCallApi.remove.mockResolvedValue({});
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe("OnCallSection", () => {
  it("shows the agenda with a Not on call gap between two shifts", async () => {
    render(<OnCallSection addRef={React.createRef()} />);
    expect(screen.getByText("Loading on-call shifts…")).toBeTruthy();

    expect(await screen.findByText("Upcoming")).toBeTruthy();
    expect(screen.getByText("2 shifts · 21h on call")).toBeTruthy();

    // Opening gap: not covered right now.
    expect(screen.getByText("Not on call now")).toBeTruthy();
    expect(screen.getByText("until Today 09:00")).toBeTruthy();

    // The gap between the two shifts.
    expect(screen.getByText("Not on call")).toBeTruthy();
    expect(screen.getByText("from Today 17:00 to Tomorrow 09:00")).toBeTruthy();
    expect(screen.getByText("16h")).toBeTruthy();

    // Shift cards, in time order, with the secondary one marked.
    expect(screen.getByText("09:00 – 17:00")).toBeTruthy();
    expect(screen.getByText("09:00 – 22:00")).toBeTruthy();
    expect(screen.getByText("secondary")).toBeTruthy();
    expect(screen.getByText("Today · Mon, Nov 9, 2026 · 8h")).toBeTruthy();
    expect(screen.getByText("Nothing scheduled after Tomorrow 22:00")).toBeTruthy();

    // Agenda order: gap now → shift → gap → shift
    const order = screen
      .getAllByTestId(/^(oncall-gap|shift-)/)
      .map((n) => n.props.testID);
    expect(order).toEqual(["oncall-gap-now", "shift-s1", "oncall-gap", "shift-s2"]);
  });

  it("shows the empty state when nothing is upcoming", async () => {
    onCallApi.getAll.mockResolvedValue([]);
    render(<OnCallSection addRef={React.createRef()} />);
    expect(
      await screen.findByText("No upcoming on-call shifts — add one with the + above."),
    ).toBeTruthy();
  });

  it("deletes a shift from its ⋯ menu after confirmation", async () => {
    const onShiftsChanged = jest.fn(() => Promise.resolve());
    render(<OnCallSection addRef={React.createRef()} onShiftsChanged={onShiftsChanged} />);

    fireEvent.press(await screen.findByLabelText("More actions for on-call shift 2026-11-09"));
    fireEvent.press(screen.getByRole("button", { name: "Delete shift" }));

    // The menu action runs after the sheet closes, then ConfirmModal asks.
    expect(
      await screen.findByText("Delete the primary on-call shift on Mon, Nov 9, 2026 (09:00–17:00)?"),
    ).toBeTruthy();
    expect(onCallApi.remove).not.toHaveBeenCalled();

    onCallApi.getAll.mockResolvedValue([TOMORROW]);
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onCallApi.remove).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(onShiftsChanged).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId("shift-s1")).toBeNull());
  });

  it("adds a shift from the quick-add shorthand via addRef.openAdd()", async () => {
    const addRef = React.createRef();
    const onShiftsChanged = jest.fn(() => Promise.resolve());
    render(<OnCallSection addRef={addRef} onShiftsChanged={onShiftsChanged} />);
    await screen.findByText("Upcoming");

    act(() => addRef.current.openAdd());
    expect(screen.getByText("Add on-call shift")).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText("Quick add on-call shift"), "11/16 9-22 s");
    expect(screen.getByText("Mon, Nov 16, 2026 · 09:00 → 22:00 · 13h · secondary")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Secondary" })).toBeChecked();

    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(onCallApi.create).toHaveBeenCalledWith({
        date: "2026-11-16",
        start: "09:00",
        end: "22:00",
        type: "secondary",
        note: "",
      }),
    );
    await waitFor(() => expect(onShiftsChanged).toHaveBeenCalledTimes(1));
  });

  it("rejects quick-add text that doesn't parse", async () => {
    const addRef = React.createRef();
    render(<OnCallSection addRef={addRef} />);
    await screen.findByText("Upcoming");
    act(() => addRef.current.openAdd());

    fireEvent.changeText(screen.getByLabelText("Quick add on-call shift"), "tomorrow-ish");
    expect(
      screen.getByText("Use M/D start-end, like 11/16 9-22 or 11/12 22-6 (add s for secondary)"),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    expect(
      screen.getByText("Use M/D start-end, like 11/16 9-22 (add s for secondary)."),
    ).toBeTruthy();
    expect(onCallApi.create).not.toHaveBeenCalled();
  });
});
