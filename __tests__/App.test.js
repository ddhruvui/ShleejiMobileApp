import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import App from "../App";

jest.mock("../api/affirmations", () => ({ getAll: jest.fn(() => Promise.resolve([])) }));
jest.mock("../api/calls", () => ({ getAll: jest.fn(() => Promise.resolve([])) }));
jest.mock("../api/headers", () => ({ getAll: jest.fn(() => Promise.resolve([])) }));
jest.mock("../api/vacations", () => ({
  getStatus: jest.fn(() => Promise.resolve({ onVacation: false })),
  getAll: jest.fn(() => Promise.resolve([])),
}));
jest.mock("../api/oncall", () => ({ getAll: jest.fn(() => Promise.resolve([])) }));
jest.mock("../utils/goalSync", () => ({
  ...jest.requireActual("../utils/goalSync"),
  fetchOneStepStreaks: jest.fn(() => Promise.resolve(null)),
}));

const tab = (name) => screen.getByRole("tab", { name });

describe("App navigation", () => {
  it("opens on Dream with five named tabs, labelling only the active one", async () => {
    render(<App />);
    expect(await screen.findByText("Dream Board")).toBeTruthy();
    for (const name of ["Dream", "Affirmations", "Todo", "Calls", "Counter"]) {
      expect(tab(name)).toBeTruthy();
    }
    expect(tab("Dream")).toBeSelected();
    expect(screen.queryByText("Affirmations")).toBeNull(); // inactive: icon only
  });

  it("switches tabs, and re-tapping the active tab returns to Todo", async () => {
    render(<App />);
    await screen.findByText("Dream Board");
    fireEvent.press(tab("Calls"));
    expect(await screen.findByText("No calls yet")).toBeTruthy();
    expect(tab("Calls")).toBeSelected();
    fireEvent.press(tab("Calls"));
    expect(tab("Todo")).toBeSelected();
    expect(await screen.findByText("Task At Hand")).toBeTruthy();
  });
});
