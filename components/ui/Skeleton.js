import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet } from "react-native";
import { colors, radii, spacing } from "../../theme";

/**
 * Pulsing placeholder blocks shown while a list loads — the layout appears
 * immediately, so the screen never jumps from a spinner to content.
 */
function usePulse() {
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

export function SkeletonBlock({ width = "100%", height = 14, radius = radii.xs, style }) {
  return (
    <View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.surfaceSunken },
        style,
      ]}
    />
  );
}

/** A few card-shaped groups of rows. `variant="tiles"` for big text cards. */
export default function SkeletonList({ groups = 2, rows = 3, variant = "rows", testID }) {
  const opacity = usePulse();
  return (
    <Animated.View
      testID={testID || "skeleton"}
      style={{ opacity }}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      {Array.from({ length: groups }).map((_, g) => (
        <View key={g} style={styles.card}>
          {variant === "rows" ? (
            <>
              <SkeletonBlock width="40%" height={16} style={{ marginBottom: spacing.lg }} />
              {Array.from({ length: rows }).map((__, r) => (
                <View key={r} style={styles.row}>
                  <SkeletonBlock width={22} height={22} radius={6} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <SkeletonBlock width={`${80 - r * 12}%`} />
                    <SkeletonBlock width="28%" height={10} />
                  </View>
                </View>
              ))}
            </>
          ) : (
            <>
              <SkeletonBlock width="85%" height={18} style={{ marginBottom: 10 }} />
              <SkeletonBlock width="55%" height={18} />
            </>
          )}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
});
