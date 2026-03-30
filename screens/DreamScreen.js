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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const COLUMN_COUNT = 2;
const IMAGE_MARGIN = 10;
const IMAGE_WIDTH = (width - IMAGE_MARGIN * (COLUMN_COUNT + 1)) / COLUMN_COUNT;

export default function DreamScreen() {
  const [photos, setPhotos] = useState([]);

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
        },
      },
    ]);
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
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removePhoto(item.id)}
      >
        <Ionicons name="close-circle" size={28} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dream Board</Text>
        <TouchableOpacity style={styles.addButton} onPress={pickImage}>
          <Ionicons name="add-circle" size={32} color="#6200ee" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
  },
  addButton: {
    padding: 5,
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
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 14,
  },
});
