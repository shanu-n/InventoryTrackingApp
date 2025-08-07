const express = require('express');
const visionRoutes = require('./vision/index'); // ✅ vision routes
const cors = require('cors');
require('dotenv').config(); // ✅ .env

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

// ✅ Mount the vision API
app.use('/api/vision', visionRoutes);

// Default route
app.get('/', (req, res) => {
  res.send('Inventory App Backend is running 🚀');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on http://0.0.0.0:${PORT}`);
});
