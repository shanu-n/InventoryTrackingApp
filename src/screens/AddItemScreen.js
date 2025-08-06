import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import inventoryService from '../services/inventoryService';

const AddItemScreen = ({ navigation }) => {
  // Camera permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  // Image states
  const [hasGalleryPermission, setHasGalleryPermission] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('back');
  const [loading, setLoading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  
  // Screen states - using direct rendering instead of modals
  const [currentScreen, setCurrentScreen] = useState('imageOptions'); // 'imageOptions', 'camera', 'confirmImage', 'itemForm'
  
  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    item_id: '',
    vendor: '',
    manufacture_date: '',
  });
  const [errors, setErrors] = useState({});
  
  // Refs and animations
  const cameraRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Request permissions on component mount
    const setupPermissions = async () => {
      try {
        // Request camera permissions immediately
        if (!cameraPermission?.granted) {
          await requestCameraPermission();
        }
        
        // Request gallery permissions
        await getGalleryPermissions();
        
        // Start animations
        animateIn();
      } catch (error) {
        console.error('Permission setup error:', error);
      }
    };

    setupPermissions();
  }, []);

  // Debug useEffect to track screen state changes
  useEffect(() => {
    console.log('🔄 Screen state changed to:', currentScreen);
    console.log('📷 Captured image:', capturedImage ? 'exists' : 'null');
  }, [currentScreen, capturedImage]);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getGalleryPermissions = async () => {
    try {
      const galleryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setHasGalleryPermission(galleryStatus.status === 'granted');
    } catch (error) {
      console.error('Gallery permission error:', error);
      Alert.alert('Error', 'Failed to get gallery permissions');
    }
  };

  const handleTakePhoto = async () => {
    // Check if we have permission
    if (!cameraPermission?.granted) {
      // Request permission
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Required', 
          'This app needs camera access to take photos. Please enable camera permissions in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => {
              // On iOS, this will open the app settings
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              }
            }}
          ]
        );
        return;
      }
    }
    
    setCurrentScreen('camera');
  };

  const handleUploadPhoto = async () => {
    if (!hasGalleryPermission) {
      Alert.alert('Permission Required', 'Gallery permission is required to upload photos.');
      return;
    }

    setProcessingImage(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('✅ Image selected:', result.assets[0].uri);
        
        // Set the captured image and show confirm screen
        setCapturedImage(result.assets[0].uri);
        setCurrentScreen('confirmImage');
        
        console.log('✅ Screen set to confirmImage');
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image from gallery');
    } finally {
      setProcessingImage(false);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        
        console.log('✅ Photo taken:', photo.uri);
        
        // Set the captured image and show confirm screen
        setCapturedImage(photo.uri);
        setCurrentScreen('confirmImage');
        
        console.log('✅ Screen set to confirmImage');
      } catch (error) {
        console.error('Take picture error:', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const retakePicture = () => {
    setCapturedImage(null);
    setCurrentScreen('imageOptions');
  };

  const confirmImage = () => {
    console.log('✅ Confirming image:', capturedImage);
    setCurrentScreen('itemForm');
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.item_id.trim()) newErrors.item_id = 'Item ID is required';
    if (!formData.vendor.trim()) newErrors.vendor = 'Vendor is required';
    if (!formData.manufacture_date.trim()) newErrors.manufacture_date = 'Manufacture date is required';

    // Validate date format (YYYY-MM-DD)
    if (formData.manufacture_date && !/^\d{4}-\d{2}-\d{2}$/.test(formData.manufacture_date)) {
      newErrors.manufacture_date = 'Date must be in YYYY-MM-DD format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveItem = async () => {
    console.log('💾 Save item called with data:', formData);
    console.log('📷 Captured image:', capturedImage);
    
    if (!validateForm()) {
      console.log('❌ Validation failed:', errors);
      return;
    }

    setLoading(true);

    try {
      const itemData = {
        ...formData,
        image_url: capturedImage,
      };

      console.log('📤 Sending item data to service:', itemData);

      const result = await inventoryService.addItem(itemData);
      console.log('📥 Service result:', result);

      if (result.success) {
        Alert.alert(
          'Success',
          'Item added successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('🔙 Navigating back to inventory');
                // Reset all states before navigation
                resetAllStates();
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        console.error('❌ Service error:', result.error);
        Alert.alert('Error', result.error || 'Failed to add item');
      }
    } catch (error) {
      console.error('❌ Save item error:', error);
      Alert.alert('Error', 'Something went wrong while saving the item');
    } finally {
      setLoading(false);
    }
  };

  const resetAllStates = () => {
    setCurrentScreen('imageOptions');
    setCapturedImage(null);
    setFormData({
      title: '',
      description: '',
      item_id: '',
      vendor: '',
      manufacture_date: '',
    });
    setErrors({});
    setProcessingImage(false);
  };

  const handleClose = () => {
    resetAllStates();
    navigation.goBack();
  };

  const toggleCameraType = () => {
    setCameraFacing(current => 
      current === 'back' ? 'front' : 'back'
    );
  };

  // Camera permissions loading screen
  if (!cameraPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading camera permissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Image Options Screen
  if (currentScreen === 'imageOptions') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.screenContainer}>
          <Animated.View 
            style={[
              styles.imageOptionsContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Add Item Photo</Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>
              Choose how you'd like to add a photo for your inventory item
            </Text>

            {processingImage && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.processingText}>Loading...</Text>
              </View>
            )}

            <View style={styles.optionsContainer}>
              <TouchableOpacity 
                style={[styles.optionButton, processingImage && styles.optionButtonDisabled]} 
                onPress={handleTakePhoto}
                disabled={processingImage}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="camera" size={32} color="#2563eb" />
                </View>
                <Text style={styles.optionTitle}>Take Photo</Text>
                <Text style={styles.optionDescription}>Use your camera to capture the item</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.optionButton, processingImage && styles.optionButtonDisabled]} 
                onPress={handleUploadPhoto}
                disabled={processingImage}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="images" size={32} color="#2563eb" />
                </View>
                <Text style={styles.optionTitle}>Upload Photo</Text>
                <Text style={styles.optionDescription}>Choose from your photo gallery</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // Camera Screen
  if (currentScreen === 'camera') {
    return (
      <SafeAreaView style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={cameraFacing}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() => setCurrentScreen('imageOptions')}
              >
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={toggleCameraType}
              >
                <Ionicons name="camera-reverse" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <View style={styles.cameraFooter}>
              <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </SafeAreaView>
    );
  }

  // Confirm Image Screen
  if (currentScreen === 'confirmImage') {
    return (
      <SafeAreaView style={styles.confirmContainer}>
        <View style={styles.confirmHeader}>
          <TouchableOpacity onPress={() => setCurrentScreen('imageOptions')}>
            <Ionicons name="arrow-back" size={24} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.confirmTitle}>Confirm Photo</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.confirmContent}>
          <View style={styles.imagePreviewContainer}>
            {capturedImage ? (
              <Image
                source={{ uri: capturedImage }}
                style={styles.imagePreview}
                onError={(error) => {
                  console.log('⚠️ Image failed to load:', error);
                  Alert.alert('Image Error', 'Unable to load image.');
                }}
                onLoad={() => console.log('✅ Image loaded successfully')}
              />
            ) : (
              <View style={[styles.imagePreview, styles.imagePlaceholder]}>
                <Text style={{ color: '#64748b' }}>No image loaded</Text>
              </View>
            )}
          </View>

          <Text style={styles.confirmText}>
            Does this photo look good? You can retake it or continue with the item details.
          </Text>
        </View>

        <View style={styles.confirmFooter}>
          <View style={styles.confirmButtons}>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={retakePicture}
            >
              <Ionicons name="camera" size={20} color="#64748b" />
              <Text style={styles.retakeButtonText}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={confirmImage}
            >
              <Ionicons name="checkmark" size={20} color="#ffffff" />
              <Text style={styles.confirmButtonText}>Use Photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Item Form Screen
  if (currentScreen === 'itemForm') {
    return (
      <SafeAreaView style={styles.formContainer}>
        <KeyboardAvoidingView 
          style={styles.formKeyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setCurrentScreen('confirmImage')}>
              <Ionicons name="arrow-back" size={24} color="#64748b" />
            </TouchableOpacity>
            <Text style={styles.formTitle}>Add Item Details</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.formScrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.imagePreviewContainer}>
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={styles.formImagePreview} />
              )}
            </View>

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Item Information</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Item Title *</Text>
                <TextInput
                  style={[styles.textInput, errors.title && styles.inputError]}
                  value={formData.title}
                  onChangeText={(text) => {
                    setFormData({ ...formData, title: text });
                    if (errors.title) {
                      setErrors({ ...errors, title: null });
                    }
                  }}
                  placeholder="Enter item title"
                  placeholderTextColor="#94a3b8"
                />
                {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea, errors.description && styles.inputError]}
                  value={formData.description}
                  onChangeText={(text) => {
                    setFormData({ ...formData, description: text });
                    if (errors.description) {
                      setErrors({ ...errors, description: null });
                    }
                  }}
                  placeholder="Enter item description"
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                />
                {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Item ID *</Text>
                <TextInput
                  style={[styles.textInput, errors.item_id && styles.inputError]}
                  value={formData.item_id}
                  onChangeText={(text) => {
                    setFormData({ ...formData, item_id: text });
                    if (errors.item_id) {
                      setErrors({ ...errors, item_id: null });
                    }
                  }}
                  placeholder="Enter unique item ID"
                  placeholderTextColor="#94a3b8"
                />
                {errors.item_id && <Text style={styles.errorText}>{errors.item_id}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Vendor *</Text>
                <TextInput
                  style={[styles.textInput, errors.vendor && styles.inputError]}
                  value={formData.vendor}
                  onChangeText={(text) => {
                    setFormData({ ...formData, vendor: text });
                    if (errors.vendor) {
                      setErrors({ ...errors, vendor: null });
                    }
                  }}
                  placeholder="Enter vendor name"
                  placeholderTextColor="#94a3b8"
                />
                {errors.vendor && <Text style={styles.errorText}>{errors.vendor}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Manufacture Date *</Text>
                <TextInput
                  style={[styles.textInput, errors.manufacture_date && styles.inputError]}
                  value={formData.manufacture_date}
                  onChangeText={(text) => {
                    setFormData({ ...formData, manufacture_date: text });
                    if (errors.manufacture_date) {
                      setErrors({ ...errors, manufacture_date: null });
                    }
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                />
                {errors.manufacture_date && <Text style={styles.errorText}>{errors.manufacture_date}</Text>}
              </View>
            </View>
          </ScrollView>

          <View style={styles.formFooter}>
            <TouchableOpacity 
              style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
              onPress={handleSaveItem}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#ffffff" />
                  <Text style={styles.saveButtonText}>Save Item</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Fallback - shouldn't reach here
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Unknown screen state: {currentScreen}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  screenContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  imageOptionsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 32,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  processingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#64748b',
  },
  optionsContainer: {
    gap: 16,
  },
  optionButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  optionButtonDisabled: {
    opacity: 0.5,
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  cameraButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraFooter: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
  },
  confirmContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  confirmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  confirmContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  imagePreview: {
    width: 250,
    height: 250,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  confirmFooter: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  retakeButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2563eb',
  },
  confirmButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  formKeyboardView: {
    flex: 1,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  formScrollView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  formImagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    marginVertical: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  formFooter: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  saveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#2563eb',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default AddItemScreen;