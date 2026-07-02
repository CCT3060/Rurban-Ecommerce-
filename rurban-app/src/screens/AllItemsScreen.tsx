import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, FlatList, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';
import { API_BASE } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { CatalogueProduct, CatalogueCategory, B2BProductCard } from './B2BCatalogueScreen';

// â”€â”€â”€ Data helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type SectionHeader = { kind: 'header'; id: string; name: string; count: number };
type ProductRow    = { kind: 'products'; id: string; left: CatalogueProduct; right: CatalogueProduct | null };
type ListRow       = SectionHeader | ProductRow;

export default function AllItemsScreen() {
  const { token } = useAuth();
  const { totalQty } = useCart();
  const [categories, setCategories]             = useState<CatalogueCategory[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery]           = useState('');
  const [isSearching, setIsSearching]           = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const fetchCatalogue = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/mobile/all-products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as { data?: CatalogueCategory[]; error?: string };
      if (res.ok && json.data) {
        setCategories(json.data);
        if (json.data.length > 0 && !activeCategoryId) {
          setActiveCategoryId(json.data[0].id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void fetchCatalogue(); }, [fetchCatalogue]);

  const onRefresh = () => { setRefreshing(true); void fetchCatalogue(); };

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null;

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: CatalogueProduct[] = [];
    for (const cat of categories) {
      for (const p of cat.products) {
        if (
          p.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.sku  && p.sku.toLowerCase().includes(q))
        ) hits.push(p);
      }
    }
    return hits;
  }, [searchQuery, categories]);

  if (loading) {
    return (
      <SafeAreaView style={s.centered} edges={['top']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (categories.length === 0) {
    return (
      <SafeAreaView style={s.centered} edges={['top']}>
        <Ionicons name="cube-outline" size={56} color={COLORS.grayLight} />
        <Text style={s.emptyTitle}>No products assigned yet</Text>
        <Text style={s.emptySubtitle}>Your account manager will assign products once available.</Text>
      </SafeAreaView>
    );
  }

  const listContentStyle = [s.listContent, totalQty > 0 && s.listContentWithCart];

  return (
    <SafeAreaView style={s.root} edges={['top']}>

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <View style={s.header}>
        {isSearching ? (
          <View style={s.searchBar}>
            <TouchableOpacity
              onPress={() => { setIsSearching(false); setSearchQuery(''); }}
              style={{ padding: 4 }}
            >
              <Ionicons name="arrow-back" size={20} color="#111827" />
            </TouchableOpacity>
            <TextInput
              ref={searchInputRef}
              style={s.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search all products..."
              placeholderTextColor="#9CA3AF"
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerTitle}>All Items</Text>
              <Text style={s.headerSub}>Your exclusive prices</Text>
            </View>
            <TouchableOpacity onPress={() => setIsSearching(true)} style={s.searchIconBtn}>
              <Ionicons name="search" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* â”€â”€ Body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <View style={s.body}>

        {isSearching && searchQuery.trim().length > 0 ? (

          /* Search results â€” full width, no sidebar */
          <FlatList
            key="search-results"
            style={s.productList}
            data={searchResults}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={s.row}
            contentContainerStyle={listContentStyle}
            renderItem={({ item }) => <B2BProductCard item={item} />}
            ListEmptyComponent={
              <View style={[s.centered, { paddingTop: 48 }]}>
                <Ionicons name="search-outline" size={52} color="#D1D5DB" />
                <Text style={s.emptyTitle}>No results</Text>
                <Text style={s.emptySubtitle}>No products match "{searchQuery}"</Text>
              </View>
            }
          />

        ) : (
          <>
            {/* Left: category sidebar */}
            <ScrollView
              style={s.sidebar}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.sidebarContent}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.catItem, activeCategoryId === cat.id && s.catItemActive]}
                  onPress={() => setActiveCategoryId(cat.id)}
                >
                  <Text
                    style={[s.catName, activeCategoryId === cat.id && s.catNameActive]}
                    numberOfLines={2}
                  >
                    {cat.name}
                  </Text>
                  <Text style={s.catCount}>{cat.products.length}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Right: products grid */}
            <FlatList
              key="all-items-grid"
              style={s.productList}
              data={activeCategory?.products ?? []}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={s.row}
              contentContainerStyle={listContentStyle}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              renderItem={({ item }) => <B2BProductCard item={item} />}
              ListEmptyComponent={
                <View style={s.centered}>
                  <Text style={s.emptySubtitle}>No products in this category.</Text>
                </View>
              }
            />
          </>
        )}

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#F8FAFC' },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSub:    { fontSize: 12, color: '#6B7280', marginTop: 2 },
  searchIconBtn:{ padding: 8, borderRadius: 8, backgroundColor: '#F3F4F6' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 10, gap: 6,
  },
  searchInput:  { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 9 },
  body:         { flex: 1, flexDirection: 'row' },
  sidebar: {
    maxWidth: 100,
    backgroundColor: '#fff',
    borderRightWidth: 1, borderRightColor: '#E5E7EB',
  },
  sidebarContent: { paddingVertical: 4 },
  catItem: {
    paddingHorizontal: 4, paddingVertical: 10,
    alignItems: 'center',
    borderLeftWidth: 3, borderLeftColor: 'transparent',
  },
  catItemActive: { backgroundColor: '#F0FDF4', borderLeftColor: COLORS.primary },
  catName:       { fontSize: 12, color: '#6B7280', textAlign: 'center', fontWeight: '500' },
  catNameActive: { color: COLORS.primary, fontWeight: '700' },
  catCount:      { fontSize: 9, color: '#9CA3AF', marginTop: 1 },
  productList:  { flex: 1 },
  listContent:  { padding: 6 },
  listContentWithCart: { paddingBottom: 90 },
  row:          { justifyContent: 'space-between', paddingHorizontal: 2 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySubtitle:{ fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
