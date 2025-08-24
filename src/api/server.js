const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION', err);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('💥 UNHANDLED REJECTION', reason);
});
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (_req, res) => res.send('Inventory App Backend is running 🚀'));

app.use('/api/vision', require('./vision/index'));

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on http://0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
  console.error('💥 HTTP server error', err);
});
