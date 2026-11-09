import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ConfirmModal from "../components/ConfirmModal";
import {
  Button,
  LoadingState,
  ScreenHeader,
  Sheet,
  SheetActions,
  TextField,
} from "../components/ui";
import { colors, radii, shadows, spacing, type, useBottomClearance } from "../theme";

const STORAGE_KEY = "clickCount";
const MADA_STORAGE_KEY = "madaCount";
export const BEADS_PER_MADA = 108;

/** Pure counting rule shared by tap and bulk add: every 108 clicks = 1 mada. */
export function addClicks(clicks, mada, n) {
  const total = clicks + n;
  return { clicks: total % BEADS_PER_MADA, mada: mada + Math.floor(total / BEADS_PER_MADA) };
}

/**
 * A mala: a larger guru bead at the top plus 108 beads around a circle, the
 * first `filled` of them lit (clockwise from the guru bead). Plain Views — no
 * SVG dependency.
 */
const SLOTS = BEADS_PER_MADA + 1; // slot 0 is the guru bead

function BeadRing({ size, filled }) {
  const beads = useMemo(() => {
    const r = size / 2 - 8;
    return Array.from({ length: SLOTS }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / SLOTS;
      const guru = i === 0;
      const slot = (2 * Math.PI * r) / SLOTS;
      const d = guru ? 14 : Math.max(4, Math.min(9, slot * 0.8));
      return {
        key: i,
        d,
        left: size / 2 + r * Math.cos(a) - d / 2,
        top: size / 2 + r * Math.sin(a) - d / 2,
      };
    });
  }, [size]);

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {beads.map((b) => (
        <View
          key={b.key}
          style={{
            position: "absolute",
            left: b.left,
            top: b.top,
            width: b.d,
            height: b.d,
            borderRadius: b.d / 2,
            backgroundColor:
              b.key === 0
                ? colors.accentText
                : b.key <= filled
                  ? colors.accent
                  : colors.borderStrong,
          }}
        />
      ))}
    </View>
  );
}

