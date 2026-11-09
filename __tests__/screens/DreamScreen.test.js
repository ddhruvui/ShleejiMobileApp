import React from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as ImagePicker from "expo-image-picker";
import DreamScreen from "../../screens/DreamScreen";
import * as affirmationsApi from "../../api/affirmations";

// Run focus effects like a mount/unmount effect — no navigator needed.
jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return { useFocusEffect: (cb) => React.useEffect(cb, [cb]) };
});

jest.mock("../../api/affirmations", () => ({
  getAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(() => Promise.resolve({})),
}));

const PHOTOS = [
  { id: 1, uri: "file:///a.jpg", width: 100, height: 150 },
  { id: 2, uri: "file:///b.jpg", width: 100, height: 100 },
];
const AFFIRMATIONS = [
  { _id: "a1", name: "I am calm and focused" },
  { _id: "a2", name: "Progress over perfection" },
];

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  affirmationsApi.getAll.mockResolvedValue(AFFIRMATIONS);
});

async function renderDream({ photos } = {}) {
  if (photos) await AsyncStorage.setItem("dreamPhotos", JSON.stringify(photos));
  const view = render(<DreamScreen />);
  await screen.findByText("I am calm and focused");
  return view;
}

describe("Dream tab", () => {
  it("shows the board first, then the affirmations, with one summary", async () => {
    await renderDream({ photos: PHOTOS });
    expect(
      await screen.findByText("2 photos · 2 affirmations"),
    ).toBeTruthy();
    const headings = screen.getAllByRole("header").map((h) => h.props.children);
    expect(headings).toEqual(["Dream Board", "Dream board", "Affirmations"]);
    expect(screen.getByLabelText("Dream photo 1 of 2")).toBeTruthy();
  });

  it("holds the screen awake only while shown", async () => {
    const view = await renderDream();
    expect(activateKeepAwakeAsync).toHaveBeenCalledWith("dream-board");
    view.unmount();
    expect(deactivateKeepAwake).toHaveBeenCalledWith("dream-board");
  });

  it("invites a first photo and a first affirmation when both are empty", async () => {
    affirmationsApi.getAll.mockResolvedValue([]);
    render(<DreamScreen />);
    expect(await screen.findByText("No dreams yet")).toBeTruthy();
    expect(await screen.findByText("No affirmations yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add photos" })).toBeTruthy();
  });

  describe("header +", () => {
    it("asks what to add and opens the affirmation sheet", async () => {
      await renderDream();
      fireEvent.press(screen.getByLabelText("Add to Dream Board"));
      fireEvent.press(screen.getByTestId("add-choice-affirmation"));
      expect(await screen.findByText("A short line to read every day")).toBeTruthy();
      expect(screen.getByLabelText("Affirmation")).toBeTruthy();
    });

    it("asks what to add and opens the photo picker", async () => {
      await renderDream();
      fireEvent.press(screen.getByLabelText("Add to Dream Board"));
      fireEvent.press(screen.getByTestId("add-choice-photos"));
      await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    });
  });

  describe("board", () => {
    it("adds picked photos from the section +", async () => {
      ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: "file:///new.jpg", width: 50, height: 50 }],
      });
      await renderDream();
      fireEvent.press(screen.getByLabelText("Add photos to the board"));
      expect(await screen.findByLabelText("Dream photo 1 of 1")).toBeTruthy();
      expect(JSON.parse(await AsyncStorage.getItem("dreamPhotos"))).toHaveLength(1);
    });

    it("opens a photo full screen and reorders it", async () => {
      await renderDream({ photos: PHOTOS });
      fireEvent.press(await screen.findByLabelText("Dream photo 1 of 2"));
      expect(screen.getByText("1 / 2")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Up" })).toBeDisabled();
      fireEvent.press(screen.getByRole("button", { name: "Down" }));
      expect(screen.getByText("2 / 2")).toBeTruthy();
      await waitFor(async () =>
        expect(
          JSON.parse(await AsyncStorage.getItem("dreamPhotos")).map((p) => p.id),
        ).toEqual([2, 1]),
      );
    });
  });

  describe("affirmations", () => {
    it("adds one from the section +", async () => {
      affirmationsApi.create.mockResolvedValue({ _id: "a3", name: "I am enough" });
      await renderDream();
      fireEvent.press(screen.getByLabelText("Add an affirmation"));
      fireEvent.changeText(screen.getByLabelText("Affirmation"), "  I am enough ");
      fireEvent.press(screen.getByRole("button", { name: "Add" }));
      expect(await screen.findByText("I am enough")).toBeTruthy();
      expect(affirmationsApi.create).toHaveBeenCalledWith({ name: "I am enough" });
      expect(screen.getByText("0 photos · 3 affirmations")).toBeTruthy();
    });

    it("edits one when its card is tapped", async () => {
      affirmationsApi.update.mockResolvedValue({ _id: "a2", name: "Progress, not perfection" });
      await renderDream();
      fireEvent.press(screen.getByRole("button", { name: "Progress over perfection" }));
      fireEvent.changeText(screen.getByLabelText("Affirmation"), "Progress, not perfection");
      fireEvent.press(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText("Progress, not perfection")).toBeTruthy();
      expect(affirmationsApi.update).toHaveBeenCalledWith("a2", {
        name: "Progress, not perfection",
      });
    });

    it("deletes after the native confirmation", async () => {
      const alert = jest.spyOn(Alert, "alert").mockImplementation((title, msg, buttons) => {
        buttons?.find((b) => b.style === "destructive")?.onPress();
      });
      await renderDream();
      fireEvent.press(screen.getByRole("button", { name: "I am calm and focused" }));
      fireEvent.press(screen.getByLabelText("Delete affirmation"));
      await waitFor(() => expect(affirmationsApi.remove).toHaveBeenCalledWith("a1"));
      await waitFor(() => expect(screen.queryByText("I am calm and focused")).toBeNull());
      alert.mockRestore();
    });

    it("surfaces a failed save as a dismissible banner", async () => {
      affirmationsApi.create.mockRejectedValue(new Error("Server down"));
      await renderDream();
      fireEvent.press(screen.getByLabelText("Add an affirmation"));
      fireEvent.changeText(screen.getByLabelText("Affirmation"), "x");
      fireEvent.press(screen.getByRole("button", { name: "Add" }));
      expect(await screen.findByText("Action failed: Server down")).toBeTruthy();
      fireEvent.press(screen.getByLabelText("Dismiss"));
      expect(screen.queryByText("Action failed: Server down")).toBeNull();
    });

    it("keeps the board usable when the affirmations fail to load, and retries", async () => {
      affirmationsApi.getAll.mockRejectedValueOnce(new Error("Network request failed"));
      await AsyncStorage.setItem("dreamPhotos", JSON.stringify(PHOTOS));
      render(<DreamScreen />);
      expect(await screen.findByText("Failed to load: Network request failed")).toBeTruthy();
      expect(screen.getByLabelText("Dream photo 1 of 2")).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: "Retry" }));
      expect(await screen.findByText("I am calm and focused")).toBeTruthy();
    });

    it("reloads them on pull to refresh", async () => {
      await renderDream();
      const scroll = screen.UNSAFE_getByType(require("react-native").ScrollView);
      await act(async () => {
        await scroll.props.refreshControl.props.onRefresh();
      });
      expect(affirmationsApi.getAll).toHaveBeenCalledTimes(2);
    });
  });
});
