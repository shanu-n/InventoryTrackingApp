// src/api/vision/parse.js

/**
 * Dummy parser for now.
 * It receives an image buffer (from multer) and returns a fake label.
 * Replace this later with real ML / OCR / Vision API logic.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{ label: string, confidence: number }>}
 */
async function parseImageLabel(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid image buffer');
  }

  // For now, just return a mock response
  return {
    label: "Uncategorized Item",
    confidence: 0.5,
  };
}

module.exports = { parseImageLabel };
