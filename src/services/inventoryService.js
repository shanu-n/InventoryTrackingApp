import { createClient } from '@supabase/supabase-js';

// Supabase client (current setup)
const supabaseUrl = 'https://vhdnqoljgyejwksoncqs.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZG5xb2xqZ3llandrc29uY3FzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg1MDk3OSwiZXhwIjoyMDcxNDI2OTc5fQ.N0_nw4a5NV1hXiuOxU54DIs3sEBy9TgR70r3MPxgvqc';

const supabase = createClient(supabaseUrl, supabaseKey);
class InventoryService {
  constructor() {
    /** @private */
    this.userId = 'default_user'; 
  }

  setUserId(id) {
    this.userId = id || 'default_user';
  }

  _assertUser() {
    if (!this.userId) throw new Error('User not set');
  }

  _assertDate(yyyyMmDd) {
    const rx = /^\d{4}-\d{2}-\d{2}$/;
    if (!rx.test(yyyyMmDd)) throw new Error('Manufacture date must be in YYYY-MM-DD format');

    const d = new Date(yyyyMmDd);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid manufacture date');

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (d > endOfToday) throw new Error('Manufacture date cannot be in the future');
  }

  _isLocalUri(url) {
    if (!url) return false;
    return url.startsWith('file://') || url.startsWith('content://') || url.startsWith('ph://');
  }

  _isSupabaseUrl(url) {
    if (!url) return false;
    return url.includes('supabase.co') || url.includes(supabaseUrl);
  }

