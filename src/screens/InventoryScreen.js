import React, { useState, useEffect, useCallback } from 'react';
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
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import authService from '../services/authService';
import inventoryService from '../services/inventoryService';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 48) / 2; // 2 columns with margins

const InventoryScreen = ({ navigation }) => {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  
  // Animation values - simplified to avoid issues
  const fadeAnim = useState(new Animated.Value(1))[0]; // Start visible
  const slideAnim = useState(new Animated.Value(0))[0]; // Start in position

  useEffect(() => {
    initializeScreen();
  }, []);

  // Refresh data when screen comes into focus
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
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      await loadInventoryItems();
    } catch (error) {
      console.error('Error initializing screen:', error);
      setLoading(false);
    }
  };

  const loadInventoryItems = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Try to load existing items first
      const result = await inventoryService.getItems();
      
      if (result.success && result.data.length > 0) {
        setItems(result.data);
      } else {
        // If no items exist, seed with demo data
        const seedResult = await inventoryService.seedDemoData();
        if (seedResult.success) {
          setItems(seedResult.data);
        } else {
          setItems([]);
        }
      }
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

    const filtered = items.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setFilteredItems(filtered);
  };

  const handleRefresh = useCallback(() => {
    loadInventoryItems(true);
  }, []);

  const handleAddItem = () => {
    navigation.navigate('AddItem');
  };

  const handleItemPress = (item) => {
    // Navigate to item details (we'll create this later)
    Alert.alert(
      item.title,
      `Item ID: ${item.item_id}\nVendor: ${item.vendor}\nManufactured: ${formatDate(item.manufacture_date)}\n\n${item.description}`,
      [{ text: 'OK' }]
    );
  };

  const handleItemLongPress = (item) => {
    Alert.alert(
      'Item Options',
      `What would you like to do with "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Edit', 
          onPress: () => {
            // Navigate to EditItemScreen with the item data
            navigation.navigate('EditItemScreen', { item });
          }
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteItem(item),
        },
      ]
    );
  };

  const handleDeleteItem = async (item) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await inventoryService.deleteItem(item.id);
              if (result.success) {
                const updatedItems = items.filter(i => i.id !== item.id);
                setItems(updatedItems);
                Alert.alert('Success', 'Item deleted successfully');
              } else {
                Alert.alert('Error', result.error || 'Failed to delete item');
              }
            } catch (error) {
              Alert.alert('Error', 'Something went wrong while deleting the item');
            }
          },
        },
      ]
    );
  };

  const handleMenuOption = (option) => {
    console.log('Menu option pressed:', option); // Debug log
    setShowMenu(false);
    
    switch (option) {
      case 'refresh':
        loadInventoryItems(true);
        break;
      case 'stats':
        showInventoryStats();
        break;
      default:
        break;
    }
  };

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

    // Calculate basic stats
    const totalItems = items.length;
    
    // Get unique vendors
    const vendors = [...new Set(items.map(item => item.vendor))];
    const uniqueVendors = vendors.length;
    
    // Calculate items added this month and week
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const itemsThisMonth = items.filter(item => {
      const createdDate = new Date(item.created_at || item.manufacture_date);
      return createdDate >= thisMonth;
    }).length;
    
    const itemsThisWeek = items.filter(item => {
      const createdDate = new Date(item.created_at || item.manufacture_date);
      return createdDate >= thisWeek;
    }).length;
    
    // Find oldest and newest items by manufacture date
    const sortedByManufacture = items.sort((a, b) => 
      new Date(a.manufacture_date) - new Date(b.manufacture_date)
    );
    const oldestItem = sortedByManufacture[0];
    const newestItem = sortedByManufacture[sortedByManufacture.length - 1];
    
    // Find top vendor
    const vendorCounts = {};
    items.forEach(item => {
      vendorCounts[item.vendor] = (vendorCounts[item.vendor] || 0) + 1;
    });
    const topVendor = Object.keys(vendorCounts).reduce((a, b) => 
      vendorCounts[a] > vendorCounts[b] ? a : b
    );
    
    // Calculate average item age in days
    const totalAge = items.reduce((sum, item) => {
      const ageInDays = (now - new Date(item.manufacture_date)) / (1000 * 60 * 60 * 24);
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

  const showInventoryStats = () => {
    try {
      const stats = calculateStats();
      
      if (stats.totalItems === 0) {
        Alert.alert(
          'Inventory Statistics',
          'No items in inventory yet. Add some items to see statistics!',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const statsMessage = `📊 INVENTORY OVERVIEW
      
📦 Total Items: ${stats.totalItems}
🏢 Unique Vendors: ${stats.uniqueVendors}
📅 Added This Month: ${stats.itemsThisMonth}
⏱️ Added This Week: ${stats.itemsThisWeek}

🏆 TOP VENDOR
${stats.topVendor} (${stats.topVendorCount} items)

📋 ITEM DETAILS
⏳ Average Age: ${stats.avgItemAge} days
📅 Oldest Item: ${stats.oldestItem?.title} (${formatDate(stats.oldestItem?.manufacture_date)})
🆕 Newest Item: ${stats.newestItem?.title} (${formatDate(stats.newestItem?.manufacture_date)})`;

      Alert.alert(
        'Inventory Statistics',
        statsMessage,
        [
          { text: 'View Vendors', onPress: () => showVendorBreakdown() },
          { text: 'OK' }
        ]
      );
    } catch (error) {
      console.error('Error calculating statistics:', error);
      Alert.alert('Error', 'Failed to calculate statistics');
    }
  };

  const showVendorBreakdown = () => {
    try {
      if (!items || items.length === 0) {
        Alert.alert('No Data', 'No items available for vendor breakdown.');
        return;
      }

      // Calculate vendor breakdown
      const vendorCounts = {};
      items.forEach(item => {
        vendorCounts[item.vendor] = (vendorCounts[item.vendor] || 0) + 1;
      });

      // Sort vendors by count (descending)
      const sortedVendors = Object.entries(vendorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10); // Show top 10 vendors

      const vendorMessage = `🏢 VENDOR BREAKDOWN (Top ${Math.min(10, sortedVendors.length)})

${sortedVendors.map(([vendor, count], index) => 
  `${index + 1}. ${vendor}: ${count} items`
).join('\n')}

${sortedVendors.length < Object.keys(vendorCounts).length ? 
  `\n... and ${Object.keys(vendorCounts).length - sortedVendors.length} more vendors` : ''}`;

      Alert.alert('Vendor Breakdown', vendorMessage, [{ text: 'OK' }]);
    } catch (error) {
      console.error('Error showing vendor breakdown:', error);
      Alert.alert('Error', 'Failed to show vendor breakdown');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await authService.logout();
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'Invalid Date';
    }
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
            onChangeText={text => setSearchQuery(text)}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity
              style={styles.clearSearch}
              onPress={() => setSearchQuery('')}
            >
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

  const renderItem = ({ item, index }) => (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => handleItemPress(item)}
        onLongPress={() => handleItemLongPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.image_url }}
            style={styles.itemImage}
            resizeMode="cover"
          />
          <View style={styles.itemIdBadge}>
            <Text style={styles.itemIdText}>{item.item_id}</Text>
          </View>
        </View>
        
        <View style={styles.itemDetails}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.itemVendor} numberOfLines={1}>
            {item.vendor}
          </Text>
          <Text style={styles.itemDate}>
            {formatDate(item.manufacture_date)}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="cube-outline" size={80} color="#cbd5e1" />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No items found' : 'No items yet'}
      </Text>
      <Text style={styles.emptyDescription}>
        {searchQuery 
          ? `Try adjusting your search terms` 
          : 'Start building your inventory by adding your first item'
        }
      </Text>
      {!searchQuery && (
        <TouchableOpacity style={styles.emptyAddButton} onPress={handleAddItem}>
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.emptyAddButtonText}>Add First Item</Text>
        </TouchableOpacity>
      )}
    </View>
  );

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

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContainer}
        columnWrapperStyle={filteredItems.length > 0 ? styles.row : null}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
  
      {/* Dropdown Menu - moved outside FlatList for proper z-index */}
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
          </View>
        </>
      )}
    </SafeAreaView>
  );  
}; 

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  header: {
    paddingVertical: 20,
    marginBottom: 16,
    position: 'relative',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 16,
    color: '#64748b',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  dropdown: {
    position: 'absolute',
    top: 76, // Adjusted positioning
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44, // Ensures minimum touch target
  },
  dropdownText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1e293b',
  },
  clearSearch: {
    padding: 4,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  statsContainer: {
    paddingHorizontal: 4,
  },
  statsText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  row: {
    justifyContent: 'space-between',
  },
  itemContainer: {
    width: ITEM_WIDTH,
    marginBottom: 16,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  imageContainer: {
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: ITEM_WIDTH * 0.8,
    backgroundColor: '#f1f5f9',
  },
  itemIdBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  itemIdText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  itemDetails: {
    padding: 16,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
    lineHeight: 20,
  },
  itemVendor: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 6,
  },
  itemDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    minHeight: 400,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#2563eb',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyAddButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default InventoryScreen;