import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import inventoryService from '../services/inventoryService';

const EditItemScreen = ({ navigation, route }) => {
  const { item } = route.params; // Get the item to edit from navigation params
  
  const [formData, setFormData] = useState({
    title: '',
    item_id: '',
    vendor: '',
    description: '',
    manufacture_date: '',
    image_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [originalData, setOriginalData] = useState({});

  useEffect(() => {
    // Pre-populate form with existing item data
    if (item) {
      const initialData = {
        title: item.title || '',
        item_id: item.item_id || '',
        vendor: item.vendor || '',
        description: item.description || '',
        manufacture_date: item.manufacture_date || '',
        image_url: item.image_url || '',
      };
      setFormData(initialData);
      setOriginalData(initialData);
    }
  }, [item]);

  // Check if form data has changed
  useEffect(() => {
    const changed = Object.keys(formData).some(key => 
      formData[key] !== originalData[key]
    );
    setHasChanges(changed);
  }, [formData, originalData]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.item_id.trim()) {
      newErrors.item_id = 'Item ID is required';
    } else {
      // Check if item ID contains only valid characters
      const itemIdRegex = /^[A-Za-z0-9\-_]+$/;
      if (!itemIdRegex.test(formData.item_id.trim())) {
        newErrors.item_id = 'Item ID can only contain letters, numbers, hyphens, and underscores';
      }
    }

    if (!formData.vendor.trim()) {
      newErrors.vendor = 'Vendor is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.manufacture_date.trim()) {
      newErrors.manufacture_date = 'Manufacture date is required';
    } else {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(formData.manufacture_date)) {
        newErrors.manufacture_date = 'Date must be in YYYY-MM-DD format';
      } else {
        // Check if date is valid and not in the future
        const manufactureDate = new Date(formData.manufacture_date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        if (isNaN(manufactureDate.getTime())) {
          newErrors.manufacture_date = 'Invalid date';
        } else if (manufactureDate > today) {
          newErrors.manufacture_date = 'Manufacture date cannot be in the future';
        }
      }
    }

    // Validate image URL if provided
    if (formData.image_url && formData.image_url.trim()) {
      try {
        new URL(formData.image_url.trim());
      } catch (e) {
        newErrors.image_url = 'Please enter a valid URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving');
      return;
    }

    setLoading(true);

    try {
      // Prepare the update data with trimmed values
      const updateData = {
        title: formData.title.trim(),
        item_id: formData.item_id.trim(),
        vendor: formData.vendor.trim(),
        description: formData.description.trim(),
        manufacture_date: formData.manufacture_date.trim(),
        image_url: formData.image_url.trim() || item.image_url, // Keep original if empty
      };

      const result = await inventoryService.updateItem(item.id, updateData);
      
      if (result.success) {
        setHasChanges(false);
        Alert.alert(
          'Success',
          'Item updated successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to update item');
      }
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Something went wrong while updating the item');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const handleResetForm = () => {
    Alert.alert(
      'Reset Form',
      'This will restore all fields to their original values. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setFormData(originalData);
            setErrors({});
          }
        }
      ]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Handle back button press
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasChanges) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasChanges]);

  const displayImage = formData.image_url || item?.image_url;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
            <Ionicons name="arrow-back" size={24} color="#64748b" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Edit Item</Text>
            {hasChanges && <View style={styles.changeIndicator} />}
          </View>
          <TouchableOpacity 
            style={[
              styles.saveButton, 
              loading && styles.saveButtonDisabled,
              !hasChanges && styles.saveButtonDisabled
            ]} 
            onPress={handleSave}
            disabled={loading || !hasChanges}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image Preview */}
          {displayImage ? (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: displayImage }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay}>
                <Text style={styles.imageOverlayText}>
                  {formData.image_url && formData.image_url !== item?.image_url 
                    ? 'New Image Preview' 
                    : 'Current Image'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={[styles.input, errors.title && styles.inputError]}
                value={formData.title}
                onChangeText={(text) => handleInputChange('title', text)}
                placeholder="Enter item title"
                placeholderTextColor="#94a3b8"
              />
              {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
            </View>

            {/* Item ID */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Item ID *</Text>
              <TextInput
                style={[styles.input, errors.item_id && styles.inputError]}
                value={formData.item_id}
                onChangeText={(text) => handleInputChange('item_id', text)}
                placeholder="Enter unique item ID"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
              {errors.item_id && <Text style={styles.errorText}>{errors.item_id}</Text>}
              <Text style={styles.helperText}>
                Only letters, numbers, hyphens, and underscores allowed
              </Text>
            </View>

            {/* Vendor */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Vendor *</Text>
              <TextInput
                style={[styles.input, errors.vendor && styles.inputError]}
                value={formData.vendor}
                onChangeText={(text) => handleInputChange('vendor', text)}
                placeholder="Enter vendor name"
                placeholderTextColor="#94a3b8"
              />
              {errors.vendor && <Text style={styles.errorText}>{errors.vendor}</Text>}
            </View>

            {/* Manufacture Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Manufacture Date *</Text>
              <TextInput
                style={[styles.input, errors.manufacture_date && styles.inputError]}
                value={formData.manufacture_date}
                onChangeText={(text) => handleInputChange('manufacture_date', text)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
              {errors.manufacture_date && <Text style={styles.errorText}>{errors.manufacture_date}</Text>}
              <Text style={styles.helperText}>
                Original: {formatDate(item?.manufacture_date)}
              </Text>
            </View>

            {/* Image URL */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Image URL</Text>
              <TextInput
                style={[styles.input, styles.textArea, errors.image_url && styles.inputError]}
                value={formData.image_url}
                onChangeText={(text) => handleInputChange('image_url', text)}
                placeholder="Enter image URL (optional)"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.image_url && <Text style={styles.errorText}>{errors.image_url}</Text>}
              <Text style={styles.helperText}>
                Leave empty to keep current image
              </Text>
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[
                  styles.input, 
                  styles.textAreaLarge, 
                  errors.description && styles.inputError
                ]}
                value={formData.description}
                onChangeText={(text) => handleInputChange('description', text)}
                placeholder="Enter item description"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.resetButton} 
              onPress={handleResetForm}
              disabled={loading || !hasChanges}
            >
              <Ionicons name="refresh" size={20} color={hasChanges ? "#6b7280" : "#d1d5db"} />
              <Text style={[styles.resetButtonText, !hasChanges && styles.disabledText]}>
                Reset
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={handleCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.updateButton, 
                loading && styles.updateButtonDisabled,
                !hasChanges && styles.updateButtonDisabled
              ]} 
              onPress={handleSave}
              disabled={loading || !hasChanges}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#ffffff" />
                  <Text style={styles.updateButtonText}>Update</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  changeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  imagePreviewContainer: {
    position: 'relative',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#f1f5f9',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
  },
  imageOverlayText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  formContainer: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  textAreaLarge: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  helperText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  resetButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  updateButton: {
    flex: 1.5,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  updateButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledText: {
    color: '#d1d5db',
  },
});

export default EditItemScreen;