export default function CounterScreen() {
  const [clicks, setClicks] = useState(0);
  const [mada, setMada] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [padSize, setPadSize] = useState({ width: 0, height: 0 });
  const pulse = useRef(new Animated.Value(1)).current;
  const bottomClearance = useBottomClearance(spacing.md);

  // Load saved click count and mada count on mount
  useEffect(() => {
    (async () => {
      try {
        const [savedClicks, savedMada] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(MADA_STORAGE_KEY),
        ]);
        if (savedClicks !== null) {
          setClicks(parseInt(savedClicks, 10));
        }
        if (savedMada !== null) {
          setMada(parseInt(savedMada, 10));
        }
      } catch (e) {
        console.error("Failed to load counts", e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Persist click count and mada count whenever they change (after initial load)
  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY, clicks.toString()).catch((e) =>
        console.error("Failed to save click count", e),
      );
    }
  }, [clicks, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(MADA_STORAGE_KEY, mada.toString()).catch((e) =>
        console.error("Failed to save mada count", e),
      );
    }
  }, [mada, isLoaded]);

  const handleTap = useCallback(() => {
    setClicks((prev) => {
      const next = prev + 1;
      if (next >= BEADS_PER_MADA) {
        setMada((m) => m + 1);
        return 0;
      }
      return next;
    });
    pulse.setValue(1.07);
    Animated.spring(pulse, {
      toValue: 1,
      friction: 5,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [pulse]);

  const handleAddPress = useCallback(() => {
    setAddInput("");
    setAddModalVisible(true);
  }, []);

  const handleConfirmAdd = useCallback(() => {
    const num = parseInt(addInput, 10);
    if (isNaN(num) || num <= 0) {
      setAddModalVisible(false);
      return;
    }
    setClicks((prevClicks) => {
      const totalClicks = prevClicks + num;
      const extraMada = Math.floor(totalClicks / BEADS_PER_MADA);
      const remainingClicks = totalClicks % BEADS_PER_MADA;
      if (extraMada > 0) {
        setMada((m) => m + extraMada);
      }
      return remainingClicks;
    });
    setAddModalVisible(false);
  }, [addInput]);

  const handleCancelAdd = useCallback(() => {
    setAddModalVisible(false);
  }, []);

  const handleResetPress = useCallback(() => {
    setModalVisible(true);
  }, []);

  const handleConfirmReset = useCallback(() => {
    setClicks(0);
    setMada(0);
    setModalVisible(false);
  }, []);

  const handleCancelReset = useCallback(() => {
    setModalVisible(false);
  }, []);

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <LoadingState />
      </View>
    );
  }

  const ringSize = Math.max(
    180,
    Math.min(padSize.width - spacing.xxl * 2, padSize.height - 150, 340),
  );
  const parsedAdd = parseInt(addInput, 10);
  const addPreview =
    !isNaN(parsedAdd) && parsedAdd > 0 ? addClicks(clicks, mada, parsedAdd) : null;

  return (
    <View style={styles.container}>
      {/* Reset and "+ Add" stay labelled (not an icon-only "+"): a bare plus
          beside a tap-to-count pad would read as "increment by one". */}
      <ScreenHeader
        title="Counter"
        right={
          <>
            <Button title="Reset" variant="ghost" size="sm" onPress={handleResetPress} />
            <Button title="Add" icon="add" variant="tonal" size="sm" onPress={handleAddPress} />
          </>
        }
      />

      {/* ─── Trackpad: tap anywhere to increment ─── */}
      <Pressable
        testID="counter-trackpad"
        style={({ pressed }) => [
          styles.trackpad,
          { marginBottom: bottomClearance },
          pressed && styles.trackpadPressed,
        ]}
        onPress={handleTap}
        onLayout={(e) => setPadSize(e.nativeEvent.layout)}
        accessibilityRole="button"
        accessibilityLabel={`Count. ${clicks} of ${BEADS_PER_MADA} clicks, ${mada} mada`}
        accessibilityHint="Tap to add one"
      >
        {padSize.width > 0 ? (
          <View style={styles.ringWrap}>
            <BeadRing size={ringSize} filled={clicks} />
            <Animated.View style={[styles.center, { transform: [{ scale: pulse }] }]}>
              <Text style={styles.label}>CLICKS</Text>
              <Text style={styles.count} testID="clicks-count">
                {clicks}
              </Text>
              <Text style={styles.of}>of {BEADS_PER_MADA}</Text>
            </Animated.View>
          </View>
        ) : null}

        <View style={styles.madaPill}>
          <Text style={styles.madaLabel}>MADA</Text>
          <Text style={styles.madaCount} testID="mada-count">
            {mada}
          </Text>
        </View>

        <View style={styles.hintRow}>
          <Ionicons name="finger-print-outline" size={16} color={colors.textTertiary} />
          <Text style={styles.trackpadHint}>Tap anywhere to count</Text>
        </View>
      </Pressable>

      {/* ─── Reset confirmation ─── */}
      <ConfirmModal
        visible={modalVisible}
        title="Reset Counter?"
        message="This will reset both your click and mada counts to 0. Are you sure?"
        confirmLabel="Confirm"
        icon="refresh"
        onConfirm={handleConfirmReset}
        onCancel={handleCancelReset}
      />

      {/* ─── Add number sheet ─── */}
      <Sheet
        visible={addModalVisible}
        onClose={handleCancelAdd}
        title="Add Count"
        subtitle="Enter a number to add. Every 108 will count as 1 mada."
        footer={
          <SheetActions>
            <Button title="Cancel" variant="secondary" size="lg" onPress={handleCancelAdd} style={{ flex: 1 }} />
            <Button title="Add" size="lg" onPress={handleConfirmAdd} style={{ flex: 2 }} />
          </SheetActions>
        }
      >
        <TextField
          label="Clicks to add"
          keyboardType="number-pad"
          placeholder="e.g. 217"
          value={addInput}
          onChangeText={setAddInput}
          onSubmitEditing={handleConfirmAdd}
          autoFocus
          inputStyle={styles.addInput}
          helper={
            addPreview
              ? `You'll have ${addPreview.mada} mada and ${addPreview.clicks} clicks`
              : undefined
          }
        />
      </Sheet>
    </View>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  trackpad: {
    flex: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    borderRadius: radii.xxl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  trackpadPressed: {
    backgroundColor: colors.accentSoft,
  },
  ringWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    alignItems: "center",
  },
  label: {
    ...type.overline,
  },
  count: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: "800",
    letterSpacing: -1,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  of: {
    ...type.footnote,
    color: colors.textTertiary,
  },
  madaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg + 2,
  },
  madaLabel: {
    ...type.overline,
    color: colors.accentText,
  },
  madaCount: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.accentText,
    fontVariant: ["tabular-nums"],
  },
  hintRow: {
    position: "absolute",
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trackpadHint: {
    ...type.footnote,
    color: colors.textTertiary,
  },
  addInput: {
    fontSize: 22,
    textAlign: "center",
    minHeight: 56,
  },
});
