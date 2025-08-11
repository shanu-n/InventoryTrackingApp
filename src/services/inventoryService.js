// src/services/inventoryService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

class InventoryService {
  constructor() {
    /** @private */
    this.userId = 'default_user'; // set from UI after Clerk login
  }

  /** Call this right after you know the Clerk user id */
  setUserId(id) {
    this.userId = id || 'default_user';
  }

  /** @private */
  storageKey() {
    return `inventory_${this.userId}`;
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

  /** Normalize any legacy/saved item shape */
  _normalizeItem(it = {}) {
    const unsplashDemo =
      'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=400&fit=crop';

    // prefer camelCase, keep snake_case only for backward compat
    const imageUrl = it.imageUrl ?? it.image_url ?? null;

    return {
      id: it.id,
      title: typeof it.title === 'string' ? it.title : '',
      description: typeof it.description === 'string' ? it.description : '',
      item_id: typeof it.item_id === 'string' ? it.item_id : '',
      vendor: typeof it.vendor === 'string' ? it.vendor : '',
      manufacture_date: it.manufacture_date,
      // Drop the old demo image if present
      imageUrl: imageUrl === unsplashDemo ? null : imageUrl ?? null,
      created_at: it.created_at || new Date().toISOString(),
      updated_at: it.updated_at || new Date().toISOString(),
    };
  }

  // ---- CRUD ----

  /** Get all items for the current user */
  async getItems() {
    try {
      if (!this.userId) throw new Error('User not set');
      const raw = await AsyncStorage.getItem(this.storageKey());
      const items = raw ? JSON.parse(raw) : [];
      const normalized = Array.isArray(items) ? items.map((it) => this._normalizeItem(it)) : [];
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

      // Load existing
      const existing = await this.getItems();
      const arr = existing.success && Array.isArray(existing.data) ? existing.data : [];

      // Unique item_id
      const duplicate = arr.some((it) => it.item_id === itemData.item_id.trim());
      if (duplicate) throw new Error('Item ID already exists');

      // Accept camelCase or snake_case from callers
      const incomingImageUrl =
        itemData.imageUrl ?? itemData.image_url ?? null; // <-- no fallback demo

      // Build new item
      const newItem = {
        id: Date.now(),
        title: itemData.title.toString().trim(),
        description: itemData.description.toString().trim(),
        item_id: itemData.item_id.toString().trim(),
        vendor: itemData.vendor.toString().trim(),
        manufacture_date: itemData.manufacture_date,
        imageUrl: incomingImageUrl, // <-- camelCase
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Persist (store already-normalized shape)
      const toSave = [newItem, ...arr];
      await AsyncStorage.setItem(this.storageKey(), JSON.stringify(toSave));

      return { success: true, data: newItem };
    } catch (error) {
      console.error('addItem error:', error);
      return { success: false, error: error.message || 'Failed to add item' };
    }
  }

  /** Update an existing item */
  async updateItem(itemId, updates) {
    try {
      this._assertUser();

      const existing = await this.getItems();
      if (!existing.success) throw new Error('Failed to load items');

      const items = Array.isArray(existing.data) ? existing.data : [];
      const idx = items.findIndex((it) => it.id === itemId);
      if (idx === -1) throw new Error('Item not found');

      // Ensure unique item_id if changing
      if (updates.item_id && updates.item_id !== items[idx].item_id) {
        const dup = items.some((it, i) => i !== idx && it.item_id === updates.item_id);
        if (dup) throw new Error('Item ID already exists');
      }

      // Validate date if present
      if (updates.manufacture_date) this._assertDate(updates.manufacture_date);

      // Normalize incoming image key and trim strings
      const clean = { ...updates };
      if (clean.image_url && !clean.imageUrl) {
        clean.imageUrl = clean.image_url;
        delete clean.image_url;
      }
      ['title', 'description', 'item_id', 'vendor', 'imageUrl'].forEach((f) => {
        if (typeof clean[f] === 'string') clean[f] = clean[f].trim();
      });

      items[idx] = {
        ...items[idx],
        ...clean,
        updated_at: new Date().toISOString(),
      };

      await AsyncStorage.setItem(this.storageKey(), JSON.stringify(items));
      return { success: true, data: items[idx] };
    } catch (error) {
      console.error('updateItem error:', error);
      return { success: false, error: error.message || 'Failed to update item' };
    }
  }

  /** Delete an item */
  async deleteItem(itemId) {
    try {
      this._assertUser();

      const existing = await this.getItems();
      if (!existing.success) throw new Error('Failed to load items');

      const items = Array.isArray(existing.data) ? existing.data : [];
      const filtered = items.filter((it) => it.id !== itemId);
      if (filtered.length === items.length) throw new Error('Item not found');

      await AsyncStorage.setItem(this.storageKey(), JSON.stringify(filtered));
      return { success: true, message: 'Item deleted successfully' };
    } catch (error) {
      console.error('deleteItem error:', error);
      return { success: false, error: error.message || 'Failed to delete item' };
    }
  }

  /** Text search across fields */
  async searchItems(query) {
    try {
      const result = await this.getItems();
      if (!result.success) return result;

      const q = (query || '').toLowerCase();
      const items = Array.isArray(result.data) ? result.data : [];

      const filtered = items.filter((it) =>
        [it.title, it.item_id, it.vendor, it.description]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q))
      );

      return { success: true, data: filtered };
    } catch (error) {
      console.error('searchItems error:', error);
      return { success: false, error: error.message || 'Failed to search items' };
    }
  }

  /** Get a single item */
  async getItemById(itemId) {
    try {
      const result = await this.getItems();
      if (!result.success) return result;

      const items = Array.isArray(result.data) ? result.data : [];
      const item = items.find((it) => it.id === itemId);
      if (!item) throw new Error('Item not found');

      return { success: true, data: item };
    } catch (error) {
      console.error('getItemById error:', error);
      return { success: false, error: error.message || 'Failed to get item' };
    }
  }

  /** Basic stats */
  async getInventoryStats() {
    try {
      const result = await this.getItems();
      if (!result.success) return result;

      const items = Array.isArray(result.data) ? result.data : [];
      const vendors = [...new Set(items.map((it) => it.vendor))];

      const thisMonth = new Date();
      thisMonth.setDate(1);
      const itemsThisMonth = items.filter((it) => new Date(it.created_at) >= thisMonth).length;

      return {
        success: true,
        data: {
          totalItems: items.length,
          totalVendors: vendors.length,
          itemsThisMonth,
          vendors,
        },
      };
    } catch (error) {
      console.error('getInventoryStats error:', error);
      return { success: false, error: error.message || 'Failed to get inventory stats' };
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

    return { isValid: Object.keys(errors).length === 0, errors };
  }

  /** Clear all items for current user */
  async clearAllData() {
    try {
      this._assertUser();
      await AsyncStorage.removeItem(this.storageKey());
      return { success: true, message: 'All inventory data cleared' };
    } catch (error) {
      console.error('clearAllData error:', error);
      return { success: false, error: error.message || 'Failed to clear data' };
    }
  }

  /** Generate next ID like ITM001 */
  async generateNextItemId() {
    try {
      const result = await this.getItems();
      if (!result.success) return { success: false, error: 'Failed to load items' };

      const items = Array.isArray(result.data) ? result.data : [];
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
