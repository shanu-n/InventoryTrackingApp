import { BASE_URL } from '@env';

export const analyzeImage = async (imageUri, optionalText = '') => {
  try {
    // Step 1: Convert local image URI to Blob
    const response = await fetch(imageUri);
    const imageBlob = await response.blob();

    // Step 2: Prepare multipart/form-data
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      name: 'photo.jpg',
      type: imageBlob.type || 'image/jpeg',
    });

    // Step 3: Make the API call to your backend
    const apiResponse = await fetch(`${BASE_URL}/api/vision`, {
      method: 'POST',
      body: formData,
    });

    // Step 4: Parse and return JSON
    if (!apiResponse.ok) {
      throw new Error(`Server error: ${apiResponse.status}`);
    }

    const result = await apiResponse.json();
    return result;
  } catch (error) {
    console.error('❌ Error calling analyzeImage:', error);
    throw error;
  }
};
