import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import AffirmationsScreen from "../../screens/AffirmationsScreen";
import * as affirmationsApi from "../../api/affirmations";

jest.mock("../../api/affirmations", () => ({
  getAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(() => Promise.resolve({})),
}));

const ITEMS = [
  { _id: "a1", name: "I am calm and focused" },
  { _id: "a2", name: "Progress over perfection" },
];

beforeEach(() => {
  jest.clearAllMocks();
  affirmationsApi.getAll.mockResolvedValue(ITEMS);
});

describe("AffirmationsScreen", () => {
  it("lists affirmations with a count", async () => {
    render(<AffirmationsScreen />);
    expect(await screen.findByText("I am calm and focused")).toBeTruthy();
    expect(screen.getByText("2 to read today")).toBeTruthy();
  });

  it("adds one from the header +", async () => {
    affirmationsApi.create.mockResolvedValue({ _id: "a3", name: "I am enough" });
    render(<AffirmationsScreen />);
    await screen.findByText("I am calm and focused");
    fireEvent.press(screen.getByLabelText("Add affirmation"));
    fireEvent.changeText(screen.getByLabelText("Affirmation"), "  I am enough ");
    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("I am enough")).toBeTruthy();
    expect(affirmationsApi.create).toHaveBeenCalledWith({ name: "I am enough" });
  });

  it("edits one when its card is tapped", async () => {
    affirmationsApi.update.mockResolvedValue({ _id: "a2", name: "Progress, not perfection" });
    render(<AffirmationsScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Progress over perfection" }));
    fireEvent.changeText(screen.getByLabelText("Affirmation"), "Progress, not perfection");
    fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Progress, not perfection")).toBeTruthy();
    expect(affirmationsApi.update).toHaveBeenCalledWith("a2", { name: "Progress, not perfection" });
  });

  it("deletes after the native confirmation", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation((title, msg, buttons) => {
      buttons.find((b) => b.style === "destructive").onPress();
    });
    render(<AffirmationsScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "I am calm and focused" }));
    fireEvent.press(screen.getByLabelText("Delete affirmation"));
    await waitFor(() => expect(affirmationsApi.remove).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(screen.queryByText("I am calm and focused")).toBeNull());
    alert.mockRestore();
  });

  it("surfaces a failed save as a dismissible banner", async () => {
    affirmationsApi.create.mockRejectedValue(new Error("Server down"));
    render(<AffirmationsScreen />);
    await screen.findByText("I am calm and focused");
    fireEvent.press(screen.getByLabelText("Add affirmation"));
    fireEvent.changeText(screen.getByLabelText("Affirmation"), "x");
    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Action failed: Server down")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText("Action failed: Server down")).toBeNull();
  });

  it("invites the first affirmation when empty", async () => {
    affirmationsApi.getAll.mockResolvedValue([]);
    render(<AffirmationsScreen />);
    expect(await screen.findByText("No affirmations yet")).toBeTruthy();
    // header "+" plus the empty-state call to action
    expect(screen.getAllByRole("button", { name: "Add affirmation" })).toHaveLength(2);
  });
});
