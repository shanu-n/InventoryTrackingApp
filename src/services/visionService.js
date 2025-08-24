import { Platform } from 'react-native';
import { BASE_URL as ENV_BASE_URL } from '@env';

const RESOLVED_BASE_URL =
  (ENV_BASE_URL && ENV_BASE_URL.trim()) ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');


const withTimeout = (ms, promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`request timed out after ${ms}ms`)), ms)
    ),
  ]);


const normalizeItem = (raw = {}) => ({
  title: raw.title || '',
  description: raw.description || '',
  item_id: raw.item_id || '',
  vendor: raw.vendor || '',
  manufacture_date: raw.manufacture_date || '',
  categories: raw.categories || '',
  subcategories: raw.subcategories || '',
  imageUrl: raw.imageUrl || raw.supabaseUrl || raw.localImageUrl || null,
});


const guessMime = (fileName = '') => {
  const lower = String(fileName).toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

/**
 * @param {string} imageUri 
 * @param {string} [optionalText] 
 * @returns {Promise<{
 *  title:string, description:string, item_id:string, vendor:string,
 *  manufacture_date:string, categories:string, subcategories:string, imageUrl:string|null
 * }>}
 */
export const analyzeImage = async (imageUri, optionalText = '') => {
  if (typeof imageUri !== 'string' || !imageUri.trim()) {
    throw new Error(`Expected imageUri to be a non-empty string but got ${typeof imageUri}`);
  }

  try {
    const fileName = imageUri.split('/').pop() || `image_${Date.now()}.jpg`;
    const formData = new FormData();
    formData.append('image', { uri: imageUri, name: fileName, type: guessMime(fileName) });
    if (optionalText) formData.append('text', optionalText);

    const endpoint = `${RESOLVED_BASE_URL}/api/vision`;
   
    const resp = await withTimeout(
      30000,
      fetch(endpoint, { method: 'POST', body: formData })
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Vision API error ${resp.status}: ${errText}`);
    }

    
    const json = await resp.json();
    return normalizeItem(json);
  } catch (err) {
    console.error('❌ analyzeImage failed:', err);
    throw err;
  }
};

/**
 * @param {string[]} imageUris - list of local file:// URIs
 * @param {string} [optionalText] - extra user hint to send to the model
 * @returns {Promise<Array<ReturnType<typeof normalizeItem>>>}
 */
export const analyzeImages = async (imageUris = [], optionalText = '') => {
  if (!Array.isArray(imageUris) || imageUris.length === 0) {
    throw new Error('analyzeImages: imageUris must be a non-empty array of string URIs');
  }
  imageUris.forEach((u, i) => {
    if (typeof u !== 'string' || !u.trim()) {
      throw new Error(`analyzeImages: imageUris[${i}] must be a non-empty string`);
    }
  });

  try {
    const formData = new FormData();
    imageUris.forEach((uri, i) => {
      const fileName = uri.split('/').pop() || `image_${i}.jpg`;
      formData.append('images', { uri, name: fileName, type: guessMime(fileName) });
    });
    if (optionalText) formData.append('text', optionalText);

    const endpoint = `${RESOLVED_BASE_URL}/api/vision/batch`;
    const resp = await withTimeout(
      60000,
      fetch(endpoint, { method: 'POST', body: formData })
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Vision batch API error ${resp.status}: ${errText}`);
    }

    const json = await resp.json();
    const arr = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
    return arr.map(normalizeItem);
  } catch (err) {
    console.error('❌ analyzeImages failed:', err);
    throw err;
  }
};

export default { analyzeImage, analyzeImages };
