const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
router.get('/ping', (_req, res) => res.json({ ok: true }));
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'inventory_images';

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

if (!supabase) {
  console.warn('⚠️ Supabase credentials missing. Images will NOT be uploaded.');
}
const upload = multer({ storage: multer.memoryStorage() });
const toBase64 = (buf) => Buffer.from(buf).toString('base64');

const extFromNameOrType = (originalName = '', mime = '') => {
  const fromName = path.extname(originalName || '').toLowerCase();
  if (fromName) return fromName;
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('heic')) return '.heic';
  return '.jpg';
};

const randomId = () => crypto.randomBytes(6).toString('hex');
async function uploadToSupabase(buffer, originalName, mimeType) {
  if (!supabase) return { publicUrl: null };

  const ext = extFromNameOrType(originalName, mimeType);
  const objectPath = `uploads/${Date.now()}-${randomId()}${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(objectPath, buffer, {
      contentType: mimeType || 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error('❌ Supabase upload failed:', uploadError);
    return { publicUrl: null };
  }

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(objectPath);
  return { publicUrl: data?.publicUrl || null };
}

async function extractWithGeminiOrFallback(buffer, hintText = '') {
  try {
    let gpt = null;
    try {
      gpt = await import('../utils/Gemini.js');
    } catch {
          gpt = null;
        }

    if (gpt && typeof gpt.extractItemData === 'function') {
      const base64 = toBase64(buffer);
      const fields = await gpt.extractItemData(base64, hintText);
      return {
        title: fields.title || '',
        description: fields.description || '',
        item_id: fields.item_id || '',
        vendor: fields.vendor || '',
        manufacture_date: fields.manufacture_date || '',
        categories: fields.categories || '',
        subcategories: fields.subcategories || '',
      };
    }
  } catch (err) {
    console.warn('⚠️ Gemini extraction failed, will fallback:', err?.message || err);
  }

  try {
    let parseImageLabel;
    try {
      ({ parseImageLabel } = require('./parse'));
    } catch {
      ({ parseImageLabel } = await import('./parse.js'));
    }

    const result = await parseImageLabel(buffer);
    return {
      title: result.label || 'Uncategorized Item',
      description:
        result.confidence != null ? `Confidence: ${result.confidence}` : '',
      item_id: '',
      vendor: '',
      manufacture_date: '',
      categories: '',
      subcategories: '',
    };
  } catch (err) {
    console.error('❌ Fallback parse failed:', err?.message || err);
    return {
      title: '',
      description: '',
      item_id: '',
      vendor: '',
      manufacture_date: '',
      categories: '',
      subcategories: '',
    };
  }
}
router.post('/', upload.single('image'), async (req, res) => {
  console.log('📩 /api/vision', {
    hasFile: !!req.file,
    contentType: req.headers['content-type'],
  });

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file received' });
    }

    const hint = typeof req.body?.text === 'string' ? req.body.text : '';
    const fields = await extractWithGeminiOrFallback(req.file.buffer, hint);
    const { publicUrl } = await uploadToSupabase(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    return res.json({
      ...fields,
      imageUrl: publicUrl, 
    });
  } catch (err) {
    console.error('❌ Error in /api/vision:', err?.stack || err);
    return res.status(500).json({
      error: 'Failed to process image',
      details: err?.message || String(err),
    });
  }
});
router.post('/batch', upload.array('images'), async (req, res) => {
  console.log('📩 /api/vision/batch', {
    filesCount: req.files?.length || 0,
    contentType: req.headers['content-type'],
  });

  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No files received' });
    }
    const hint = typeof req.body?.text === 'string' ? req.body.text : '';
    const results = await Promise.all(
      files.map(async (file) => {
        const fields = await extractWithGeminiOrFallback(file.buffer, hint);
        const { publicUrl } = await uploadToSupabase(
          file.buffer,
          file.originalname,
          file.mimetype
        );
        return {
          ...fields,
          imageUrl: publicUrl,
        };
      })
    );

    return res.json(results); 
  } catch (err) {
    console.error('❌ Error in /api/vision/batch:', err?.stack || err);
    return res.status(500).json({
      error: 'Failed to process images',
      details: err?.message || String(err),
    });
  }
});

module.exports = router;
