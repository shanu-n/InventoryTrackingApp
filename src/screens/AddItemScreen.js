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
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { analyzeImage, analyzeImages } from '../services/visionService';
import inventoryService from '../services/inventoryService';
import { listCategories, listSubcategories } from '../services/inventoryService';


const isYMD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());
function mergeExtractedResults(results = []) {
  const out = {
    title: '',
    description: '',
    item_id: '',
    vendor: '',
    manufacture_date: '',
    categories: '',
    subcategories: '',
    imageUrl: null,
  };
  const vendorCounts = {};
  const catSet = new Set();
  const subcatSet = new Set();
  for (const r of results) {
    if (!out.item_id && r?.item_id) out.item_id = String(r.item_id).trim();
    if ((r?.title || '').length > (out.title || '').length) out.title = r.title || '';
    if ((r?.description || '').length > (out.description || '').length)
      out.description = r.description || '';
    if (r?.vendor) 
    {
      const v = String(r.vendor).trim();
      vendorCounts[v] = (vendorCounts[v] || 0) + 1;
      if (!out.vendor) out.vendor = v;
    }
    if (!out.manufacture_date && isYMD(r?.manufacture_date)) {
      out.manufacture_date = r.manufacture_date;
    }
    if (!out.imageUrl && r?.imageUrl) out.imageUrl = r.imageUrl;
    const cats = (r?.categories || '').split(',').map((x) => x.trim()).filter(Boolean);
    cats.forEach((c) => catSet.add(c));
    const subs = (r?.subcategories || '').split(',').map((x) => x.trim()).filter(Boolean);
    subs.forEach((s) => subcatSet.add(s));
  }
  if (Object.keys(vendorCounts).length) 
  {
    out.vendor = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0][0];
  }
  out.categories = Array.from(catSet).join(', ');
  out.subcategories = Array.from(subcatSet).join(', ');
  return out;
}

