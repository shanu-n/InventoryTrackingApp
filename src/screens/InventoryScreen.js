import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useUser, useAuth } from '@clerk/clerk-expo';
import inventoryService from '../services/inventoryService';

const { width, height } = Dimensions.get('window');
const ITEM_GAP = 16;
const ITEM_WIDTH = (width - (ITEM_GAP * 3)) / 2;
const isYMD = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const toLocalDate = (val) => {
  if (!val) return null;
  if (isYMD(val)) {
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(val);
  return isNaN(d) ? null : d;
};
const formatDate = (val) => {
  const d = toLocalDate(val);
  return d
    ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unknown';
};
const splitCsv = (s) => (s || '').split(',').map(t => t.trim()).filter(Boolean);

const getItemImages = (item) => {
  if (Array.isArray(item?.image_gallery) && item.image_gallery.length) {
    return item.image_gallery.filter(Boolean);
  }
  if (typeof item?.image_gallery === 'string' && item.image_gallery.trim()) {
    return item.image_gallery.split(',').map(s => s.trim()).filter(Boolean);
  }
  const one = item?.imageUrl || item?.image_url || null;
  return one ? [one] : [];
};

const InventoryScreen = ({ navigation }) => {
  const { user: clerkUser } = useUser();
  const { signOut } = useAuth();
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // double-tap detector
  const lastTapRef = useRef(0);

  useEffect(() => {
    initializeScreen();
  }, [clerkUser]);

  useFocusEffect(
    useCallback(() => {
      loadInventoryItems();
    }, [])
  );

  useEffect(() => {
    filterItems();
  }, [searchQuery, items]);

  const initializeScreen = async () => {
    try {
      let displayName = clerkUser?.fullName?.trim();
      if (!displayName) {
        displayName =
          clerkUser?.username ||
          clerkUser?.primaryEmailAddress?.emailAddress ||
          'User';
      }

      inventoryService.setUserId(clerkUser?.id || 'default_user');
      setUser({ name: displayName, id: clerkUser?.id });
      await loadInventoryItems();
    } catch (e) {
      console.error('Error initializing screen:', e);
      setLoading(false);
    }
  };

  const loadInventoryItems = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await inventoryService.getItems();
      setItems(result?.success ? result.data : []);
    } catch (error) {
      console.error('Error loading items:', error);
      Alert.alert('Error', 'Failed to load inventory items');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterItems = () => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFilteredItems(
      items.filter((it) =>
        (it?.title || '').toLowerCase().includes(q) ||
        (it?.item_id || '').toLowerCase().includes(q) ||
        (it?.vendor || '').toLowerCase().includes(q) ||
        (it?.description || '').toLowerCase().includes(q)
      )
    );
  };

  const handleRefresh = useCallback(() => {
    loadInventoryItems(true);
  }, []);

  const handleAddItem = () => navigation.navigate('AddItem');
  const handleCardTap = (item) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      openPreview(item);
    }
    lastTapRef.current = now;
  };

  const openPreview = (item) => {
    setPreviewItem(item);
    setCarouselIndex(0);
    setPreviewVisible(true);
  };

  const closePreview = () => {
    setPreviewVisible(false);
    setPreviewItem(null);
    setCarouselIndex(0);
  };

  // Delete from within modal
  const confirmDelete = (item) => {
    Alert.alert('Delete Item', `Delete "${item.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await inventoryService.deleteItem(item.id);
          if (result.success) {
            setItems((prev) => prev.filter((i) => i.id !== item.id));
            closePreview();
            Alert.alert('Success', 'Item deleted successfully');
          } else {
            Alert.alert('Error', result.error || 'Failed to delete item');
          }
        },
      },
    ]);
  };

  // Stats helpers for header
  const calculateStats = () => {
    if (!items || items.length === 0) {
      return {
        totalItems: 0,
        uniqueVendors: 0,
        itemsThisMonth: 0,
        itemsThisWeek: 0,
        oldestItem: null,
        newestItem: null,
        topVendor: null,
        avgItemAge: 0
      };
    }

    const totalItems = items.length;
    const vendors = [...new Set(items.map(item => item.vendor))];
    const uniqueVendors = vendors.length;

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const itemsThisMonth = items.filter(item => {
      const createdDate = toLocalDate(item.created_at) || toLocalDate(item.manufacture_date);
      return createdDate && createdDate >= thisMonth;
    }).length;

    const itemsThisWeek = items.filter(item => {
      const createdDate = toLocalDate(item.created_at) || toLocalDate(item.manufacture_date);
      return createdDate && createdDate >= thisWeek;
    }).length;

    const sortedByManufacture = [...items].sort((a, b) => {
      const da = toLocalDate(a.manufacture_date);
      const db = toLocalDate(b.manufacture_date);
      return (da?.getTime?.() ?? 0) - (db?.getTime?.() ?? 0);
    });
    const oldestItem = sortedByManufacture[0];
    const newestItem = sortedByManufacture[sortedByManufacture.length - 1];

    const vendorCounts = {};
    items.forEach(item => {
      vendorCounts[item.vendor] = (vendorCounts[item.vendor] || 0) + 1;
    });
    const topVendor = Object.keys(vendorCounts).reduce((a, b) =>
      (vendorCounts[a] || 0) > (vendorCounts[b] || 0) ? a : b
    );

    const totalAge = items.reduce((sum, item) => {
      const d = toLocalDate(item.manufacture_date);
      if (!d) return sum;
      const ageInDays = (now - d) / (1000 * 60 * 60 * 24);
      return sum + ageInDays;
    }, 0);
    const avgItemAge = Math.round(totalAge / totalItems);

    return {
      totalItems,
      uniqueVendors,
      itemsThisMonth,
      itemsThisWeek,
      oldestItem,
      newestItem,
      topVendor,
      topVendorCount: vendorCounts[topVendor],
      avgItemAge
    };
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          navigation.replace('Login');
        },
      },
    ]);
  };

  const handleMenuOption = (opt) => {
    if (opt === 'refresh') handleRefresh();
    if (opt === 'stats') navigation.navigate('Statistics', { items });
    setShowMenu(false);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowMenu(!showMenu)}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={(text) => setSearchQuery(text)}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity style={styles.clearSearch} onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
          <Ionicons name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
          {searchQuery ? ` found for "${searchQuery}"` : ' in inventory'}
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item }) => {
    const img = (item?.imageUrl || item?.image_url) ?? null;
    return (
      <View style={[styles.itemContainer, { marginLeft: ITEM_GAP, marginRight: 0 }]}>
        <TouchableOpacity
          style={styles.itemCard}
          onPress={() => handleCardTap(item)}   
          activeOpacity={0.8}
        >
          <View style={styles.imageContainer}>
            {img ? (
              <Image source={{ uri: img }} style={styles.itemImage} resizeMode="cover" />
            ) : (
              <View style={[styles.itemImage, { backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="image-outline" size={28} color="#94a3b8" />
              </View>
            )}
            {item?.item_id ? (
              <View style={styles.itemIdBadge}>
                <Text style={styles.itemIdText}>{item.item_id}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.itemDetails}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item?.title || 'Untitled'}
            </Text>
            <Text style={styles.itemVendor} numberOfLines={1}>
              {item?.vendor || '—'}
            </Text>
            <Text style={styles.itemDate}>{formatDate(item?.manufacture_date)}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const images = getItemImages(previewItem);
  const categories = splitCsv(previewItem?.categories);
  const subcategories = splitCsv(previewItem?.subcategories);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item, idx) =>
          (item?.id ? String(item.id) : item?.item_id ? String(item.item_id) : String(idx))
        }
        numColumns={2}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[styles.listContainer, { paddingLeft: ITEM_GAP, paddingRight: ITEM_GAP }]}
        columnWrapperStyle={filteredItems.length > 0 ? styles.row : null}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      />

      {showMenu && (
        <>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          />
          <View style={styles.dropdown}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => handleMenuOption('refresh')}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={20} color="#475569" />
              <Text style={styles.dropdownText}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => handleMenuOption('stats')}
              activeOpacity={0.7}
            >
              <Ionicons name="stats-chart-outline" size={20} color="#475569" />
              <Text style={styles.dropdownText}>Statistics</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setShowMenu(false); navigation.navigate('ManageCategories'); }}
              style={[styles.dropdownItem, { justifyContent: 'flex-start' }]}
              accessibilityRole="button"
              accessibilityLabel="Manage Categories"
              testID="btn-manage-categories"
            >
              <Ionicons name="settings-outline" size={20} color="#475569" />
              <Text style={styles.dropdownText}>Manage Categories</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {}
      <Modal
        visible={previewVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closePreview}
      >
        <SafeAreaView style={styles.modalSafe}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {previewItem?.title || 'Item'}
            </Text>
            <TouchableOpacity onPress={closePreview} style={styles.modalClose}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Carousel */}
          <View style={styles.carouselWrap}>
            {images.length ? (
              <>
                <FlatList
                  data={images}
                  keyExtractor={(uri, idx) => `${uri}-${idx}`}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item: uri }) => (
                    <Image
                      source={{ uri }}
                      style={styles.fullImage}
                      resizeMode="contain"
                    />
                  )}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                    setCarouselIndex(idx);
                  }}
                />
                {images.length > 1 && (
                  <View style={styles.dots}>
                    {images.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          i === carouselIndex && styles.dotActive
                        ]}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.imageFallback}>
                <Ionicons name="image-outline" size={36} color="#94a3b8" />
                <Text style={{ color: '#94a3b8', marginTop: 8 }}>No image</Text>
              </View>
            )}
          </View>

          {/* Details + actions */}
          <View style={styles.bottomSheet}>
            <ScrollView contentContainerStyle={styles.detailsContainer}>
              <Text style={styles.detailLine}>
                <Text style={styles.detailLabel}>Item ID: </Text>
                {previewItem?.item_id || '-'}
              </Text>
              <Text style={styles.detailLine}>
                <Text style={styles.detailLabel}>Vendor: </Text>
                {previewItem?.vendor || '-'}
              </Text>
              <Text style={styles.detailLine}>
                <Text style={styles.detailLabel}>Manufactured: </Text>
                {formatDate(previewItem?.manufacture_date)}
              </Text>

              {!!(previewItem?.description) && (
                <Text style={[styles.detailLine, { marginTop: 6 }]}>
                  {previewItem.description}
                </Text>
              )}

              {/* Tags */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {categories.map((c) => (
                  <View key={`c-${c}`} style={styles.tagCat}>
                    <Text style={styles.tagText}>{c}</Text>
                  </View>
                ))}
                {subcategories.map((s) => (
                  <View key={`s-${s}`} style={styles.tagSub}>
                    <Text style={styles.tagText}>{s}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.footerBtn, styles.btnGrey]}
                onPress={() => { closePreview(); navigation.navigate('EditItem', { item: previewItem }); }}
              >
                <Text style={styles.footerBtnTextDark}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerBtn, styles.btnRed]}
                onPress={() => confirmDelete(previewItem)}
              >
                <Text style={styles.footerBtnText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerBtn, styles.btnBlue]}
                onPress={closePreview}
              >
                <Text style={styles.footerBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const renderEmptyState = () => (
  <View style={styles.emptyState}>
    <Ionicons name="cube-outline" size={80} color="#cbd5e1" />
    <Text style={styles.emptyTitle}>No items yet</Text>
    <Text style={styles.emptyDescription}>
      Start building your inventory by adding your first item
    </Text>
  </View>
);

// ====================== STYLES ======================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent', zIndex: 999 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#64748b' },

  listContainer: { paddingBottom: 20, flexGrow: 1 },
  header: { paddingVertical: 20, marginBottom: 16, position: 'relative', paddingHorizontal: ITEM_GAP },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  welcomeText: { fontSize: 16, color: '#64748b' },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { padding: 8, borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: 8 },
  logoutButton: { padding: 8, borderRadius: 8, backgroundColor: '#f1f5f9' },

  dropdown: {
    position: 'absolute', top: 76, right: 16, backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 8,
    minWidth: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12,
    elevation: 8, zIndex: 1000,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 },
  dropdownText: { marginLeft: 12, fontSize: 16, color: '#475569', fontWeight: '500' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  searchInputContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 16,
    marginRight: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3,
  },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, height: 48, fontSize: 16, color: '#1e293b' },
  clearSearch: { padding: 4 },
  addButton: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },

  statsContainer: { paddingHorizontal: 4 },
  statsText: { fontSize: 14, color: '#64748b', fontWeight: '500' },

  row: { justifyContent: 'space-between' },
  itemContainer: { width: ITEM_WIDTH, marginBottom: ITEM_GAP },
  itemCard: {
    backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6,
  },
  imageContainer: { position: 'relative' },
  itemImage: { width: '100%', height: ITEM_WIDTH * 0.8, backgroundColor: '#f1f5f9' },
  itemIdBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0, 0, 0, 0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  itemIdText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  itemDetails: { padding: 12 },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4, lineHeight: 20 },
  itemVendor: { fontSize: 14, color: '#64748b', marginBottom: 6 },
  itemDate: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, minHeight: 400 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginTop: 16, marginBottom: 8 },
  emptyDescription: { fontSize: 16, color: '#64748b', textAlign: 'center', lineHeight: 22, paddingHorizontal: 32, marginBottom: 32 },

  // ---------- Modal ----------
  modalSafe: { flex: 1, backgroundColor: '#000' },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
  modalClose: { padding: 8, marginLeft: 8 },

  carouselWrap: {
    width: '100%',
    height: Math.round(height * 0.45),
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: { width, height: Math.round(height * 0.45) },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
  },

  bottomSheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  detailsContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  detailLine: { fontSize: 14, color: '#111827', marginBottom: 2 },
  detailLabel: { fontWeight: '700' },

  tagCat: { backgroundColor: '#e5edff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  tagSub: { backgroundColor: '#fff7cc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 12, color: '#111827', fontWeight: '600' },

  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  footerBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGrey: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db' },
  btnRed: { backgroundColor: '#ef4444' },
  btnBlue: { backgroundColor: '#2563eb' },
  footerBtnText: { color: '#fff', fontWeight: '700' },
  footerBtnTextDark: { color: '#111827', fontWeight: '700' },
});

export default InventoryScreen;