  async uploadImage(fileInput, fileName) {
    try {
      this._assertUser();

      let uri, name, type;

      if (typeof fileInput === 'string') {
        uri = fileInput;
        name = fileName || `file_${Date.now()}.jpg`;
        type = `image/jpeg`;
      } else if (fileInput?.uri) {
        uri = fileInput.uri;
        name = fileInput.name || `file_${Date.now()}.jpg`;
        type = fileInput.type || 'image/jpeg';
      } else {
        throw new Error('Invalid file input');
      }

      const uniqueFileName = `${this.userId}/${Date.now()}_${name}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('inventory_images')
        .upload(uniqueFileName, blob, {
          cacheControl: '3600',
          contentType: type,
          upsert: false,
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('inventory_images')
        .getPublicUrl(data.path);

      return {
        success: true,
        publicUrl: publicUrlData.publicUrl,
        path: data.path,
      };
    } catch (err) {
      console.error('uploadImage error:', err);
      return { success: false, error: err.message || 'Failed to upload image' };
    }
  }

  async deleteImage(imagePath) {
    try {
      if (!imagePath) return { success: true };

      const { error } = await supabase.storage.from('inventory_images').remove([imagePath]);
      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('deleteImage error:', error);
      return { success: false, error: error.message || 'Failed to delete image' };
    }
  }

  _normalizeItem(it = {}) {
    return {
      id: it.id,
      title: typeof it.title === 'string' ? it.title : '',
      description: typeof it.description === 'string' ? it.description : '',
      item_id: typeof it.item_id === 'string' ? it.item_id : '',
      vendor: typeof it.vendor === 'string' ? it.vendor : '',
      manufacture_date: it.manufacture_date,
      categories: typeof it.categories === 'string' ? it.categories : '',
      subcategories: typeof it.subcategories === 'string' ? it.subcategories : '',
      // FK fields
      category_id: it.category_id || null,
      subcategory_id: it.subcategory_id || null,
      imageUrl: it.image_url || it.imageUrl || null,
      image_path: it.image_path || null,
      created_at: it.created_at || new Date().toISOString(),
      updated_at: it.updated_at || new Date().toISOString(),
      user_id: it.user_id || this.userId,
    };
  }

  // CRUD: items 
  async getItems() {
    try {
      if (!this.userId) throw new Error('User not set');

      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const normalized = Array.isArray(data) ? data.map((it) => this._normalizeItem(it)) : [];
      return { success: true, data: normalized };
    } catch (error) {
      console.error('getItems error:', error);
      return { success: false, error: error.message || 'Failed to load items' };
    }
  }

  async addItem(itemData) {
    try {
      this._assertUser();

      const required = ['title', 'description', 'item_id', 'vendor', 'manufacture_date'];
      for (const f of required) {
        if (!itemData[f] || !itemData[f].toString().trim()) {
          throw new Error(`${f.replace('_', ' ')} is required`);
        }
      }

      this._assertDate(itemData.manufacture_date);

      const { data: existing, error: checkError } = await supabase
        .from('inventory_items')
        .select('item_id')
        .eq('user_id', this.userId)
        .eq('item_id', itemData.item_id.trim())
        .single();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;
      if (existing) throw new Error('Item ID already exists');

      let imageUrl = null;
      let imagePath = null;

      if (itemData.imageUrl) {
        if (this._isSupabaseUrl(itemData.imageUrl)) {
          imageUrl = itemData.imageUrl;
        } else if (this._isLocalUri(itemData.imageUrl)) {
          const fileName = `${itemData.item_id}_${Date.now()}.jpg`;
          const uploadResult = await this.uploadImage(itemData.imageUrl, fileName);
          if (uploadResult.success) {
            imageUrl = uploadResult.publicUrl;
            imagePath = uploadResult.path;
          } else {
            console.warn('Image upload failed:', uploadResult.error);
          }
        } else if (typeof itemData.imageUrl === 'object' && itemData.imageUrl.uri) {
          const fileName = itemData.imageUrl.name || `${itemData.item_id}_${Date.now()}.jpg`;
          const uploadResult = await this.uploadImage(itemData.imageUrl, fileName);
          if (uploadResult.success) {
            imageUrl = uploadResult.publicUrl;
            imagePath = uploadResult.path;
          } else {
            console.warn('Image upload failed:', uploadResult.error);
          }
        } else {
          imageUrl = itemData.imageUrl;
        }
      }


      const newItem = {
        title: itemData.title.toString().trim(),
        description: itemData.description.toString().trim(),
        item_id: itemData.item_id.toString().trim(),
        vendor: itemData.vendor.toString().trim(),
        manufacture_date: itemData.manufacture_date,

        // Legacy tags 
        categories: itemData.categories ? itemData.categories.toString().trim() : '',
        subcategories: itemData.subcategories ? itemData.subcategories.toString().trim() : '',

        // NEW FK fields
        category_id: itemData.category_id || null,
        subcategory_id: itemData.subcategory_id || null,

        image_url: imageUrl,
        image_path: imagePath,
        user_id: this.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('inventory_items')
        .insert([newItem])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: this._normalizeItem(data) };
    } catch (error) {
      console.error('addItem error:', error);
      return { success: false, error: error.message || 'Failed to add item' };
    }
  }

  async updateItem(itemId, updates) {
    try {
      this._assertUser();

      const { data: existingItem, error: fetchError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', itemId)
        .eq('user_id', this.userId)
        .single();
      if (fetchError) throw new Error('Item not found');

      if (updates.item_id && updates.item_id !== existingItem.item_id) {
        const { data: duplicate, error: dupError } = await supabase
          .from('inventory_items')
          .select('id')
          .eq('user_id', this.userId)
          .eq('item_id', updates.item_id)
          .neq('id', itemId)
          .single();

        if (dupError && dupError.code !== 'PGRST116') throw dupError;
        if (duplicate) throw new Error('Item ID already exists');
      }

      if (updates.manufacture_date) this._assertDate(updates.manufacture_date);

      const dbUpdates = { ...updates };

      // Image handling
      if (updates.imageUrl !== undefined) {
        if (!updates.imageUrl) {
          if (existingItem.image_path) {
            await this.deleteImage(existingItem.image_path);
          }
          dbUpdates.image_url = null;
          dbUpdates.image_path = null;
        } else if (this._isSupabaseUrl(updates.imageUrl)) {
          dbUpdates.image_url = updates.imageUrl;
        } else if (this._isLocalUri(updates.imageUrl)) {
          if (existingItem.image_path) {
            await this.deleteImage(existingItem.image_path);
          }
          const fileName = `${existingItem.item_id}_${Date.now()}.jpg`;
          const uploadResult = await this.uploadImage(updates.imageUrl, fileName);
          if (uploadResult.success) {
            dbUpdates.image_url = uploadResult.publicUrl;
            dbUpdates.image_path = uploadResult.path;
          } else {
            throw new Error('Failed to upload new image');
          }
        } else {
          dbUpdates.image_url = updates.imageUrl;
        }
        delete dbUpdates.imageUrl;
      }

      ['title', 'description', 'item_id', 'vendor', 'categories', 'subcategories'].forEach((f) => {
        if (typeof dbUpdates[f] === 'string') dbUpdates[f] = dbUpdates[f].trim();
      });

      // FK fields pass-through (category_id/subcategory_id) are already in dbUpdates

      dbUpdates.updated_at = new Date().toISOString();
      const { data, error } = await supabase
        .from('inventory_items')
        .update(dbUpdates)
        .eq('id', itemId)
        .eq('user_id', this.userId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: this._normalizeItem(data) };
    } catch (error) {
      console.error('updateItem error:', error);
      return { success: false, error: error.message || 'Failed to update item' };
    }
  }

  async deleteItem(itemId) {
    try {
      this._assertUser();

      const { data: item, error: fetchError } = await supabase
        .from('inventory_items')
        .select('image_path')
        .eq('id', itemId)
        .eq('user_id', this.userId)
        .single();

      if (!fetchError && item?.image_path) {
        await this.deleteImage(item.image_path);
      }

      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', this.userId);
      if (error) throw error;

      return { success: true, message: 'Item deleted successfully' };
    } catch (error) {
      console.error('deleteItem error:', error);
      return { success: false, error: error.message || 'Failed to delete item' };
    }
  }

  // Search & Stats
  async searchItems(query) {
    try {
      const q = (query || '').toLowerCase();
      if (!q) return await this.getItems();

      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', this.userId)
        .or(
          `title.ilike.%${q}%,item_id.ilike.%${q}%,vendor.ilike.%${q}%,description.ilike.%${q}%,categories.ilike.%${q}%,subcategories.ilike.%${q}%`
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      const normalized = Array.isArray(data) ? data.map((it) => this._normalizeItem(it)) : [];
      return { success: true, data: normalized };
    } catch (error) {
      console.error('searchItems error:', error);
      return { success: false, error: error.message || 'Failed to search items' };
    }
  }

  async getItemById(itemId) {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', itemId)
        .eq('user_id', this.userId)
        .single();

      if (error) throw new Error('Item not found');

      return { success: true, data: this._normalizeItem(data) };
    } catch (error) {
      console.error('getItemById error:', error);
      return { success: false, error: error.message || 'Failed to get item' };
    }
  }

  async getInventoryStats() {
    try {
      const { data: items, error } = await supabase
        .from('inventory_items')
        .select('vendor, created_at, categories, subcategories')
        .eq('user_id', this.userId);
      if (error) throw error;

      const vendors = [...new Set(items.map((it) => it.vendor))];

      const allCategories = new Set();
      const allSubcategories = new Set();
      items.forEach((item) => {
        if (item.categories) {
          item.categories.split(',').forEach((cat) => {
            const trimmed = cat.trim();
            if (trimmed) allCategories.add(trimmed);
          });
        }
        if (item.subcategories) {
          item.subcategories.split(',').forEach((subcat) => {
            const trimmed = subcat.trim();
            if (trimmed) allSubcategories.add(trimmed);
          });
        }
      });

      const thisMonth = new Date();
      thisMonth.setDate(1);
      const itemsThisMonth = items.filter((it) => new Date(it.created_at) >= thisMonth).length;

      return {
        success: true,
        data: {
          totalItems: items.length,
          totalVendors: vendors.length,
          totalCategories: allCategories.size,
          totalSubcategories: allSubcategories.size,
          itemsThisMonth,
          vendors,
          categories: Array.from(allCategories).sort(),
          subcategories: Array.from(allSubcategories).sort(),
        },
      };
    } catch (error) {
      console.error('getInventoryStats error:', error);
      return { success: false, error: error.message || 'Failed to get inventory stats' };
    }
  }

  async getItemsByCategory(category) {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', this.userId)
        .ilike('categories', `%${category}%`)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const normalized = Array.isArray(data) ? data.map((it) => this._normalizeItem(it)) : [];
      return { success: true, data: normalized };
    } catch (error) {
      console.error('getItemsByCategory error:', error);
      return { success: false, error: error.message || 'Failed to get items by category' };
    }
  }

  async getItemsBySubcategory(subcategory) {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', this.userId)
        .ilike('subcategories', `%${subcategory}%`)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const normalized = Array.isArray(data) ? data.map((it) => this._normalizeItem(it)) : [];
      return { success: true, data: normalized };
    } catch (error) {
      console.error('getItemsBySubcategory error:', error);
      return { success: false, error: error.message || 'Failed to get items by subcategory' };
    }
  }

  validateItemData(itemData) {
    const errors = {};
    const required = {
      title: 'Title',
      description: 'Description',
      item_id: 'Item ID',
      vendor: 'Vendor',
      manufacture_date: 'Manufacture Date',
    };

    Object.entries(required).forEach(([f, label]) => {
      if (!itemData[f] || !itemData[f].toString().trim()) {
        errors[f] = `${label} is required`;
      }
    });

    if (itemData.manufacture_date) {
      try {
        this._assertDate(itemData.manufacture_date);
      } catch (e) {
        errors.manufacture_date = e.message;
      }
    }

    if (itemData.item_id) {
      const ok = /^[A-Za-z0-9\-_]+$/.test(itemData.item_id.toString().trim());
      if (!ok) errors.item_id = 'Item ID can only contain letters, numbers, hyphens, and underscores';
    }

    if (itemData.categories && itemData.categories.toString().trim().length > 100) {
      errors.categories = 'Categories must be 100 characters or less';
    }
    if (itemData.subcategories && itemData.subcategories.toString().trim().length > 100) {
      errors.subcategories = 'Subcategories must be 100 characters or less';
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }

  async clearAllData() {
    try {
      this._assertUser();

      const { data: items, error: fetchError } = await supabase
        .from('inventory_items')
        .select('image_path')
        .eq('user_id', this.userId);
      if (fetchError) throw fetchError;

      const imagePaths = items.map((item) => item.image_path).filter((p) => p);
      if (imagePaths.length > 0) {
        await supabase.storage.from('inventory_images').remove(imagePaths);
      }

      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('user_id', this.userId);
      if (error) throw error;

      return { success: true, message: 'All inventory data cleared' };
    } catch (error) {
      console.error('clearAllData error:', error);
      return { success: false, error: error.message || 'Failed to clear data' };
    }
  }

  async generateNextItemId() {
    try {
      const { data: items, error } = await supabase
        .from('inventory_items')
        .select('item_id')
        .eq('user_id', this.userId)
        .like('item_id', 'ITM%');
      if (error) throw error;

      let next = 1;
      items.forEach((it) => {
        const m = it.item_id && it.item_id.match(/^ITM(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n >= next) next = n + 1;
        }
      });

      return { success: true, data: `ITM${String(next).padStart(3, '0')}` };
    } catch (error) {
      console.error('generateNextItemId error:', error);
      return { success: false, error: error.message || 'Failed to generate item ID' };
    }
  }
}

export async function listCategories() {
  const { data, error } = await supabase
    .from('inventory_categories')
    .select('id, name, description')
    .order('name', { ascending: true });
  if (error) throw new Error(`listCategories: ${error.message}`);
  return data || [];
}

export async function listSubcategories(categoryId) {
  const { data, error } = await supabase
    .from('inventory_subcategories')
    .select('id, name, description, category_id')
    .eq('category_id', categoryId)
    .order('name', { ascending: true });
  if (error) throw new Error(`listSubcategories: ${error.message}`);
  return data || [];
}

export async function listCategoriesWithSubs() {
  const { data, error } = await supabase
    .from('inventory_categories')
    .select(
      'id, name, description, inventory_subcategories ( id, name, description, category_id )'
    )
    .order('name', { ascending: true });
  if (error) throw new Error(`listCategoriesWithSubs: ${error.message}`);

  return (data || []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    subcategories: c.inventory_subcategories || [],
  }));
}

export async function createCategory(name, description = '') {
  const { data, error } = await supabase
    .from('inventory_categories')
    .insert([{ name, description }])
    .select()
    .single();
  if (error) throw new Error(`createCategory: ${error.message}`);
  return data;
}

export async function createSubcategory(categoryId, name, description = '') {
  const { data, error } = await supabase
    .from('inventory_subcategories')
    .insert([{ category_id: categoryId, name, description }])
    .select()
    .single();
  if (error) throw new Error(`createSubcategory: ${error.message}`);
  return data;
}

// All images for a given inventory item (first is usually image_url on the item)
export async function listItemImages(itemId) {
  const { data, error } = await supabase
    .from('inventory_item_images')
    .select('id, image_url, path, created_at')
    .eq('item_id', itemId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`listItemImages: ${error.message}`);
  // Normalize to an array of URLs
  return (data || []).map(r => r.image_url).filter(Boolean);
}


// default instance
export default new InventoryService();
