
'use strict';

require('dotenv').config();


async function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY (or GOOGLE_API_KEY) is not set');
  }
  const { GoogleGenerativeAI } = await import('@google/generative-ai'); 
  return new GoogleGenerativeAI(apiKey);
}


function normalizeFields(obj = {}) {
  return {
    item_id: obj.item_id || '',
    title: obj.title || '',
    description: obj.description || '',
    vendor: obj.vendor || '',
    manufacture_date: obj.manufacture_date || '',
    categories: obj.categories || '',
    subcategories: obj.subcategories || '',
  };
}

/**
 * @param {string} base64Image 
 * @param {string} [optionalText] 
 * @returns {Promise<object>} 
 */
async function extractItemData(base64Image, optionalText = '') {
  if (!base64Image || typeof base64Image !== 'string') {
    throw new Error('extractItemData: base64Image must be a base64 string');
  }

  const genAI = await getGenAI();
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `
You are a vision parser. Read the product label image and return ONLY valid JSON.
Required keys: item_id, title, description, vendor, manufacture_date, categories, subcategories.
- manufacture_date must be YYYY-MM-DD if present; else "".
- If a field is missing, return "" for that field.
- No extra keys. No explanations. Only JSON.
`.trim();

  const generationConfig = {
    temperature: 0,
    maxOutputTokens: 512,
    responseMimeType: 'application/json',
  };

  const request = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: optionalText ? `${prompt}\nUser note: ${optionalText}` : prompt,
          },
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg',
            },
          },
        ],
      },
    ],
    generationConfig,
  };

  const result = await model.generateContent(request);
  const rawText =
    (result && result.response && typeof result.response.text === 'function'
      ? result.response.text()
      : '') || '';

  let parsed = {};
  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    const m = rawText.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : {};
  }
  return normalizeFields(parsed);
}
module.exports = { extractItemData };
