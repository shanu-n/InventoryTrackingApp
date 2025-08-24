const { extractItemData } = require('../utils/Gemini');

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {string} optionalText
 */
async function parseImageLabel(buffer, mimeType = 'image/jpeg', optionalText = '') {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid image buffer');
  }

  const base64 = buffer.toString('base64');

  let out = {};
  try {
    out = await extractItemData(base64, optionalText);
  } catch (e) {
    console.warn('Gemini parse failed, returning empty fields:', e.message);
    out = {};
  }
  return {
    item_id: out.item_id || '',
    title: out.title || '',
    description: out.description || '',
    vendor: out.vendor || '',
    manufacture_date: out.manufacture_date || '',
    categories: out.categories || '',
    subcategories: out.subcategories || '',
  };
}

module.exports = { parseImageLabel };
