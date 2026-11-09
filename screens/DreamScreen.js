import React, { useState, useRef, useCallback } from "react";
import { StyleSheet, View, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import AddButton from "../components/AddButton";
import DreamBoard from "../components/DreamBoard";
import AffirmationsList from "../components/AffirmationsList";
import {
  ActionSheet,
  CountPill,
  IconButton,
  ScreenHeader,
  SectionHeader,
} from "../components/ui";
import { colors, spacing, useBottomClearance } from "../theme";

const KEEP_AWAKE_TAG = "dream-board";

/**
 * Dream tab: the vision board first, then the daily affirmations beneath it —
 * one place to look at what you're working towards and read what you tell
 * yourself about it.
 *
 * The header "+" asks which to add (photos or an affirmation); each section
 * heading also has its own "+" for a one-tap add in context.
 */
export default function DreamScreen() {
  const boardRef = useRef(null);
  const affirmationsRef = useRef(null);
  const [photoCount, setPhotoCount] = useState(0);
  // null while the affirmations are loading or failed to load
  const [affirmationCount, setAffirmationCount] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const bottomClearance = useBottomClearance();

  // A vision board that blanks out after 30 seconds isn't much of one. Hold the
  // screen on while this tab is focused — the board, the expanded-photo viewer
  // and the affirmations below — and release it on the way out so the other
  // tabs sleep normally. Tabs stay mounted once visited, so this has to key off
  // focus, not mount.
  useFocusEffect(
    useCallback(() => {
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      return () => {
        deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      };
    }, []),
  );

  // Photos are local; only the affirmations come from the backend.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await affirmationsRef.current?.reload();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const addPhotos = () => boardRef.current?.openAdd();
  const addAffirmation = () => affirmationsRef.current?.openAdd();

  const summary = [
    `${photoCount} ${photoCount === 1 ? "photo" : "photos"}`,
    affirmationCount != null
      ? `${affirmationCount} ${affirmationCount === 1 ? "affirmation" : "affirmations"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Dream Board"
        subtitle={summary}
        right={<AddButton label="Add to Dream Board" onPress={() => setChooserOpen(true)} />}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <SectionHeader
          title="Dream board"
          right={
            <>
              {photoCount > 0 ? <CountPill count={photoCount} /> : null}
              <IconButton
                icon="add"
                label="Add photos to the board"
                size="sm"
                color={colors.primary}
                onPress={addPhotos}
              />
            </>
          }
        />
        <DreamBoard
          addRef={boardRef}
          onCountChange={setPhotoCount}
          horizontalInset={spacing.lg}
        />

        <SectionHeader
          title="Affirmations"
          style={styles.secondSection}
          right={
            <>
              {affirmationCount ? <CountPill count={affirmationCount} /> : null}
              <IconButton
                icon="add"
                label="Add an affirmation"
                size="sm"
                color={colors.primary}
                onPress={addAffirmation}
              />
            </>
          }
        />
        <AffirmationsList addRef={affirmationsRef} onCountChange={setAffirmationCount} />
      </ScrollView>

      <ActionSheet
        visible={chooserOpen}
        title="Add to Dream Board"
        onClose={() => setChooserOpen(false)}
        actions={[
          {
            key: "photos",
            testID: "add-choice-photos",
            label: "Add photos",
            icon: "images-outline",
            hint: "From your photo library",
            onPress: addPhotos,
          },
          {
            key: "affirmation",
            testID: "add-choice-affirmation",
            label: "Add affirmation",
            icon: "heart-outline",
            hint: "A short line to read every day",
            onPress: addAffirmation,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  secondSection: {
    marginTop: spacing.xl,
  },
});
