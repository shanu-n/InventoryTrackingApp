// src/api/vision/index.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ----- Helpers -----
const getBaseUrl = (req) => {
  // If you set PUBLIC_BASE_URL, we respect it (e.g., http://192.168.x.x:8000)
  const fromEnv = process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim();
  if (fromEnv) return fromEnv;

  // Otherwise build from the incoming request (works for simulator or phone)
  const host = req.headers['x-forwarded-host'] || req.headers.host; // e.g., 192.168.x.x:8000
  const protoHeader = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const proto = String(protoHeader).split(',')[0]; // handle "http,https"
  return `${proto}://${host}`;
};

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

// ----- Routes -----
router.post('/', upload.single('image'), async (req, res) => {
  console.log('📩 /api/vision hit', {
    hasFile: !!req.file,
    contentType: req.headers['content-type'],
  });

  try {
    if (!req.file) return res.status(400).json({ error: 'No file received' });

    // Support ESM parse.js by trying CJS first, then ESM dynamic import
    let parseImageLabel;
    try {
      ({ parseImageLabel } = require('./parse'));
    } catch {
      ({ parseImageLabel } = await import('./parse.js'));
    }

    const parsed = await parseImageLabel(req.file.path);

    // ✅ Build a device-friendly public URL
    const baseUrl = getBaseUrl(req);
    const imageUrl = `${baseUrl}/uploads/${path.basename(req.file.path)}`;

    return res.json({ ...parsed, imageUrl });
  } catch (err) {
    console.error('❌ Error in /api/vision:', err);
    return res.status(500).json({ error: 'Failed to extract text from image' });
  }
});

module.exports = router;
