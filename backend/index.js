const express = require('express');
const supabase = require('./supabaseClient');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const app = express();

app.use(express.json());

// GET all items
app.get('/items', async (req, res) => {
  const { data, error } = await supabase.from('inventory_items').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST new item with image upload
app.post('/items', async (req, res) => {
  try {
    const { item_id, title, description, vendor, manufacture_date } = req.body;

    console.log('Received body:', req.body);

    const { data, error } = await supabase
      .from('inventory_items')
      .insert([
        {
          item_id,
          title,
          description,
          vendor,
          manufacture_date,
          image_url: null,
        },
      ])
      .select(); // <-- add this to get inserted rows back

    console.log('Insert result:', { data, error });

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Error in POST /items:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
