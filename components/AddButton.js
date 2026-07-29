import React from "react";
import { StyleSheet, TouchableOpacity, Text } from "react-native";

/* Shared icon-only "+" button used on every tab, mirroring the web FE's
   readme-heading__add-btn look. It sits next to the title in the blue title
   bar (Counter keeps it in its content toolbar beside Reset). Nothing shows
   but the plus, so `label` is the accessible name only — "Add header". */
export default function AddButton({ label, onPress }) {
  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.text}>+</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d0d7de",
  },
  text: {
    fontSize: 26,
    fontWeight: "600",
    color: "#1e88e5",
  },
});
