// src/api/vision/index.js
const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const router = express.Router();

// ----- Supabase Setup -----
// ✅ Use backend env vars, NOT EXPO_PUBLIC
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = process.env.SUPABASE_BUCKET || 'inventory_images';

// ----- Multer: memory storage only -----
const upload = multer({ storage: multer.memoryStorage() });

// ----- Routes -----
router.post('/', upload.single('image'), async (req, res) => {
  console.log('📩 /api/vision hit', {
    hasFile: !!req.file,
    contentType: req.headers['content-type'],
  });

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file received' });
    }

    // Parse image
    let parseImageLabel;
    try {
      ({ parseImageLabel } = require('./parse'));
    } catch {
      ({ parseImageLabel } = await import('./parse.js'));
    }

    const parsed = await parseImageLabel(req.file.buffer);

    // Upload to Supabase
    const ext = path.extname(req.file.originalname) || '.jpg';
    const supabasePath = `uploads/${Date.now()}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(supabasePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Supabase upload failed:', uploadError);
      return res.status(500).json({ error: 'Supabase upload failed', details: uploadError.message });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(supabasePath);

    const supabaseUrl = publicUrlData?.publicUrl;

    // ✅ Return parsed labels and Supabase URL
    return res.json({
      ...parsed,
      imageUrl: supabaseUrl,
    });
  } catch (err) {
    console.error('❌ Error in /api/vision:', err.stack || err);
    return res.status(500).json({
      error: 'Failed to process image',
      details: err.message,
    });
  }
});

module.exports = router;
