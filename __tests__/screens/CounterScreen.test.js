import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import CounterScreen, { addClicks } from "../../screens/CounterScreen";

async function renderCounter({ clicks, mada } = {}) {
  await AsyncStorage.clear();
  if (clicks != null) await AsyncStorage.setItem("clickCount", String(clicks));
  if (mada != null) await AsyncStorage.setItem("madaCount", String(mada));
  render(<CounterScreen />);
  const pad = await screen.findByTestId("counter-trackpad");
  // the ring and counts render once the pad has a size
  fireEvent(pad, "layout", { nativeEvent: { layout: { width: 340, height: 520, x: 0, y: 0 } } });
  return pad;
}

const count = (id) => screen.getByTestId(id).props.children;

describe("addClicks", () => {
  it("turns every 108 clicks into a mada and keeps the remainder", () => {
    expect(addClicks(0, 0, 217)).toEqual({ clicks: 1, mada: 2 });
    expect(addClicks(100, 3, 8)).toEqual({ clicks: 0, mada: 4 });
    expect(addClicks(5, 0, 1)).toEqual({ clicks: 6, mada: 0 });
  });
});

describe("CounterScreen", () => {
  it("restores saved counts", async () => {
    await renderCounter({ clicks: 37, mada: 4 });
    expect(count("clicks-count")).toBe(37);
    expect(count("mada-count")).toBe(4);
  });

  it("counts a tap and rolls the 108th into a mada", async () => {
    const pad = await renderCounter({ clicks: 106, mada: 0 });
    fireEvent.press(pad);
    expect(count("clicks-count")).toBe(107);
    fireEvent.press(pad);
    expect(count("clicks-count")).toBe(0);
    expect(count("mada-count")).toBe(1);
    await waitFor(async () =>
      expect(await AsyncStorage.getItem("madaCount")).toBe("1"),
    );
  });

  it("bulk-adds clicks with a live preview of the result", async () => {
    await renderCounter({ clicks: 0, mada: 0 });
    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    fireEvent.changeText(screen.getByLabelText("Clicks to add"), "217");
    expect(screen.getByText("You'll have 2 mada and 1 clicks")).toBeTruthy();
    // the sheet's primary "Add" is the last one rendered
    const adds = screen.getAllByRole("button", { name: "Add" });
    fireEvent.press(adds[adds.length - 1]);
    expect(count("clicks-count")).toBe(1);
    expect(count("mada-count")).toBe(2);
  });

  it("resets both counts only after confirming", async () => {
    await renderCounter({ clicks: 12, mada: 3 });
    fireEvent.press(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Reset Counter?")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Confirm" }));
    expect(count("clicks-count")).toBe(0);
    expect(count("mada-count")).toBe(0);
  });

  it("describes the count for screen readers", async () => {
    await renderCounter({ clicks: 5, mada: 1 });
    expect(screen.getByLabelText("Count. 5 of 108 clicks, 1 mada")).toBeTruthy();
  });
});
