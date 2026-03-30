import React from "react";
import { StyleSheet, View, Text } from "react-native";

export default function DreamScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dream</Text>
      <Text style={styles.subtitle}>Your dreams and aspirations</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
});
