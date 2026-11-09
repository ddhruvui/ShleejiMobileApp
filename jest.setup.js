/* Global mocks for the jest-expo test environment. Network-backed modules
   (api/*) are mocked per test file — no test ever reaches a real backend. */
import mockSafeAreaContext from "react-native-safe-area-context/jest/mock";

jest.mock("react-native-safe-area-context", () => mockSafeAreaContext);

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-image-picker", () => ({
  MediaTypeOptions: { Images: "Images" },
  requestMediaLibraryPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: "granted" }),
  ),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
}));

jest.mock("./utils/notifications", () => ({
  syncDailyReminders: jest.fn(() => Promise.resolve()),
}));

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  const Picker = (props) => <View testID="datetimepicker" {...props} />;
  return { __esModule: true, default: Picker };
});

/* Icon fonts load asynchronously and re-render outside act(); tests don't
   need the glyphs, so icons render as an empty, non-accessible Text. */
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name, size, color, style }) =>
    React.createElement(Text, {
      testID: `icon-${name}`,
      style,
      accessible: false,
      importantForAccessibility: "no",
    });
  return { __esModule: true, Ionicons: Icon };
});
