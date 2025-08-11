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

export const analyzeImage = async (imageUri, optionalText = '') => {
  try {
    const fileName = imageUri.split('/').pop() || 'photo.jpg';
    const lower = fileName.toLowerCase();
    const fileType =
      lower.endsWith('.png') ? 'image/png' :
      lower.endsWith('.heic') ? 'image/heic' :
      'image/jpeg';

    const formData = new FormData();
    formData.append('image', { uri: imageUri, name: fileName, type: fileType });
    if (optionalText) formData.append('text', optionalText);

    // ✅ correct endpoint
    const endpoint = `${RESOLVED_BASE_URL}/api/vision`;
    console.log('POST →', endpoint, { RESOLVED_BASE_URL, fileName, fileType });

    // Do NOT set Content-Type; RN sets multipart boundary automatically
    const resp = await withTimeout(20000, fetch(endpoint, { method: 'POST', body: formData }));

    if (!resp.ok) throw new Error(`Server error: ${resp.status}`);

    return await resp.json(); // { title, item_id, description, vendor, manufacture_date, imageUrl }
  } catch (err) {
    console.error('❌ Error calling analyzeImage:', err);
    throw err;
  }
};
