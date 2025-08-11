// src/api/vision/index.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Simple ping for reachability checks
router.get('/ping', (_req, res) => res.json({ ok: true }));

// Ensure uploads dir exists
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Save uploads with timestamp + original extension
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

router.post('/', upload.single('image'), async (req, res) => {
  console.log('📩 /api/vision hit', {
    hasFile: !!req.file,
    contentType: req.headers['content-type'],
  });

  try {
    if (!req.file) return res.status(400).json({ error: 'No file received' });

    // Support your ESM parse.js by attempting CJS first, then ESM dynamic import
    let parseImageLabel;
    try {
      ({ parseImageLabel } = require('./parse'));
    } catch {
      ({ parseImageLabel } = await import('./parse.js'));
    }

    const parsed = await parseImageLabel(req.file.path);

    const baseUrl =
      process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 8000}`;
    const imageUrl = `${baseUrl}/uploads/${path.basename(req.file.path)}`;

    return res.json({ ...parsed, imageUrl });
  } catch (err) {
    console.error('❌ Error in /api/vision:', err);
    return res.status(500).json({ error: 'Failed to extract text from image' });
  }
});

module.exports = router;
