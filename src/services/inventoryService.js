// src/services/inventoryService.js
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://vhdnqoljgyejwksoncqs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZG5xb2xqZ3llandrc29uY3FzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg1MDk3OSwiZXhwIjoyMDcxNDI2OTc5fQ.N0_nw4a5NV1hXiuOxU54DIs3sEBy9TgR70r3MPxgvqc'

const supabase = createClient(supabaseUrl, supabaseKey);

class InventoryService {
  constructor() {
    /** @private */
    this.userId = 'default_user'; // set from UI after Clerk login
  }

  /** Call this right after you know the Clerk user id */
  setUserId(id) {
    this.userId = id || 'default_user';
  }

  // ---- helpers ----
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

  /**
   * Check if a URL is a local file URI
   */
  _isLocalUri(url) {
    if (!url) return false;
    return url.startsWith('file://') || url.startsWith('content://') || url.startsWith('ph://');
  }

  /**
   * Check if a URL is already a Supabase hosted URL
   */
  _isSupabaseUrl(url) {
    if (!url) return false;
    return url.includes('supabase.co') || url.includes(supabaseUrl);
  }

  /**
   * Upload image to Supabase storage bucket
   * @param {string|object} fileInput - Either a local URI string or a picker object { uri, name, type }
   * @param {string} [fileName] - Optional filename if fileInput is a URI string
   * @returns {Promise<{success: boolean, publicUrl?: string, path?: string, error?: string}>}
   */
  async uploadImage(fileInput, fileName) {
    try {
      this._assertUser();

      let uri, name, type;

      if (typeof fileInput === 'string') {
        // Local URI string
        uri = fileInput;
        name = fileName || `file_${Date.now()}.jpg`;
        type = `image/jpeg`;
      } else if (fileInput?.uri) {
        // Picker object
        uri = fileInput.uri;
        name = fileInput.name || `file_${Date.now()}.jpg`;
        type = fileInput.type || 'image/jpeg';
      } else {
        throw new Error('Invalid file input');
      }

      // Prefix filename with userId for uniqueness
      const uniqueFileName = `${this.userId}/${Date.now()}_${name}`;

      // Convert local URI to Blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Supabase
      const { data, error } = await supabase.storage
        .from('inventory_images')
        .upload(uniqueFileName, blob, {
          cacheControl: '3600',
          contentType: type,
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
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

  /**
   * Delete image from Supabase storage
   * @param {string} imagePath - Storage path of the image
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteImage(imagePath) {
    try {
      if (!imagePath) return { success: true }; // No image to delete

      const { error } = await supabase.storage
        .from('inventory_images')
        .remove([imagePath]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('deleteImage error:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete image'
      };
    }
  }

  /** Normalize any legacy/saved item shape */
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
      imageUrl: it.image_url || it.imageUrl || null, // Handle both naming conventions
      created_at: it.created_at || new Date().toISOString(),
      updated_at: it.updated_at || new Date().toISOString(),
      user_id: it.user_id || this.userId,
    };
  }

  /** Get all items for the current user */
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

  /** Add a new item */
  async addItem(itemData) {
    try {
      this._assertUser();

      // Validate required fields
      const required = ['title', 'description', 'item_id', 'vendor', 'manufacture_date'];
      for (const f of required) {
        if (!itemData[f] || !itemData[f].toString().trim()) {
          throw new Error(`${f.replace('_', ' ')} is required`);
        }
      }
      
      // Validate date
      this._assertDate(itemData.manufacture_date);

      // Check for duplicate item_id
      const { data: existing, error: checkError } = await supabase
        .from('inventory_items')
        .select('item_id')
        .eq('user_id', this.userId)
        .eq('item_id', itemData.item_id.trim())
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existing) {
        throw new Error('Item ID already exists');
      }

      let imageUrl = null;
      let imagePath = null;

      // ✅ Handle image - check if it's already hosted or needs upload
      if (itemData.imageUrl) {
        if (this._isSupabaseUrl(itemData.imageUrl)) {
          // ✅ Already a hosted Supabase URL from vision API
          imageUrl = itemData.imageUrl;
          console.log('✅ Using hosted image URL:', imageUrl);
        } else if (this._isLocalUri(itemData.imageUrl)) {
          // ✅ Local file that needs upload
          console.log('📤 Uploading local image:', itemData.imageUrl);
          const fileName = `${itemData.item_id}_${Date.now()}.jpg`;
          const uploadResult = await this.uploadImage(itemData.imageUrl, fileName);
          
          if (uploadResult.success) {
            imageUrl = uploadResult.publicUrl;
            imagePath = uploadResult.path;
          } else {
            console.warn('Image upload failed:', uploadResult.error);
          }
        } else if (typeof itemData.imageUrl === 'object' && itemData.imageUrl.uri) {
          // ✅ Picker object format
          const fileName = itemData.imageUrl.name || `${itemData.item_id}_${Date.now()}.jpg`;
          const uploadResult = await this.uploadImage(itemData.imageUrl, fileName);
          
          if (uploadResult.success) {
            imageUrl = uploadResult.publicUrl;
            imagePath = uploadResult.path;
          } else {
            console.warn('Image upload failed:', uploadResult.error);
          }
        } else {
          // ✅ Assume it's already a valid URL
          imageUrl = itemData.imageUrl;
        }
      }

      // Build new item for database
      const newItem = {
        title: itemData.title.toString().trim(),
        description: itemData.description.toString().trim(),
        item_id: itemData.item_id.toString().trim(),
        vendor: itemData.vendor.toString().trim(),
        manufacture_date: itemData.manufacture_date,
        categories: itemData.categories ? itemData.categories.toString().trim() : '',
        subcategories: itemData.subcategories ? itemData.subcategories.toString().trim() : '',
        image_url: imageUrl,
        image_path: imagePath,
        user_id: this.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Insert into database
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

  /** Update an existing item */
  async updateItem(itemId, updates) {
    try {
      this._assertUser();

      // Check if item exists and belongs to user
      const { data: existingItem, error: fetchError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', itemId)
        .eq('user_id', this.userId)
        .single();

      if (fetchError) throw new Error('Item not found');

      // Ensure unique item_id if changing
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

      // Validate date if present
      if (updates.manufacture_date) this._assertDate(updates.manufacture_date);

      // Prepare updates with snake_case for database
      const dbUpdates = { ...updates };

      // ✅ Handle image update with hosted URL support
      if (updates.imageUrl !== undefined) {
        if (!updates.imageUrl) {
          // ✅ Image removed
          if (existingItem.image_path) {
            await this.deleteImage(existingItem.image_path);
          }
          dbUpdates.image_url = null;
          dbUpdates.image_path = null;
        } else if (this._isSupabaseUrl(updates.imageUrl)) {
          // ✅ Already a hosted URL - use as is
          dbUpdates.image_url = updates.imageUrl;
          console.log('✅ Using hosted image URL:', updates.imageUrl);
        } else if (this._isLocalUri(updates.imageUrl)) {
          // ✅ Local file that needs upload
          console.log('📤 Uploading local image for update:', updates.imageUrl);
          
          // Delete old image if exists
          if (existingItem.image_path) {
            await this.deleteImage(existingItem.image_path);
          }

          // Upload new image
          const fileName = `${existingItem.item_id}_${Date.now()}.jpg`;
          const uploadResult = await this.uploadImage(updates.imageUrl, fileName);
          
          if (uploadResult.success) {
            dbUpdates.image_url = uploadResult.publicUrl;
            dbUpdates.image_path = uploadResult.path;
          } else {
            throw new Error('Failed to upload new image');
          }
        } else {
          // ✅ Assume it's already a valid URL
          dbUpdates.image_url = updates.imageUrl;
        }
        
        // Remove the camelCase imageUrl from updates
        delete dbUpdates.imageUrl;
      }

      // Trim strings including new category fields
      ['title', 'description', 'item_id', 'vendor', 'categories', 'subcategories'].forEach((f) => {
        if (typeof dbUpdates[f] === 'string') dbUpdates[f] = dbUpdates[f].trim();
      });

      dbUpdates.updated_at = new Date().toISOString();

      // Update in database
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

  /** Delete an item */
  async deleteItem(itemId) {
    try {
      this._assertUser();

      // Get item details to delete associated image
      const { data: item, error: fetchError } = await supabase
        .from('inventory_items')
        .select('image_path')
        .eq('id', itemId)
        .eq('user_id', this.userId)
        .single();

      if (!fetchError && item?.image_path) {
        // Delete image from storage
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

  /** Text search across fields including categories */
  async searchItems(query) {
    try {
      const q = (query || '').toLowerCase();
      if (!q) return await this.getItems();

      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', this.userId)
        .or(`title.ilike.%${q}%,item_id.ilike.%${q}%,vendor.ilike.%${q}%,description.ilike.%${q}%,categories.ilike.%${q}%,subcategories.ilike.%${q}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const normalized = Array.isArray(data) ? data.map((it) => this._normalizeItem(it)) : [];
      return { success: true, data: normalized };
    } catch (error) {
      console.error('searchItems error:', error);
      return { success: false, error: error.message || 'Failed to search items' };
    }
  }

  /** Get a single item */
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

  /** Basic stats including category analysis */
  async getInventoryStats() {
    try {
      const { data: items, error } = await supabase
        .from('inventory_items')
        .select('vendor, created_at, categories, subcategories')
        .eq('user_id', this.userId);

      if (error) throw error;

      const vendors = [...new Set(items.map((it) => it.vendor))];

      // Collect all categories and subcategories
      const allCategories = new Set();
      const allSubcategories = new Set();
      
      items.forEach(item => {
        if (item.categories) {
          item.categories.split(',').forEach(cat => {
            const trimmed = cat.trim();
            if (trimmed) allCategories.add(trimmed);
          });
        }
        if (item.subcategories) {
          item.subcategories.split(',').forEach(subcat => {
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

  /** Get items by category */
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

  /** Get items by subcategory */
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

  /** Validate an item payload without saving */
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

    // Validate categories and subcategories length
    if (itemData.categories && itemData.categories.toString().trim().length > 100) {
      errors.categories = 'Categories must be 100 characters or less';
    }

    if (itemData.subcategories && itemData.subcategories.toString().trim().length > 100) {
      errors.subcategories = 'Subcategories must be 100 characters or less';
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }

  /** Clear all items for current user */
  async clearAllData() {
    try {
      this._assertUser();

      // Get all items to delete their images
      const { data: items, error: fetchError } = await supabase
        .from('inventory_items')
        .select('image_path')
        .eq('user_id', this.userId);

      if (fetchError) throw fetchError;

      // Delete all images from storage
      const imagePaths = items
        .map(item => item.image_path)
        .filter(path => path); // Filter out null/undefined paths

      if (imagePaths.length > 0) {
        await supabase.storage
          .from('inventory_images')
          .remove(imagePaths);
      }

      // Delete all inventory items
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

  /** Generate next ID like ITM001 */
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

export default new InventoryService();