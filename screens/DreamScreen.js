import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  Alert,
  ScrollView,
  Platform,
  Modal,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import AddButton from "../components/AddButton";
import { EmptyState, IconButton, ScreenHeader } from "../components/ui";
import { colors, radii, spacing, type, useBottomClearance } from "../theme";

const KEEP_AWAKE_TAG = "dream-board";
const COLUMN_COUNT = 2;
const GAP = 10;
const PADDING = 12;

export default function DreamScreen() {
  const [photos, setPhotos] = useState([]);
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomClearance = useBottomClearance();
  const imageWidth = (width - PADDING * 2 - GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

  useEffect(() => {
    loadPhotos();
    requestPermissions();
  }, []);

  // A vision board that blanks out after 30 seconds isn't much of one. Hold the
  // screen on while this tab is focused — that covers the expanded-photo modal
  // too — and release it on the way out so the other tabs sleep normally. Tabs
  // stay mounted once visited, so this has to key off focus, not mount.
  useFocusEffect(
    useCallback(() => {
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      return () => {
        deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      };
    }, []),
  );

  const requestPermissions = async () => {
    if (Platform.OS !== "web") {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Sorry, we need camera roll permissions to make this work!",
        );
      }
    }
  };

  const loadPhotos = async () => {
    try {
      const storedPhotos = await AsyncStorage.getItem("dreamPhotos");
      if (storedPhotos) {
        setPhotos(JSON.parse(storedPhotos));
      }
    } catch (error) {
      console.error("Error loading photos:", error);
    }
  };

  const savePhotos = async (newPhotos) => {
    try {
      await AsyncStorage.setItem("dreamPhotos", JSON.stringify(newPhotos));
    } catch (error) {
      console.error("Error saving photos:", error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        const newPhotos = result.assets.map((asset) => ({
          id: Date.now() + Math.random(),
          uri: asset.uri,
          height: asset.height,
          width: asset.width,
        }));

        const updatedPhotos = [...photos, ...newPhotos];
        setPhotos(updatedPhotos);
        savePhotos(updatedPhotos);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const removePhoto = (id) => {
    Alert.alert("Remove Photo", "Are you sure you want to remove this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          const updatedPhotos = photos.filter((photo) => photo.id !== id);
          setPhotos(updatedPhotos);
          savePhotos(updatedPhotos);
          setExpandedPhoto(null); // Close the modal after removing
        },
      },
    ]);
  };

  const movePhotoUp = (id) => {
    const index = photos.findIndex((photo) => photo.id === id);
    if (index > 0) {
      const updatedPhotos = [...photos];
      [updatedPhotos[index - 1], updatedPhotos[index]] = [
        updatedPhotos[index],
        updatedPhotos[index - 1],
      ];
      setPhotos(updatedPhotos);
      savePhotos(updatedPhotos);
      // Update the expanded photo to reflect the new index
      setExpandedPhoto(updatedPhotos[index - 1]);
    }
  };

  const movePhotoDown = (id) => {
    const index = photos.findIndex((photo) => photo.id === id);
    if (index < photos.length - 1) {
      const updatedPhotos = [...photos];
      [updatedPhotos[index + 1], updatedPhotos[index]] = [
        updatedPhotos[index],
        updatedPhotos[index + 1],
      ];
      setPhotos(updatedPhotos);
      savePhotos(updatedPhotos);
      // Update the expanded photo to reflect the new index
      setExpandedPhoto(updatedPhotos[index + 1]);
    }
  };

  const calculateImageHeight = useCallback(
    (photo) => {
      const aspectRatio = photo.height && photo.width ? photo.height / photo.width : 1;
      return imageWidth * aspectRatio;
    },
    [imageWidth],
  );

  // Distribute photos into two columns for masonry layout (greedy shortest-column-first)
  const { leftColumn, rightColumn } = useMemo(() => {
    const left = [];
    const right = [];
    let leftHeight = 0;
    let rightHeight = 0;

    photos.forEach((photo) => {
      const cardHeight = calculateImageHeight(photo) + GAP; // image height + gap between cards
      if (leftHeight <= rightHeight) {
        left.push(photo);
        leftHeight += cardHeight;
      } else {
        right.push(photo);
        rightHeight += cardHeight;
      }
    });

    return { leftColumn: left, rightColumn: right };
  }, [photos, calculateImageHeight]);

  const renderPhoto = (item) => (
    <Pressable
      key={item.id.toString()}
      style={({ pressed }) => [styles.photoContainer, pressed && styles.photoPressed]}
      onPress={() => setExpandedPhoto(item)}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Dream photo ${photos.indexOf(item) + 1} of ${photos.length}`}
    >
      <Image
        source={{ uri: item.uri }}
        style={[styles.photo, { width: "100%", height: calculateImageHeight(item) }]}
      />
    </Pressable>
  );

  const expandedIndex = expandedPhoto
    ? photos.findIndex((p) => p.id === expandedPhoto.id)
    : -1;
  const isFirst = expandedIndex === 0;
  const isLast = expandedIndex === photos.length - 1;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Dream Board"
        subtitle={
          photos.length > 0
            ? `${photos.length} ${photos.length === 1 ? "photo" : "photos"} · screen stays on`
            : undefined
        }
        right={<AddButton label="Add photo" onPress={pickImage} />}
      />

      {photos.length === 0 ? (
        <EmptyState
          icon="images-outline"
          title="No dreams yet"
          message="Add photos that inspire you — the screen stays on while you look."
          actionLabel="Add photos"
          onAction={pickImage}
          style={{ paddingBottom: bottomClearance }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.photosGrid, { paddingBottom: bottomClearance }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.masonryContainer}>
            <View style={styles.masonryColumn}>{leftColumn.map(renderPhoto)}</View>
            <View style={{ width: GAP }} />
            <View style={styles.masonryColumn}>{rightColumn.map(renderPhoto)}</View>
          </View>
        </ScrollView>
      )}

      {/* Expanded photo viewer */}
      <Modal
        visible={expandedPhoto !== null}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setExpandedPhoto(null)}
      >
        <View style={styles.viewer}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setExpandedPhoto(null)}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          />

          <View
            pointerEvents="box-none"
            style={[styles.viewerTop, { paddingTop: insets.top + spacing.sm }]}
          >
            <Text style={styles.viewerCount}>
              {expandedIndex >= 0 ? `${expandedIndex + 1} / ${photos.length}` : ""}
            </Text>
            <IconButton
              icon="close"
              label="Close photo"
              variant="inverse"
              onPress={() => setExpandedPhoto(null)}
            />
          </View>

          {expandedPhoto && (
            <Image
              source={{ uri: expandedPhoto.uri }}
              style={styles.expandedPhoto}
              resizeMode="contain"
              pointerEvents="none"
            />
          )}

          {expandedPhoto && (
            <View
              pointerEvents="box-none"
              style={[styles.photoControls, { paddingBottom: insets.bottom + spacing.lg }]}
            >
              <ViewerAction
                icon="arrow-up"
                label="Up"
                disabled={isFirst}
                onPress={() => movePhotoUp(expandedPhoto.id)}
              />
              <ViewerAction
                icon="trash-outline"
                label="Remove"
                destructive
                onPress={() => removePhoto(expandedPhoto.id)}
              />
              <ViewerAction
                icon="arrow-down"
                label="Down"
                disabled={isLast}
                onPress={() => movePhotoDown(expandedPhoto.id)}
              />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function ViewerAction({ icon, label, onPress, disabled, destructive }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.controlButton, disabled && styles.controlDisabled]}
    >
      {({ pressed }) => (
        <>
          <View
            style={[
              styles.controlCircle,
              destructive && styles.controlCircleDanger,
              pressed && styles.controlCirclePressed,
            ]}
          >
            <Ionicons name={icon} size={24} color={destructive ? colors.dangerOnDark : colors.white} />
          </View>
          <Text style={styles.controlButtonText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  photosGrid: {
    paddingHorizontal: PADDING,
    paddingTop: spacing.xs,
  },
  masonryContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  masonryColumn: {
    flex: 1,
  },
  photoContainer: {
    marginBottom: GAP,
    borderRadius: radii.lg + 2,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
  },
  photoPressed: {
    opacity: 0.88,
  },
  photo: {
    resizeMode: "cover",
  },
  viewer: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "space-between",
  },
  viewerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  viewerCount: {
    ...type.callout,
    color: "rgba(255,255,255,0.75)",
  },
  expandedPhoto: {
    flex: 1,
    width: "100%",
    marginVertical: spacing.lg,
  },
  photoControls: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingTop: spacing.sm,
  },
  controlButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    minWidth: 72,
  },
  controlDisabled: {
    opacity: 0.3,
  },
  controlCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlCircleDanger: {
    backgroundColor: "rgba(255,107,107,0.16)",
  },
  controlCirclePressed: {
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  controlButtonText: {
    ...type.caption,
    color: colors.white,
    marginTop: spacing.sm,
  },
});