const AddItemScreen = () => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [currentStep, setCurrentStep] = useState('photo');
  const [capturedImage, setCapturedImage] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    item_id: '',
    vendor: '',
    manufacture_date: '',
    categories: '',    
    subcategories: '', 
    imageUrl: null,
  });

  const [categories, setCategories] = useState([]);
  const [subcats, setSubcats] = useState([]);
  const [catId, setCatId] = useState(null);
  const [catName, setCatName] = useState('');
  const [subId, setSubId] = useState(null);
  const [subName, setSubName] = useState('');
  const [showCatModal, setShowCatModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);

  // load categories once
  useEffect(() => {
    (async () => {
      try {
        const data = await listCategories();
        setCategories(data);
      } catch (e) {
        console.warn('listCategories error:', e.message);
      }
    })();
  }, []);

  // when a category is chosen, load its subcategories
  const chooseCategory = async (c) => {
    setCatId(c.id);
    setCatName(c.name);
    setShowCatModal(false);

    // reset previous subcategory choice
    setSubId(null);
    setSubName('');
    try {
      const subs = await listSubcategories(c.id);
      setSubcats(subs);
    } catch (e) {
      console.warn('listSubcategories error:', e.message);
      setSubcats([]);
    }
  };

  const chooseSubcat = (s) => {
    setSubId(s.id);
    setSubName(s.name);
    setShowSubModal(false);
  };


  const openCamera = async () => {
    const { status } = await requestCameraPermission();
    if (status === 'granted') setCurrentStep('camera');
    else Alert.alert('Camera permission is required');
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ base64: false });
    const uri = photo?.uri || null;
    if (!uri) return;
    setSelectedImages((prev) => [...prev, uri]);
    setCapturedImage(uri);
  };

  const pickImageFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 0.8,
    });
    if (result.canceled) return;
    const uris = (result.assets || []).map((a) => a?.uri).filter(Boolean);
    if (!uris.length) return;
    setSelectedImages(uris);
    setCapturedImage(uris[0]);
    setCurrentStep('preview');
  };

  const handleExtract = async () => {
    const batch = selectedImages.length
      ? selectedImages
      : capturedImage
      ? [capturedImage]
      : [];

    if (!batch.length) {
      Alert.alert('No image selected');
      return;
    }

    try {
      setLoading(true);
      setUploadProgress(batch.length > 1 ? 'Analyzing images...' : 'Analyzing image...');

      if (batch.length === 1) {
        const data = await analyzeImage(batch[0]);
        setFormData((prev) => ({
          ...prev,
          title: data.title || '',
          description: data.description || '',
          item_id: data.item_id || '',
          vendor: data.vendor || '',
          manufacture_date: data.manufacture_date || '',
          categories: data.categories || '',
          subcategories: data.subcategories || '',
          imageUrl: data.imageUrl || prev.imageUrl,
        }));
      } else {
        const results = await analyzeImages(batch);
        const merged = mergeExtractedResults(results);
        setFormData((prev) => ({
          ...prev,
          ...merged,
          imageUrl: merged.imageUrl || prev.imageUrl,
        }));
      }

      // The user will still pick actual category/subcategory from our pickers below.
      setCurrentStep('form');
    } catch (err) {
      console.error('extract error', err);
      Alert.alert('Error', 'Failed to extract data from the image(s).');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setUploadProgress('Saving item...');

      const result = await inventoryService.addItem({
        title: formData.title,
        description: formData.description,
        item_id: formData.item_id,
        vendor: formData.vendor,
        manufacture_date: formData.manufacture_date,
        // legacy strings: prefer picker names if chosen,
        // otherwise fall back to extracted strings in formData
        categories: catName || formData.categories || '',
        subcategories: subName || formData.subcategories || '',
        category_id: catId || null,
        subcategory_id: subId || null,

        imageUrl: formData.imageUrl,
      });

      if (result.success) {
        Alert.alert('Success', 'Item added successfully!');
        setCapturedImage(null);
        setSelectedImages([]);
        setFormData({
          title: '',
          description: '',
          item_id: '',
          vendor: '',
          manufacture_date: '',
          categories: '',
          subcategories: '',
          imageUrl: null,
        });
        setCatId(null);
        setCatName('');
        setSubId(null);
        setSubName('');
        setCurrentStep('photo');
      } else {
        Alert.alert('Error', result.error || 'Failed to add item');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to add item');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const handleRetakePhoto = () => {
    setCapturedImage(null);
    setSelectedImages([]);
    setFormData((p) => ({ ...p, imageUrl: null }));
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
                  <TouchableOpacity onPress={() => setCurrentStep('photo')} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                  </TouchableOpacity>

                  {/* capture adds to the list; user taps Done to continue */}
                  <TouchableOpacity onPress={takePicture} style={styles.captureButton}>
                    <Ionicons name="camera" size={32} color="#fff" />
                  </TouchableOpacity>

                  <View style={{ alignItems: 'center', marginTop: 12 }}>
                    <Text style={{ color: '#fff' }}>{selectedImages.length} selected</Text>
                    <TouchableOpacity
                      onPress={() => setCurrentStep('preview')}
                      style={[styles.captureButton, { backgroundColor: '#10B981', marginTop: 8 }]}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600' }}>Done</Text>
                    </TouchableOpacity>
                  </View>
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
                  <Text style={styles.cardTitle}>Upload Photo(s)</Text>
                  <Text style={styles.cardText}>Choose from your photo gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : currentStep === 'preview' ? (
            <>
              <Text style={styles.heading}>Step 2: Preview & Extract</Text>

              {/* grid preview when multi-selected */}
              {selectedImages.length > 1 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                  {selectedImages.map((uri) => (
                    <Image key={uri} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 10 }} />
                  ))}
                </View>
              ) : (
                <View style={styles.imagePreview}>
                  {capturedImage ? (
                    <Image source={{ uri: capturedImage }} style={styles.image} />
                  ) : (
                    <Text>No image selected</Text>
                  )}
                </View>
              )}

              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={handleRetakePhoto} style={styles.retakeButton}>
                  <Ionicons name="camera-reverse" size={20} color="#6B7280" />
                  <Text style={styles.retakeButtonText}>Retake</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleExtract} style={styles.extractButton}>
                  <Ionicons name="scan" size={20} color="#fff" />
                  <Text style={styles.buttonText}>
                    {selectedImages.length > 1 ? 'Extract All' : 'Extract Details'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : currentStep === 'form' ? (
            <>
              <Text style={styles.heading}>Add Item Details</Text>

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

              {/* Category Picker */}
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity style={styles.select} onPress={() => setShowCatModal(true)}>
                <Text style={styles.selectText}>{catName || 'Select category'}</Text>
              </TouchableOpacity>

              {/* Subcategory Picker */}
              <Text style={styles.label}>Subcategory</Text>
              <TouchableOpacity
                style={[styles.select, !catId && { opacity: 0.5 }]}
                disabled={!catId}
                onPress={() => setShowSubModal(true)}
              >
                <Text style={styles.selectText}>
                  {subName || (catId ? 'Select subcategory' : 'Select a category first')}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>Manufacture Date *</Text>
              <TextInput
                style={styles.input}
                value={formData.manufacture_date}
                onChangeText={(text) => setFormData({ ...formData, manufacture_date: text })}
                placeholder="YYYY-MM-DD"
                editable={!loading}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={handleRetakePhoto} style={styles.secondaryButton} disabled={loading}>
                  <Ionicons name="camera-reverse" size={20} color="#6B7280" />
                  <Text style={styles.secondaryButtonText}>Change Photo(s)</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleSubmit} style={[styles.submitButton, loading && styles.disabledButton]} disabled={loading}>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Save Item</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {/* Category Modal */}
          <Modal
            transparent
            animationType="slide"
            visible={showCatModal}
            onRequestClose={() => setShowCatModal(false)}
          >
            <View style={m.modalBackdrop}>
              <View style={m.modalCardTall}>
                <Text style={m.modalTitle}>Select Category</Text>

                <FlatList
                  data={categories}
                  keyExtractor={(i) => i.id}
                  ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={m.optionRow} onPress={() => chooseCategory(item)}>
                      <Text style={m.optionTitle}>{item.name}</Text>
                      {item.description ? <Text style={m.optionDesc}>{item.description}</Text> : null}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={{ color: '#6b7280', marginTop: 8 }}>No categories found.</Text>}
                />

                <TouchableOpacity style={[m.modalBtn, { backgroundColor: '#e5e7eb' }]} onPress={() => setShowCatModal(false)}>
                  <Text style={[m.modalBtnText, { color: '#111827' }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Subcategory Modal */}
          <Modal
            transparent
            animationType="slide"
            visible={showSubModal}
            onRequestClose={() => setShowSubModal(false)}
          >
            <View style={m.modalBackdrop}>
              <View style={m.modalCardTall}>
                <Text style={m.modalTitle}>Select Subcategory</Text>
                {catName ? <Text style={m.modalHint}>Under: {catName}</Text> : null}

                <FlatList
                  data={subcats}
                  keyExtractor={(i) => i.id}
                  ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={m.optionRow} onPress={() => chooseSubcat(item)}>
                      <Text style={m.optionTitle}>{item.name}</Text>
                      {item.description ? <Text style={m.optionDesc}>{item.description}</Text> : null}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={{ color: '#6b7280', marginTop: 8 }}>
                      {catId ? 'No subcategories yet.' : 'Pick a category first.'}
                    </Text>
                  }
                />

                <TouchableOpacity style={[m.modalBtn, { backgroundColor: '#e5e7eb' }]} onPress={() => setShowSubModal(false)}>
                  <Text style={[m.modalBtnText, { color: '#111827' }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddItemScreen;


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20 },
  heading: { fontSize: 22, fontWeight: '600', marginBottom: 15, textAlign: 'center', color: '#111827' },
  cameraContainer: { flex: 1, minHeight: 500 },
  camera: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
  backButton: { alignSelf: 'flex-start', padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25 },
  captureButton: { alignSelf: 'center', padding: 15, backgroundColor: '#111827', borderRadius: 40 },
  imagePreview: { alignItems: 'center', justifyContent: 'center', height: 250, borderWidth: 2, borderColor: '#E5E7EB', marginBottom: 20, borderRadius: 12, backgroundColor: '#fff' },
  image: { width: '100%', height: '100%', borderRadius: 10 },
  previewImage: { width: 150, height: 150, borderRadius: 12, alignSelf: 'center', marginBottom: 20, borderWidth: 2, borderColor: '#E5E7EB' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 12 },
  extractButton: { flexDirection: 'row', backgroundColor: '#10B981', padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flex: 1 },
  retakeButton: { flexDirection: 'row', backgroundColor: '#F3F4F6', padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flex: 1, borderWidth: 1, borderColor: '#D1D5DB' },
  retakeButtonText: { color: '#6B7280', fontWeight: '600', marginLeft: 8 },
  secondaryButton: { flexDirection: 'row', backgroundColor: '#F3F4F6', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flex: 1, borderWidth: 1, borderColor: '#D1D5DB' },
  secondaryButtonText: { color: '#6B7280', fontWeight: '600', marginLeft: 8 },
  submitButton: { flexDirection: 'row', backgroundColor: '#2563EB', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flex: 1 },
  disabledButton: { backgroundColor: '#9CA3AF' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  label: { fontWeight: '600', marginBottom: 6, marginTop: 12, color: '#111827' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', padding: 12, borderRadius: 10, marginBottom: 8, backgroundColor: '#fff', fontSize: 14 },
  textArea: { height: 80, textAlignVertical: 'top' },
  loadingContainer: { alignItems: 'center', marginBottom: 20, padding: 20, backgroundColor: '#F3F4F6', borderRadius: 12 },
  loadingText: { marginTop: 10, color: '#6B7280', fontWeight: '500' },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8, color: '#111827' },
  modalSubtitle: { fontSize: 14, textAlign: 'center', color: '#6B7280', marginBottom: 24 },
  cardContainer: { gap: 16 },
  card: { backgroundColor: '#F1F5F9', padding: 24, borderRadius: 16, alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginTop: 12, color: '#1E3A8A' },
  cardText: { fontSize: 13, textAlign: 'center', color: '#6B7280', marginTop: 4 },

  // Picker "select" fields
  select: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  selectText: { color: '#111827' },
});

// separate style sheet for the selection modals
const m = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCardTall: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalHint: { color: '#6b7280', marginTop: 4, marginBottom: 8 },
  optionRow: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
  },
  optionTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  optionDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  modalBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: { fontWeight: '700' },
});
