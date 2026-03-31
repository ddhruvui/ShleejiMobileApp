import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");
const COLUMN_COUNT = 2;
const IMAGE_MARGIN = 10;
const IMAGE_WIDTH = (width - IMAGE_MARGIN * (COLUMN_COUNT + 1)) / COLUMN_COUNT;

export default function DreamScreen() {
  const [photos, setPhotos] = useState([]);
  const [expandedPhoto, setExpandedPhoto] = useState(null);

  useEffect(() => {
    loadPhotos();
    requestPermissions();
  }, []);

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

  const calculateImageHeight = (photo) => {
    const aspectRatio = photo.height / photo.width;
    return IMAGE_WIDTH * aspectRatio;
  };

  const renderPhoto = ({ item, index }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[
        styles.photoContainer,
        { marginLeft: index % 2 === 0 ? 0 : IMAGE_MARGIN },
      ]}
      onPress={() => setExpandedPhoto(item)}
    >
      <Image
        source={{ uri: item.uri }}
        style={[
          styles.photo,
          {
            width: IMAGE_WIDTH,
            height: calculateImageHeight(item),
          },
        ]}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dream Board</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={pickImage}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>No dreams yet</Text>
          <Text style={styles.emptySubtext}>
            Tap the + button to add inspiration
          </Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={(item) => item.id.toString()}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.photosGrid}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Expanded Photo Modal */}
      <Modal
        visible={expandedPhoto !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setExpandedPhoto(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setExpandedPhoto(null)}
          >
            <View style={styles.expandedPhotoContainer}>
              {expandedPhoto && (
                <>
                  <Image
                    source={{ uri: expandedPhoto.uri }}
                    style={styles.expandedPhoto}
                    resizeMode="contain"
                  />
                  <View style={styles.photoControls}>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        movePhotoUp(expandedPhoto.id);
                      }}
                      disabled={
                        photos.findIndex((p) => p.id === expandedPhoto.id) === 0
                      }
                    >
                      <Ionicons
                        name="arrow-up-circle"
                        size={48}
                        color={
                          photos.findIndex((p) => p.id === expandedPhoto.id) ===
                          0
                            ? "#666"
                            : "#fff"
                        }
                      />
                      <Text style={styles.controlButtonText}>Up</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        removePhoto(expandedPhoto.id);
                      }}
                    >
                      <Ionicons name="trash" size={48} color="#ff4444" />
                      <Text style={styles.controlButtonText}>Remove</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        movePhotoDown(expandedPhoto.id);
                      }}
                      disabled={
                        photos.findIndex((p) => p.id === expandedPhoto.id) ===
                        photos.length - 1
                      }
                    >
                      <Ionicons
                        name="arrow-down-circle"
                        size={48}
                        color={
                          photos.findIndex((p) => p.id === expandedPhoto.id) ===
                          photos.length - 1
                            ? "#666"
                            : "#fff"
                        }
                      />
                      <Text style={styles.controlButtonText}>Down</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 28,
    backgroundColor: "#1e88e5",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
  },
  addButton: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e88e5",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#999",
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#bbb",
    marginTop: 8,
  },
  photosGrid: {
    padding: IMAGE_MARGIN,
    paddingBottom: 120,
  },
  photoContainer: {
    margin: IMAGE_MARGIN / 2,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photo: {
    resizeMode: "cover",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  expandedPhotoContainer: {
    width: width,
    height: height,
    justifyContent: "center",
    alignItems: "center",
  },
  expandedPhoto: {
    width: width,
    height: height * 0.7,
  },
  photoControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: width * 0.8,
    marginTop: 40,
  },
  controlButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  controlButtonText: {
    color: "#fff",
    fontSize: 14,
    marginTop: 8,
    fontWeight: "600",
  },
});
