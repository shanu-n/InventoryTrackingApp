import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import {
  listCategoriesWithSubs,
  createCategory,
  createSubcategory,
} from '../services/inventoryService';

export default function ManageCategoriesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [expanded, setExpanded] = useState(new Set());

  // Add Category modal state
  const [showAddCat, setShowAddCat] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // Add Subcategory modal state
  const [showAddSub, setShowAddSub] = useState(false);
  const [subName, setSubName] = useState('');
  const [subDesc, setSubDesc] = useState('');
  const [activeCatId, setActiveCatId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listCategoriesWithSubs();
      setCategories(data);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Add Category handlers 
  const openAddCategory = () => {
    setCatName('');
    setCatDesc('');
    setShowAddCat(true);
  };

  const saveCategory = async () => {
    const name = catName.trim();
    const desc = catDesc.trim();
    if (!name) return Alert.alert('Validation', 'Category name is required.');

    try {
      setSubmitting(true);
      await createCategory(name, desc);
      setShowAddCat(false);
      await load();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  // Subcategory handlers 
  const openAddSub = (categoryId) => {
    setActiveCatId(categoryId);
    setSubName('');
    setSubDesc('');
    setShowAddSub(true);
  };

  const saveSubcategory = async () => {
    const name = subName.trim();
    const desc = subDesc.trim();
    if (!name) return Alert.alert('Validation', 'Subcategory name is required.');
    if (!activeCatId) return Alert.alert('Error', 'No category selected.');

    try {
      setSubmitting(true);
      await createSubcategory(activeCatId, name, desc);
      setShowAddSub(false);
      await load();
      // keep the category expanded
      setExpanded((prev) => new Set(prev).add(activeCatId));
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create subcategory');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCategory = ({ item }) => {
    const isOpen = expanded.has(item.id);
    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.catRow} onPress={() => toggle(item.id)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.catName}>{item.name}</Text>
            {item.description ? <Text style={styles.muted}>{item.description}</Text> : null}
          </View>
          <Text style={styles.count}>{item.subcategories?.length ?? 0}</Text>
          <Text style={styles.chev}>{isOpen ? '▾' : '▸'}</Text>
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.subWrap}>
            <TouchableOpacity style={styles.addSubBtn} onPress={() => openAddSub(item.id)}>
              <Text style={styles.addSubText}>+ Add Subcategory</Text>
            </TouchableOpacity>

            {!item.subcategories || item.subcategories.length === 0 ? (
              <Text style={styles.muted}>No subcategories yet.</Text>
            ) : (
              item.subcategories.map((s) => (
                <View key={s.id} style={styles.subRow}>
                  <Text style={styles.subName}>{s.name}</Text>
                  {s.description ? <Text style={styles.subDesc}>{s.description}</Text> : null}
                </View>
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.h1}>Manage Categories</Text>

        <TouchableOpacity style={styles.addCatBtn} onPress={openAddCategory}>
          <Text style={styles.addCatText}>+ Add Category</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading…</Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(c) => c.id}
          renderItem={renderCategory}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={[styles.muted, { textAlign: 'center', marginTop: 24 }]}>
              No categories yet. Use “+ Add Category”.
            </Text>
          }
        />
      )}

      {/* Add Category Modal*/}
      <Modal
        transparent
        animationType="slide"
        visible={showAddCat}
        onRequestClose={() => !submitting && setShowAddCat(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Category</Text>

            <Text style={styles.modalLabel}>Name *</Text>
            <TextInput
              value={catName}
              onChangeText={setCatName}
              placeholder="e.g., Lab Equipment"
              style={styles.input}
              editable={!submitting}
            />

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              value={catDesc}
              onChangeText={setCatDesc}
              placeholder="Optional"
              style={[styles.input, { height: 84 }]}
              editable={!submitting}
              multiline
            />

            <View style={styles.modalRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#e5e7eb' }]}
                onPress={() => !submitting && setShowAddCat(false)}
                disabled={submitting}
              >
                <Text style={[styles.modalBtnText, { color: '#111827' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#2563eb' }]}
                onPress={saveCategory}
                disabled={submitting}
              >
                <Text style={[styles.modalBtnText, { color: 'white' }]}>
                  {submitting ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Subcategory Modal*/}
      <Modal
        transparent
        animationType="slide"
        visible={showAddSub}
        onRequestClose={() => !submitting && setShowAddSub(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Subcategory</Text>
            {activeCatId ? (
              <Text style={styles.modalHint}>
                Under:{' '}
                {categories.find((c) => c.id === activeCatId)?.name || 'Selected category'}
              </Text>
            ) : null}

            <Text style={styles.modalLabel}>Name *</Text>
            <TextInput
              value={subName}
              onChangeText={setSubName}
              placeholder="e.g., Laptops"
              style={styles.input}
              editable={!submitting}
            />

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              value={subDesc}
              onChangeText={setSubDesc}
              placeholder="Optional"
              style={[styles.input, { height: 84 }]}
              editable={!submitting}
              multiline
            />

            <View style={styles.modalRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#e5e7eb' }]}
                onPress={() => !submitting && setShowAddSub(false)}
                disabled={submitting}
              >
                <Text style={[styles.modalBtnText, { color: '#111827' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#2563eb' }]}
                onPress={saveSubcategory}
                disabled={submitting}
              >
                <Text style={[styles.modalBtnText, { color: 'white' }]}>
                  {submitting ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f7fb' },
  header: {
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 6,
    backgroundColor: '#f6f7fb',
  },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 8 },

  addCatBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f0fe',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  addCatText: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },

  loading: { marginTop: 24, alignItems: 'center' },
  muted: { color: '#6b7280' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  catRow: { flexDirection: 'row', alignItems: 'center' },
  catName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  count: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
    fontWeight: '600',
    color: '#374151',
  },
  chev: { fontSize: 18, color: '#4b5563' },

  subWrap: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
  addSubBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  addSubText: { fontSize: 14, fontWeight: '600', color: '#1f2937' },

  subRow: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#fafafa',
    marginBottom: 6,
  },
  subName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  subDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  // ---- modal styles ----
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  modalHint: { color: '#6b7280', marginBottom: 8 },
  modalLabel: { fontSize: 13, color: '#6b7280', marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  modalRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: { fontWeight: '700' },
});
