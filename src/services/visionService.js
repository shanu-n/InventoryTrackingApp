// src/services/visionService.js
import { Platform } from 'react-native';
import { BASE_URL as ENV_BASE_URL } from '@env';

// Prefer explicit .env; otherwise fall back to sane defaults per platform
const RESOLVED_BASE_URL =
  (ENV_BASE_URL && ENV_BASE_URL.trim()) ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

// Timeout helper
const withTimeout = (ms, promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`analyzeImage timed out after ${ms}ms`)), ms)
    ),
  ]);

/**
 * Analyze an image and extract inventory item data
 * @param {string} imageUri - Local file URI from camera/gallery
 * @param {string} [optionalText] - Extra text (notes, labels, etc.)
 * @returns {Promise<Object>} - Parsed item data with hosted image URL
 */
export const analyzeImage = async (imageUri, optionalText = '') => {
  try {
    console.log('🔍 Analyzing image:', imageUri);

    const fileName = imageUri.split('/').pop() || `image_${Date.now()}.jpg`;
    const lower = fileName.toLowerCase();
    const fileType =
      lower.endsWith('.png') ? 'image/png' :
      lower.endsWith('.heic') ? 'image/heic' :
      'image/jpeg';

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('image', { uri: imageUri, name: fileName, type: fileType });
    if (optionalText) formData.append('text', optionalText);

    const endpoint = `${RESOLVED_BASE_URL}/api/vision`;
    console.log('📤 Uploading to vision API:', endpoint);

    // Let RN set Content-Type boundary
    const resp = await withTimeout(
      20000,
      fetch(endpoint, { method: 'POST', body: formData })
    );

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('❌ Vision API error:', resp.status, errorText);
      throw new Error(`Vision API error: ${resp.status}`);
    }

    const result = await resp.json();
    console.log('✅ Vision API response:', result);

    // Normalize returned object
    return {
      title: result.title || '',
      description: result.description || '',
      item_id: result.item_id || '',
      vendor: result.vendor || '',
      manufacture_date: result.manufacture_date || '',
      imageUrl: result.supabaseUrl || result.localImageUrl || result.imageUrl || null,
    };
  } catch (err) {
    console.error('❌ Error in analyzeImage:', err);
    throw err;
  }
};

export default { analyzeImage };

