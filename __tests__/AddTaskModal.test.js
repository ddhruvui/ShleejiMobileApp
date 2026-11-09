import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import AddTaskModal from "../components/AddTaskModal";
import { dateShortcuts } from "../components/EcdPicker";

describe("AddTaskModal", () => {
  it("is titled with its header and needs a name before Add task works", () => {
    const onConfirm = jest.fn();
    render(<AddTaskModal visible headerName="Work" onConfirm={onConfirm} onCancel={() => {}} />);
    expect(screen.getByText("in Work")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Add task" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("adds an undated task by default", () => {
    const onConfirm = jest.fn();
    render(<AddTaskModal visible headerName="Work" onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.changeText(screen.getByLabelText("Task name"), "  Draft OKRs  ");
    fireEvent.press(screen.getByRole("button", { name: "Add task" }));
    expect(onConfirm).toHaveBeenCalledWith({ name: "Draft OKRs", notes: "", ecd: null });
  });

  it("uses the Tomorrow shortcut for a one-time date", () => {
    const onConfirm = jest.fn();
    render(<AddTaskModal visible headerName="Work" onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.changeText(screen.getByLabelText("Task name"), "Ship it");
    fireEvent.press(screen.getByRole("tab", { name: "Date" }));
    fireEvent.press(screen.getByRole("button", { name: "Tomorrow" }));
    fireEvent.press(screen.getByRole("button", { name: "Add task" }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ ecd: { type: "date", value: dateShortcuts()[1].value } }),
    );
  });

  it("builds a weekly schedule from the day buttons", () => {
    const onConfirm = jest.fn();
    render(<AddTaskModal visible headerName="Work" onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.changeText(screen.getByLabelText("Task name"), "Status update");
    fireEvent.press(screen.getByRole("tab", { name: "Weekly" }));
    fireEvent.press(screen.getByRole("button", { name: "Fri" }));
    fireEvent.press(screen.getByRole("button", { name: "Add task" }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ ecd: { type: "day_of_week", value: ["Fri", "Mon"] } }),
    );
  });
});
