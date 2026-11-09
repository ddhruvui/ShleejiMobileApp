import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  Alert,
  Platform,
  Modal,
  FlatList,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, IconButton } from "./ui";
import { colors, radii, spacing, type } from "../theme";

const COLUMN_COUNT = 2;
const GAP = 10;

/**
 * The vision board: a two-column masonry grid of device-library photos,
 * persisted locally in AsyncStorage ("dreamPhotos"), with a full-screen viewer
 * to reorder or remove a photo. The viewer is a horizontal pager: swipe left /
 * right to move between photos in board order without closing it. Renders inline (no ScrollView of its own) so
 * the Dream tab can stack it above the affirmations.
 *
 * `addRef.current.openAdd()` opens the photo picker (the tab's "+" reaches in
 * through it); `onCountChange(n)` reports the photo count for the header.
 * `horizontalInset` is the screen padding on each side, used to size columns.
 */
export default function DreamBoard({ addRef, onCountChange, horizontalInset = spacing.lg }) {
  const [photos, setPhotos] = useState([]);
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef(null);
  // The page the viewer's pager is scrolled to (-1 = not synced yet). Swipes
  // update it from onScroll; a reorder or a fresh open scrolls the pager to
  // the expanded photo when they disagree.
  const pagerIndexRef = useRef(-1);
  // Pages get an explicit height: flex stretch doesn't reach list cells on
  // every platform (on web they collapse to 0).
  const [pagerHeight, setPagerHeight] = useState(0);
  const imageWidth =
    (width - horizontalInset * 2 - GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

  useEffect(() => {
    loadPhotos();
    requestPermissions();
  }, []);

  useEffect(() => {
    onCountChange?.(photos.length);
  }, [photos.length, onCountChange]);

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

  // Re-created every render so it always sees the latest photos.
  useImperativeHandle(addRef, () => ({ openAdd: pickImage }));

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

  const openPhoto = (item) => {
    pagerIndexRef.current = -1;
    setExpandedPhoto(item);
  };

  const renderPhoto = (item) => (
    <Pressable
      key={item.id.toString()}
      style={({ pressed }) => [styles.photoContainer, pressed && styles.photoPressed]}
      onPress={() => openPhoto(item)}
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

  // Keep the pager on the expanded photo when it moves under it (Up / Down
  // swaps it with a neighbour) or the viewer has just opened.
  useEffect(() => {
    if (expandedIndex < 0 || expandedIndex === pagerIndexRef.current) return;
    if (!pagerRef.current) return;
    pagerIndexRef.current = expandedIndex;
    pagerRef.current.scrollToOffset({ offset: expandedIndex * width, animated: false });
  }, [expandedIndex, width]);

  const onPagerScroll = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index === pagerIndexRef.current || !photos[index]) return;
    pagerIndexRef.current = index;
    setExpandedPhoto(photos[index]);
  };

  // Tapping a photo closes the viewer, as tapping the backdrop does; the
  // pressable itself stays out of the accessibility tree so the photo is read
  // as an image (the Close button is the accessible way out).
  const renderPage = ({ item, index }) => (
    <Pressable
      style={[styles.page, { width, height: pagerHeight }]}
      onPress={() => setExpandedPhoto(null)}
      accessible={false}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.expandedPhoto}
        resizeMode="contain"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Photo ${index + 1} of ${photos.length}`}
      />
    </Pressable>
  );

  return (
    <>
      {photos.length === 0 ? (
        <EmptyState
          compact
          icon="images-outline"
          title="No dreams yet"
          message="Add photos that inspire you — the screen stays on while you look."
          actionLabel="Add photos"
          onAction={pickImage}
          style={styles.empty}
        />
      ) : (
        <View style={styles.masonryContainer}>
          <View style={styles.masonryColumn}>{leftColumn.map(renderPhoto)}</View>
          <View style={{ width: GAP }} />
          <View style={styles.masonryColumn}>{rightColumn.map(renderPhoto)}</View>
        </View>
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
            <FlatList
              ref={pagerRef}
              style={styles.pager}
              data={photos}
              keyExtractor={(photo) => photo.id.toString()}
              renderItem={renderPage}
              extraData={pagerHeight}
              onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
              initialScrollIndex={Math.max(expandedIndex, 0)}
              onScroll={onPagerScroll}
              scrollEventThrottle={16}
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
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
    </>
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
      style={[styles.controlButton, disabled && styles.controlDisabled]}
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
            <Ionicons
              name={icon}
              size={24}
              color={destructive ? colors.dangerOnDark : colors.white}
            />
          </View>
          <Text style={styles.controlButtonText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
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
  pager: {
    flex: 1,
    marginVertical: spacing.lg,
  },
  page: {
    justifyContent: "center",
  },
  expandedPhoto: {
    flex: 1,
    width: "100%",
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
