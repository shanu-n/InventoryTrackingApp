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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { analyzeImage } from '../services/visionService';
import inventoryService from '../services/inventoryService';

const AddItemScreen = () => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [currentStep, setCurrentStep] = useState('photo'); // 'photo' | 'camera' | 'preview' | 'form'
  const [capturedImage, setCapturedImage] = useState(null); // preview image URI (camera or gallery)
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // ✅ Store both local URI for preview and hosted URL for saving
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    item_id: '',
    vendor: '',
    manufacture_date: '',
    imageUrl: null, // This will be the hosted URL from vision API
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
      const photo = await cameraRef.current.takePictureAsync({ base64: false });
      // Save local URI for preview only
      setCapturedImage(photo.uri);
      setCurrentStep('preview');
    }
  };

  const pickImageFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8, // Reduce quality to save bandwidth
    });
  
    if (!result.canceled) {
      const pickedUri = result.assets?.[0]?.uri;
      setCapturedImage(pickedUri);
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
      setUploadProgress('Analyzing image...');
  
      // 🔑 Call Vision API — it uploads to Supabase and returns hosted URL + parsed data
      const extractedData = await analyzeImage(capturedImage);
  
      setFormData(prev => ({
        ...prev,
        title: extractedData.title || '',
        description: extractedData.description || '',
        item_id: extractedData.item_id || '',
        vendor: extractedData.vendor || '',
        manufacture_date: extractedData.manufacture_date || '',
        // ✅ Use the hosted URL from vision API
        imageUrl: extractedData.imageUrl,
      }));
  
      setCurrentStep('form');
    } catch (error) {
      Alert.alert('Error', 'Failed to extract data from the image.');
      console.error(error);
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setUploadProgress('Saving item...');

      // ✅ Pass the hosted URL directly - no need for additional upload
      const result = await inventoryService.addItem({
        title: formData.title,
        description: formData.description,
        item_id: formData.item_id,
        vendor: formData.vendor,
        manufacture_date: formData.manufacture_date,
        imageUrl: formData.imageUrl, // This is already a hosted URL
      });

      if (result.success) {
        Alert.alert('Success', 'Item added successfully!');
        // Reset form
        setCapturedImage(null);
        setFormData({
          title: '',
          description: '',
          item_id: '',
          vendor: '',
          manufacture_date: '',
          imageUrl: null,
        });
        setCurrentStep('photo');
      } else {
        Alert.alert('Error', result.error || 'Failed to add item');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
      console.error(error);
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const handleRetakePhoto = () => {
    setCapturedImage(null);
    setFormData(prev => ({ ...prev, imageUrl: null }));
    setCurrentStep('photo');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>{uploadProgress}</Text>
            </View>
          )}

          {currentStep === 'camera' ? (
            <View style={styles.cameraContainer}>
              <CameraView ref={cameraRef} style={styles.camera}>
                <View style={styles.cameraOverlay}>
                  <TouchableOpacity 
                    onPress={() => setCurrentStep('photo')} 
                    style={styles.backButton}
                  >
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={takePicture} style={styles.captureButton}>
                    <Ionicons name="camera" size={32} color="#fff" />
                  </TouchableOpacity>
                </View>
              </CameraView>
            </View>
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
              
              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={handleRetakePhoto} style={styles.retakeButton}>
                  <Ionicons name="camera-reverse" size={20} color="#6B7280" />
                  <Text style={styles.retakeButtonText}>Retake</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={handleUsePhoto} style={styles.extractButton}>
                  <Ionicons name="scan" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Extract Details</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : currentStep === 'form' ? (
            <>
              <Text style={styles.heading}>Add Item Details</Text>

              {/* ✅ Show the hosted image if available, fallback to captured image for preview */}
              {(formData.imageUrl || capturedImage) && (
                <Image 
                  source={{ uri: formData.imageUrl || capturedImage }} 
                  style={styles.previewImage} 
                />
              )}

              <Text style={styles.label}>Item Title *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholder="Enter item title"
                editable={!loading}
              />

              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Enter item description"
                multiline
                numberOfLines={3}
                editable={!loading}
              />

              <Text style={styles.label}>Item ID *</Text>
              <TextInput
                style={styles.input}
                value={formData.item_id}
                onChangeText={(text) => setFormData({ ...formData, item_id: text })}
                placeholder="Enter unique item ID"
                editable={!loading}
              />

              <Text style={styles.label}>Vendor *</Text>
              <TextInput
                style={styles.input}
                value={formData.vendor}
                onChangeText={(text) => setFormData({ ...formData, vendor: text })}
                placeholder="Enter vendor name"
                editable={!loading}
              />

              <Text style={styles.label}>Manufacture Date *</Text>
              <TextInput
                style={styles.input}
                value={formData.manufacture_date}
                onChangeText={(text) => setFormData({ ...formData, manufacture_date: text })}
                placeholder="YYYY-MM-DD"
                editable={!loading}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  onPress={handleRetakePhoto} 
                  style={styles.secondaryButton}
                  disabled={loading}
                >
                  <Ionicons name="camera-reverse" size={20} color="#6B7280" />
                  <Text style={styles.secondaryButtonText}>Change Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={handleSubmit} 
                  style={[styles.submitButton, loading && styles.disabledButton]}
                  disabled={loading}
                >
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Save Item</Text>
                </TouchableOpacity>
              </View>
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
  cameraContainer: {
    flex: 1,
    minHeight: 500,
  },
  camera: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
  },
  captureButton: {
    alignSelf: 'center',
    padding: 15,
    backgroundColor: '#111827',
    borderRadius: 40,
  },
  imagePreview: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 250,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: '#fff',
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
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  extractButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  retakeButton: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  retakeButtonText: {
    color: '#6B7280',
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontWeight: '600',
    marginLeft: 8,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  label: {
    fontWeight: '600',
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontWeight: '500',
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