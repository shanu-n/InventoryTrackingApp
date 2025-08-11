import { Buffer } from 'buffer';
import { extractItemData } from '../utils/Gemini.js';
import fs from 'fs';

/**
 * POST /api/vision/parse
 * Handles image upload and optional text input,
 * uses GPT-4o Vision to extract item details.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  console.log('✅ parse.js handler called');
  try {
    const { imageBase64, text } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const itemData = await extractItemData(imageBase64, text || '');
    return res.status(200).json(itemData);
  } catch (error) {
    console.error('Error parsing image with GPT:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function parseImageLabel(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const result = await extractItemData(base64Image, '');
    return result;
  } catch (err) {
    console.error('❌ parseImageLabel error:', err); // ✅ full log
    throw err;
  }
}
