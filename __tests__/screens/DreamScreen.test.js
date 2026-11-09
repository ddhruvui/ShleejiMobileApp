import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import DreamScreen from "../../screens/DreamScreen";

// Run focus effects like a mount/unmount effect — no navigator needed.
jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return { useFocusEffect: (cb) => React.useEffect(cb, [cb]) };
});

const PHOTOS = [
  { id: 1, uri: "file:///a.jpg", width: 100, height: 150 },
  { id: 2, uri: "file:///b.jpg", width: 100, height: 100 },
];

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("DreamScreen", () => {
  it("holds the screen awake only while shown", async () => {
    const view = render(<DreamScreen />);
    await waitFor(() => expect(activateKeepAwakeAsync).toHaveBeenCalledWith("dream-board"));
    view.unmount();
    expect(deactivateKeepAwake).toHaveBeenCalledWith("dream-board");
  });

  it("invites the first photo when the board is empty", async () => {
    render(<DreamScreen />);
    expect(await screen.findByText("No dreams yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add photos" })).toBeTruthy();
  });

  it("opens a photo full screen with its position and reorder controls", async () => {
    await AsyncStorage.setItem("dreamPhotos", JSON.stringify(PHOTOS));
    render(<DreamScreen />);
    expect(await screen.findByText("2 photos · screen stays on")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Dream photo 1 of 2"));
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Up" })).toBeDisabled();
    fireEvent.press(screen.getByRole("button", { name: "Down" }));
    expect(screen.getByText("2 / 2")).toBeTruthy();
    await waitFor(async () =>
      expect(JSON.parse(await AsyncStorage.getItem("dreamPhotos")).map((p) => p.id)).toEqual([
        2, 1,
      ]),
    );
  });
});
