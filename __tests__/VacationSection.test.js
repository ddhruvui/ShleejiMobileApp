import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import VacationSection from "../components/VacationSection";
import * as vacationsApi from "../api/vacations";
import * as tasksApi from "../api/tasks";

jest.mock("../api/vacations", () => ({
  getAll: jest.fn(),
  getStatus: jest.fn(),
  getTasks: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));

jest.mock("../api/tasks", () => ({
  update: jest.fn(),
}));

jest.mock("../api/headers", () => ({}));

const IDLE_STATUS = { onVacation: false, today: "2026-11-09", active: null };

const PAST = { _id: "v-past", startDate: "2026-08-01", endDate: "2026-08-03", note: "" };
const ACTIVE = { _id: "v-now", startDate: "2026-11-08", endDate: "2026-11-12", note: "Goa" };
const UPCOMING = { _id: "v-next", startDate: "2027-01-10", endDate: "2027-01-10", note: "" };

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 10, 9, 8, 0, 0) });
  vacationsApi.getAll.mockResolvedValue([]);
  vacationsApi.getStatus.mockResolvedValue(IDLE_STATUS);
  vacationsApi.create.mockResolvedValue({});
  vacationsApi.remove.mockResolvedValue({});
  vacationsApi.getTasks.mockResolvedValue([]);
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe("VacationSection", () => {
  it("shows the empty state with its original text", async () => {
    render(<VacationSection addRef={React.createRef()} />);
    expect(screen.getByText("Loading vacations…")).toBeTruthy();
    expect(await screen.findByText("No vacations yet — add one!")).toBeTruthy();
    expect(screen.getByText(/won't count as procrastination/)).toBeTruthy();
  });

  it("books a vacation through addRef.openAdd() and reports the new status", async () => {
    const addRef = React.createRef();
    const onStatusChanged = jest.fn();
    render(<VacationSection addRef={addRef} onStatusChanged={onStatusChanged} />);

    await waitFor(() => expect(onStatusChanged).toHaveBeenCalledWith(IDLE_STATUS));
    expect(vacationsApi.getAll).toHaveBeenCalledTimes(1);

    act(() => addRef.current.openAdd());
    expect(screen.getByText("Book vacation")).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText("Note"), "  Kerala trip  ");

    // First day → 20 Dec; the last day follows it forward, then moves to 27 Dec.
    fireEvent.press(screen.getByRole("button", { name: /^First day/ }));
    fireEvent(screen.getByTestId("datetimepicker"), "onChange", { type: "set" }, new Date(2026, 11, 20));
    expect(screen.getByRole("button", { name: /^Last day, Sun, 20 December 2026/ })).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: /^Last day/ }));
    fireEvent(screen.getByTestId("datetimepicker"), "onChange", { type: "set" }, new Date(2026, 11, 27));
    expect(screen.getByText("8 days off")).toBeTruthy();

    const booked = { ...IDLE_STATUS };
    vacationsApi.getStatus.mockResolvedValue(booked);
    fireEvent.press(screen.getByRole("button", { name: "Book" }));

    await waitFor(() =>
      expect(vacationsApi.create).toHaveBeenCalledWith({
        startDate: "2026-12-20",
        endDate: "2026-12-27",
        note: "Kerala trip",
      }),
    );
    // Mutate, then refetch: the list and status reload and the parent hears.
    await waitFor(() => expect(onStatusChanged).toHaveBeenCalledTimes(2));
    expect(vacationsApi.getAll).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByText("Book vacation")).toBeNull());
  });

  it("keeps Book disabled while the last day is before the first", async () => {
    const addRef = React.createRef();
    render(<VacationSection addRef={addRef} />);
    await screen.findByText("No vacations yet — add one!");
    act(() => addRef.current.openAdd());

    fireEvent.press(screen.getByRole("button", { name: /^Last day/ }));
    fireEvent(screen.getByTestId("datetimepicker"), "onChange", { type: "set" }, new Date(2026, 10, 1));
    expect(screen.getByText("The last day can't be before the first day.")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Book" }));
    expect(vacationsApi.create).not.toHaveBeenCalled();
  });

  it("renders ranges with status badges and the active banner", async () => {
    vacationsApi.getAll.mockResolvedValue([PAST, ACTIVE, UPCOMING]);
    vacationsApi.getStatus.mockResolvedValue({
      onVacation: true,
      today: "2026-11-09",
      active: { ...ACTIVE, dayOfVacation: 2, totalDays: 5 },
    });
    render(<VacationSection addRef={React.createRef()} />);

    expect(await screen.findByText("1 Aug 2026 → 3 Aug 2026")).toBeTruthy();
    expect(screen.getByText("past")).toBeTruthy();
    expect(screen.getByText("on now")).toBeTruthy();
    expect(screen.getByText("upcoming")).toBeTruthy();
    expect(screen.getByText("1 day")).toBeTruthy();
    expect(screen.getByText("You're on vacation.")).toBeTruthy();
    expect(screen.getByText(/Day 2 of 5 · Goa — back on 13 Nov 2026/)).toBeTruthy();
  });

  it("deletes a range from its ⋯ menu after confirmation", async () => {
    vacationsApi.getAll.mockResolvedValue([UPCOMING]);
    render(<VacationSection addRef={React.createRef()} />);

    fireEvent.press(
      await screen.findByLabelText("More actions for vacation 10 Jan 2027 → 10 Jan 2027"),
    );
    fireEvent.press(screen.getByRole("button", { name: "Delete vacation" }));

    // The action runs once the sheet has closed.
    const message = await screen.findByText(
      "Delete the vacation from 10 Jan 2027 to 10 Jan 2027? Those days will count as ordinary days again.",
    );
    expect(message).toBeTruthy();
    expect(vacationsApi.remove).not.toHaveBeenCalled();

    vacationsApi.getAll.mockResolvedValue([]);
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(vacationsApi.remove).toHaveBeenCalledWith("v-next"));
    expect(await screen.findByText("No vacations yet — add one!")).toBeTruthy();
  });

  it("moves a task out of the vacation with vacationMove", async () => {
    const onTasksChanged = jest.fn(() => Promise.resolve());
    vacationsApi.getAll.mockResolvedValue([UPCOMING]);
    vacationsApi.getTasks.mockResolvedValue([
      { _id: "t1", name: "Pay rent", headerName: "Home", ecd: { type: "date", value: "2027-01-10" } },
    ]);
    tasksApi.update.mockResolvedValue({});
    render(<VacationSection addRef={React.createRef()} onTasksChanged={onTasksChanged} />);

    fireEvent.press(await screen.findByLabelText("Tasks inside 10 Jan 2027 → 10 Jan 2027"));
    fireEvent.press(await screen.findByRole("button", { name: "Move to 11 Jan 2027" }));
    await waitFor(() =>
      expect(tasksApi.update).toHaveBeenCalledWith("t1", {
        ecd: { type: "date", value: "2027-01-11" },
        vacationMove: true,
      }),
    );
    await waitFor(() => expect(onTasksChanged).toHaveBeenCalled());
  });
});
