const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseImageLabel } = require('./parse');


const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// POST /api/vision
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const imagePath = path.resolve(req.file.path);
    console.log('📥 Image received at:', imagePath); // ✅ add this

    const result = await parseImageLabel(imagePath);
    console.log('✅ GPT Result:', result); // ✅ log result

    // Cleanup uploaded file
    fs.unlinkSync(imagePath);

    res.json(result);
  } catch (error) {
    console.error('❌ Error in vision route:', error); // ✅ log full error
    res.status(500).json({ error: 'Failed to extract text from image' });
  }
});


module.exports = router;
