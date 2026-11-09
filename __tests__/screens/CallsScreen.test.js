import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import CallsScreen from "../../screens/CallsScreen";
import * as callsApi from "../../api/calls";

jest.mock("../../api/calls", () => ({
  getAll: jest.fn(),
  create: jest.fn(() => Promise.resolve({})),
  update: jest.fn(() => Promise.resolve({})),
  remove: jest.fn(() => Promise.resolve({})),
}));

const CALLS = [
  { _id: "c1", name: "Grandma", frequency: "biweekly", done: true },
  { _id: "c2", name: "Alex (college)", frequency: "monthly", done: false },
  { _id: "c3", name: "Uncle Raj", frequency: "monthly", done: false },
];

beforeEach(() => {
  jest.clearAllMocks();
  callsApi.getAll.mockResolvedValue(CALLS);
});

describe("CallsScreen", () => {
  it("groups people by cycle with progress", async () => {
    render(<CallsScreen />);
    expect(await screen.findByText("Grandma")).toBeTruthy();
    expect(screen.getByText("1 of 3 called")).toBeTruthy();
    expect(screen.getByText("Biweekly")).toBeTruthy();
    expect(screen.getByText("Monthly")).toBeTruthy();
    expect(screen.getByText("0 / 2")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Mark Grandma not called" })).toBeChecked();
  });

  it("ticks someone off as called", async () => {
    render(<CallsScreen />);
    fireEvent.press(await screen.findByRole("checkbox", { name: "Mark Uncle Raj called" }));
    await waitFor(() => expect(callsApi.update).toHaveBeenCalledWith("c3", { done: true }));
    expect(callsApi.getAll).toHaveBeenCalledTimes(2); // refetch, no optimistic update
  });

  it("adds a monthly call from the header +", async () => {
    render(<CallsScreen />);
    await screen.findByText("Grandma");
    fireEvent.press(screen.getByLabelText("Add call"));
    fireEvent.changeText(screen.getByLabelText("Person to call"), " Priya ");
    fireEvent.press(screen.getByRole("tab", { name: "Monthly" }));
    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(callsApi.create).toHaveBeenCalledWith({ name: "Priya", frequency: "monthly" }),
    );
  });

  it("deletes through the ⋯ menu and a confirmation", async () => {
    render(<CallsScreen />);
    fireEvent.press(await screen.findByLabelText("More actions for Uncle Raj"));
    fireEvent.press(screen.getByRole("button", { name: "Delete call" }));
    expect(await screen.findByText('Delete call "Uncle Raj"?')).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(callsApi.remove).toHaveBeenCalledWith("c3"));
  });

  it("edits when the name is tapped", async () => {
    render(<CallsScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Alex (college)" }));
    expect(screen.getByText("Edit call")).toBeTruthy();
    expect(screen.getByLabelText("Person to call").props.value).toBe("Alex (college)");
  });

  it("invites the first call when empty", async () => {
    callsApi.getAll.mockResolvedValue([]);
    render(<CallsScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Add a call" }));
    expect(screen.getByText("Add call")).toBeTruthy();
  });

  it("shows the failure and retries", async () => {
    callsApi.getAll.mockRejectedValueOnce(new Error("Network request failed"));
    render(<CallsScreen />);
    expect(await screen.findByText("Network request failed")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Grandma")).toBeTruthy();
  });
});
