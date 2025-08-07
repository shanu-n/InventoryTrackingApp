// AddItemScreen.js
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { analyzeImage } from '../services/visionService';
import inventoryService from '../services/inventoryService';

const AddItemScreen = () => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [currentStep, setCurrentStep] = useState('photo');
  const [capturedImage, setCapturedImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    item_id: '',
    vendor: '',
    manufacture_date: '',
  });

  const openCamera = async () => {
    const { status } = await requestCameraPermission();
    if (status === 'granted') {
      setCurrentStep('camera');
    } else {
      Alert.alert('Camera permission is required');
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ base64: true });
      setCapturedImage(photo.uri);
      setCurrentStep('preview');
    }
  };

  const pickImageFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setCapturedImage(result.assets[0].uri);
      setCurrentStep('preview');
    }
  };

  const handleUsePhoto = async () => {
    if (!capturedImage) {
      Alert.alert('No image selected');
      return;
    }

    try {
      setLoading(true);
      const extractedData = await analyzeImage(capturedImage);

      setFormData({
        title: extractedData.title || '',
        description: extractedData.description || '',
        item_id: extractedData.item_id || '',
        vendor: extractedData.vendor || '',
        manufacture_date: extractedData.manufacture_date || '',
      });

      setCurrentStep('form');
    } catch (error) {
      Alert.alert('Error', 'Failed to extract data from the image.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await inventoryService.addItem(formData);
      Alert.alert('Success', 'Item added successfully!');
      setCapturedImage(null);
      setFormData({
        title: '',
        description: '',
        item_id: '',
        vendor: '',
        manufacture_date: '',
      });
      setCurrentStep('photo');
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {currentStep === 'camera' ? (
            <CameraView ref={cameraRef} style={styles.camera}>
              <TouchableOpacity onPress={takePicture} style={styles.captureButton}>
                <Ionicons name="camera" size={32} color="#fff" />
              </TouchableOpacity>
            </CameraView>
          ) : currentStep === 'photo' ? (
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add Item Photo</Text>
              <Text style={styles.modalSubtitle}>
                Choose how you'd like to add a photo for your inventory item
              </Text>

              <View style={styles.cardContainer}>
                <TouchableOpacity onPress={openCamera} style={styles.card}>
                  <Ionicons name="camera" size={40} color="#2563EB" />
                  <Text style={styles.cardTitle}>Take Photo</Text>
                  <Text style={styles.cardText}>Use your camera to capture the item</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={pickImageFromGallery} style={styles.card}>
                  <Ionicons name="image" size={40} color="#2563EB" />
                  <Text style={styles.cardTitle}>Upload Photo</Text>
                  <Text style={styles.cardText}>Choose from your photo gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : currentStep === 'preview' ? (
            <>
              <Text style={styles.heading}>Step 2: Preview & Extract</Text>
              <View style={styles.imagePreview}>
                {capturedImage ? (
                  <Image source={{ uri: capturedImage }} style={styles.image} />
                ) : (
                  <Text>No image selected</Text>
                )}
              </View>
              <TouchableOpacity onPress={handleUsePhoto} style={styles.extractButton}>
                <Text style={styles.buttonText}>Extract Item Details</Text>
              </TouchableOpacity>
              {loading && <ActivityIndicator size="large" color="#0000ff" />}
            </>
          ) : currentStep === 'form' ? (
            <>
              <Text style={styles.heading}>Add Item Details</Text>

              <Image source={{ uri: capturedImage }} style={styles.previewImage} />

              <Text style={styles.label}>Item Title *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholder="Enter item title"
              />

              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={styles.input}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Enter item description"
              />

              <Text style={styles.label}>Item ID *</Text>
              <TextInput
                style={styles.input}
                value={formData.item_id}
                onChangeText={(text) => setFormData({ ...formData, item_id: text })}
                placeholder="Enter unique item ID"
              />

              <Text style={styles.label}>Vendor *</Text>
              <TextInput
                style={styles.input}
                value={formData.vendor}
                onChangeText={(text) => setFormData({ ...formData, vendor: text })}
                placeholder="Enter vendor name"
              />

              <Text style={styles.label}>Manufacture Date</Text>
              <TextInput
                style={styles.input}
                value={formData.manufacture_date}
                onChangeText={(text) => setFormData({ ...formData, manufacture_date: text })}
                placeholder="YYYY-MM-DD"
              />

              <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.buttonText}> Save Item</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </KeyboardAvoidingView>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddItemScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    padding: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
    color: '#111827',
  },
  camera: {
    flex: 1,
    height: 500,
  },
  captureButton: {
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#111827',
    borderRadius: 10,
  },
  imagePreview: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 20,
    borderRadius: 10,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  previewImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  extractButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  label: {
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 12,
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  // New Card UI Styles
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 24,
  },
  cardContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#F1F5F9',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    color: '#1E3A8A',
  },
  cardText: {
    fontSize: 13,
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 4,
  },
});
