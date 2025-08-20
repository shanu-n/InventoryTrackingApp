// src/api/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// --- Crash diagnostics ---
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION', err);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('💥 UNHANDLED REJECTION', reason);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/', (_req, res) => res.send('Inventory App Backend is running 🚀'));

// ✅ Mount the vision routes
app.use('/api/vision', require('./vision/index'));

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Start
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on http://0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
  console.error('💥 HTTP server error', err);
});
