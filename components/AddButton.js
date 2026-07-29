import React from "react";
import { StyleSheet, TouchableOpacity, Text } from "react-native";

/* Shared "+ Add X" button used on every tab, mirroring the web FE's
   readme-heading__add-btn look (bordered, muted text). Wrap it in a
   right-aligned toolbar row inside the screen's content. */
export default function AddButton({ label, onPress }) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.text}>+ {label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d0d7de",
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    color: "#656d76",
  },
});
