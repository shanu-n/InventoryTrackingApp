// gptClient.js  (Gemini version)
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Extract structured product fields from an image using Gemini.
 * Returns JSON with: item_id, title, description, vendor, manufacture_date (YYYY-MM-DD).
 *
 * @param {string} base64Image - Base64-encoded image (no data: prefix)
 * @param {string} optionalText - Optional user hint
 */
export async function extractItemData(base64Image, optionalText = '') {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Fast & inexpensive; upgrade to "gemini-1.5-pro" if you need heavier reasoning.
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are a vision parser. Look at the product label image and return ONLY valid JSON.
Required keys: item_id, title, description, vendor, manufacture_date.
- manufacture_date must be YYYY-MM-DD if present; else empty string.
- If a field is missing on the label, return an empty string for that field.
- No extra keys. No explanations. Only JSON.
`;

    const generationConfig = {
      temperature: 0.2,
      maxOutputTokens: 512,
      // Ask Gemini to emit pure JSON (no prose, no code fences).
      responseMimeType: 'application/json',
    };

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: optionalText ? `${prompt}\nUser note: ${optionalText}` : prompt },
            {
              inlineData: {
                data: base64Image,
                // If your source is PNG sometimes, switch at runtime based on file ext/MIME.
                mimeType: 'image/jpeg',
              },
            },
          ],
        },
      ],
      generationConfig,
    });

    const text = result.response?.text?.() ?? '';
    // Gemini should return valid JSON because of responseMimeType.
    // Still, guard with a tiny fallback.
    try {
      return JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      return { raw: text };
    }
  } catch (err) {
    console.error('❌ Gemini API error:', err);
    throw err;
  }
}
