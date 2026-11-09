import React from "react";
import { Text } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import {
  Button,
  IconButton,
  Checkbox,
  Chip,
  SegmentedControl,
  Sheet,
  ActionSheet,
  EmptyState,
  ErrorState,
  Banner,
  Avatar,
  ProgressBar,
} from "../../components/ui";
import ConfirmModal from "../../components/ConfirmModal";
import AddButton from "../../components/AddButton";
import { colors, tintFor, HIT_TARGET } from "../../theme";

describe("theme", () => {
  it("gives the same name the same tint every time", () => {
    expect(tintFor("Grandma")).toBe(tintFor("Grandma"));
  });

  it("uses a 44pt minimum touch target", () => {
    expect(HIT_TARGET).toBeGreaterThanOrEqual(44);
  });

  it("defines one brand colour", () => {
    expect(colors.primary).toBe("#4F46E5");
  });
});

describe("Button", () => {
  it("fires onPress and exposes its title as the accessible name", () => {
    const onPress = jest.fn();
    render(<Button title="Save" onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire while disabled", () => {
    const onPress = jest.fn();
    render(<Button title="Save" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("IconButton and AddButton", () => {
  it("is reachable by its label even though only a glyph is drawn", () => {
    const onPress = jest.fn();
    render(<IconButton icon="trash" label="Delete task" onPress={onPress} />);
    fireEvent.press(screen.getByLabelText("Delete task"));
    expect(onPress).toHaveBeenCalled();
  });

  it("AddButton renders no visible text — label is accessibility only", () => {
    render(<AddButton label="Add header" onPress={() => {}} />);
    expect(screen.getByLabelText("Add header")).toBeTruthy();
    expect(screen.queryByText("Add header")).toBeNull();
  });
});

describe("Checkbox", () => {
  it("reports its checked state to assistive tech", () => {
    render(<Checkbox checked label="Mark done" onPress={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "Mark done" })).toBeChecked();
  });
});

describe("Chip and SegmentedControl", () => {
  it("marks the selected chip", () => {
    render(<Chip label="Goals" selected onPress={() => {}} />);
    expect(screen.getByRole("button", { name: "Goals" })).toBeSelected();
  });

  it("calls onChange with the tapped segment value", () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl
        value="lists"
        onChange={onChange}
        options={[
          { value: "lists", label: "Lists" },
          { value: "date", label: "By date" },
        ]}
      />,
    );
    fireEvent.press(screen.getByRole("tab", { name: "By date" }));
    expect(onChange).toHaveBeenCalledWith("date");
  });
});

describe("Sheet", () => {
  it("renders title, body and footer only while visible", () => {
    const { rerender } = render(
      <Sheet visible title="Add task" footer={<Text>Footer</Text>} onClose={() => {}}>
        <Text>Body</Text>
      </Sheet>,
    );
    expect(screen.getByText("Add task")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
    expect(screen.getByText("Footer")).toBeTruthy();
    rerender(
      <Sheet visible={false} title="Add task" onClose={() => {}}>
        <Text>Body</Text>
      </Sheet>,
    );
    expect(screen.queryByText("Body")).toBeNull();
  });

  it("closes when the backdrop is tapped", () => {
    const onClose = jest.fn();
    render(
      <Sheet visible title="T" onClose={onClose} testID="s">
        <Text>Body</Text>
      </Sheet>,
    );
    fireEvent.press(screen.getByTestId("s-backdrop", { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("ActionSheet", () => {
  it("closes, then runs the chosen action", async () => {
    const onClose = jest.fn();
    const onEdit = jest.fn();
    render(
      <ActionSheet
        visible
        title="Review Q4 roadmap"
        onClose={onClose}
        actions={[{ key: "edit", label: "Edit task", icon: "pencil", onPress: onEdit }]}
      />,
    );
    fireEvent.press(screen.getByRole("button", { name: "Edit task" }));
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
  });

  it("ignores disabled actions", async () => {
    const onMove = jest.fn();
    const onClose = jest.fn();
    render(
      <ActionSheet
        visible
        title="Task"
        onClose={onClose}
        actions={[{ key: "up", label: "Move up", onPress: onMove, disabled: true }]}
      />,
    );
    fireEvent.press(screen.getByRole("button", { name: "Move up" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe("ConfirmModal", () => {
  it("keeps Delete disabled until a required reason is typed", () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmModal
        visible
        message='Delete task "Fix CI"?'
        requireReason
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText("Why are you deleting this?"), "  dup  ");
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledWith("dup");
  });

  it("confirms without a reason when none is required", () => {
    const onConfirm = jest.fn();
    render(<ConfirmModal visible message="Delete?" onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });
});

describe("state views", () => {
  it("EmptyState offers its call to action", () => {
    const onAction = jest.fn();
    render(<EmptyState title="No calls yet" actionLabel="Add a call" onAction={onAction} />);
    fireEvent.press(screen.getByRole("button", { name: "Add a call" }));
    expect(onAction).toHaveBeenCalled();
  });

  it("ErrorState shows the reason and retries", () => {
    const onRetry = jest.fn();
    render(<ErrorState message="Network request failed" onRetry={onRetry} />);
    expect(screen.getByText("Network request failed")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("Banner can be dismissed", () => {
    const onDismiss = jest.fn();
    render(
      <Banner tone="danger" onDismiss={onDismiss}>
        Action failed: boom
      </Banner>,
    );
    fireEvent.press(screen.getByLabelText("Dismiss"));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe("Avatar and ProgressBar", () => {
  it("draws initials, ignoring parenthesised notes", () => {
    render(<Avatar name="Alex (college)" />);
    expect(screen.getByText("A", { includeHiddenElements: true })).toBeTruthy();
  });

  it("clamps progress into 0–100%", () => {
    render(<ProgressBar value={1.7} testID="pb" />);
    expect(screen.getByTestId("pb").props.accessibilityValue.now).toBe(100);
  });
});
