// src/screens/StatisticsScreen.js
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import inventoryService from '../services/inventoryService';

/** Format date to "MMM D, YYYY" */
const fmt = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

/** Compute all stats we want to show */
const computeStats = (items) => {
  if (!items || items.length === 0) {
    return {
      totalItems: 0,
      uniqueVendors: 0,
      itemsThisMonth: 0,
      itemsThisWeek: 0,
      oldestItem: null,
      newestItem: null,
      topVendor: null,
      topVendorCount: 0,
      avgItemAge: 0,
      vendorCounts: [],
    };
  }

  const totalItems = items.length;
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const itemsThisMonth = items.filter((it) => new Date(it.created_at || it.manufacture_date) >= thisMonth).length;
  const itemsThisWeek = items.filter((it) => new Date(it.created_at || it.manufacture_date) >= thisWeek).length;

  const byMfg = [...items].sort((a, b) => new Date(a.manufacture_date) - new Date(b.manufacture_date));
  const oldestItem = byMfg[0];
  const newestItem = byMfg[byMfg.length - 1];

  const vendors = new Set(items.map((it) => it.vendor).filter(Boolean));
  const uniqueVendors = vendors.size;

  const counts = {};
  items.forEach((it) => {
    const v = it.vendor || 'Unknown';
    counts[v] = (counts[v] || 0) + 1;
  });
  const vendorCounts = Object.entries(counts)
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((a, b) => b.count - a.count);

  const topVendor = vendorCounts[0]?.vendor ?? null;
  const topVendorCount = vendorCounts[0]?.count ?? 0;

  const totalAgeDays = items.reduce((sum, it) => {
    const age = (now - new Date(it.manufacture_date)) / (1000 * 60 * 60 * 24);
    return sum + (Number.isFinite(age) ? Math.max(0, age) : 0);
  }, 0);
  const avgItemAge = Math.round(totalAgeDays / totalItems);

  return {
    totalItems,
    uniqueVendors,
    itemsThisMonth,
    itemsThisWeek,
    oldestItem,
    newestItem,
    topVendor,
    topVendorCount,
    avgItemAge,
    vendorCounts,
  };
};

export default function StatisticsScreen({ navigation, route }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  // Prefer items passed via navigation; otherwise read from storage
  useEffect(() => {
    const load = async () => {
      try {
        if (route?.params?.items && Array.isArray(route.params.items)) {
          setItems(route.params.items);
        } else {
          const res = await inventoryService.getItems();
          setItems(res.success ? res.data : []);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [route?.params?.items]);

  const stats = useMemo(() => computeStats(items), [items]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.muted}>Loading statistics…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#475569" />
        </TouchableOpacity>
        <Text style={styles.title}>Inventory Statistics</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* KPI Cards */}
        <View style={styles.grid}>
          <Kpi label="Total Items" value={stats.totalItems} />
          <Kpi label="Unique Vendors" value={stats.uniqueVendors} />
          <Kpi label="Added This Month" value={stats.itemsThisMonth} />
          <Kpi label="Added This Week" value={stats.itemsThisWeek} />
          <Kpi label="Avg Age (days)" value={stats.avgItemAge} />
          <Kpi label="Top Vendor" value={stats.topVendor || '—'} />
        </View>

        {/* Oldest / Newest */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Item Timeline</Text>
          <Row label="Oldest" value={`${stats.oldestItem?.title ?? '—'}  (${fmt(stats.oldestItem?.manufacture_date)})`} />
          <Row label="Newest" value={`${stats.newestItem?.title ?? '—'}  (${fmt(stats.newestItem?.manufacture_date)})`} />
        </View>

        {/* Vendor Breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vendor Breakdown</Text>
          {stats.vendorCounts.slice(0, 10).map((v, i) => (
            <Row key={v.vendor} label={`${i + 1}. ${v.vendor}`} value={`${v.count} item${v.count > 1 ? 's' : ''}`} />
          ))}
          {stats.vendorCounts.length === 0 && <Text style={styles.muted}>No vendors yet.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ label, value }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{String(value)}</Text>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 28 },
  muted: { color: '#94a3b8', marginTop: 8 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  backBtn: { padding: 8, borderRadius: 8, backgroundColor: '#f1f5f9' },
  title: { fontSize: 18, fontWeight: '700', color: '#1e293b' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: {
    width: '48%', backgroundColor: '#fff', borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  kpiLabel: { color: '#64748b', fontSize: 12, marginBottom: 6, fontWeight: '600' },
  kpiValue: { color: '#0f172a', fontSize: 20, fontWeight: '800' },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { color: '#334155', fontWeight: '600' },
  rowValue: { color: '#0f172a' },
});
