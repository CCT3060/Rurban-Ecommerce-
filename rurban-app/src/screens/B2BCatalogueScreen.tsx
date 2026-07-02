import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../lib/theme';
import { API_BASE } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNavbar } from '../context/NavbarContext';

export type CatalogueProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price: number;
  custom_price: number;
  stock: number;
  sku: string | null;
  brand: string | null;
  avg_rating: number;
  review_count: number;
  image_url: string | null;
};

export type CatalogueCategory = {
  id: string;
  name: string;
  slug: string;
  products: CatalogueProduct[];
};

export function B2BProductCard({ item }: { item: CatalogueProduct }) {
  const navigation = useNavigation<any>();
  const { addItem, getQty, removeItem, setQty } = useCart();
  const qty = getQty(item.id);
  const [inputVal, setInputVal] = useState(String(qty));

  // Keep input in sync when qty changes externally
  React.useEffect(() => { setInputVal(String(qty)); }, [qty]);

  const productForCart = {
    id: item.id,
    name: item.name,
    slug: item.slug,
    price: item.price,
    sale_price: item.custom_price ?? item.sale_price ?? item.price,
    stock: 99999, // B2B: always allow ordering regardless of stock
    images: item.image_url ? [{ id: '0', image_url: item.image_url, is_primary: true }] : [],
    is_featured: false,
    is_trending: false,
    is_new_arrival: false,
  };

  const commitInput = () => {
    const n = parseInt(inputVal, 10);
    if (!isNaN(n) && n >= 0) {
      setQty(item.id, n, productForCart);
    } else {
      setInputVal(String(qty));
    }
  };

  return (
    <View style={card.container}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => navigation.navigate('ProductDetail', { product: productForCart })}
      >
        <View style={card.imageWrapper}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={card.image} resizeMode="cover" />
          ) : (
            <View style={card.imagePlaceholder}>
              <Ionicons name="cube-outline" size={36} color={COLORS.grayLight} />
            </View>
          )}
        </View>
        <View style={card.info}>
          <Text style={card.name} numberOfLines={3}>{item.name}</Text>
          {item.brand ? <Text style={card.brand}>{item.brand}</Text> : null}
          <View style={card.priceRow}>
            <Text style={card.customPrice}>₹{(item.custom_price ?? item.sale_price ?? item.price).toFixed(2)}</Text>
          </View>
          {item.price > (item.custom_price ?? item.sale_price ?? item.price) && (
            <Text style={card.mrp}>MRP {item.price.toFixed(2)}</Text>
          )}
          {item.avg_rating > 0 && (
            <View style={card.ratingRow}>
              <Text style={card.ratingText}>★ {item.avg_rating.toFixed(1)}</Text>
              {item.review_count > 0 && (
                <Text style={card.ratingCount}> ({item.review_count})</Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Add / qty controls */}
      <View style={card.cartRow}>
        {qty === 0 ? (
          <TouchableOpacity
            style={card.addBtn}
            onPress={() => { addItem(productForCart); setInputVal('1'); }}
          >
            <Text style={card.addBtnText}>Add</Text>
          </TouchableOpacity>
        ) : (
          <View style={card.qtyRow}>
            <TouchableOpacity style={card.qtyBtn} onPress={() => removeItem(item.id)}>
              <Ionicons name="remove" size={16} color={COLORS.primary} />
            </TouchableOpacity>
            <TextInput
              style={card.qtyInput}
              value={inputVal}
              onChangeText={setInputVal}
              onBlur={commitInput}
              onSubmitEditing={commitInput}
              keyboardType="number-pad"
              returnKeyType="done"
              selectTextOnFocus
            />
            <TouchableOpacity
              style={card.qtyBtn}
              onPress={() => addItem(productForCart)}
            >
              <Ionicons name="add" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export default function B2BCatalogueScreen() {
  const { token } = useAuth();
  const { totalQty } = useCart();
  const { setNavVisible } = useNavbar();
  const lastScrollY = useRef(0);
  const [categories, setCategories] = useState<CatalogueCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: CatalogueProduct[] = [];
    for (const cat of categories) {
      for (const p of cat.products) {
        if (
          p.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q))
        ) {
          hits.push(p);
        }
      }
    }
    return hits;
  }, [searchQuery, categories]);

  // Reset navbar when leaving this screen
  useFocusEffect(
    useCallback(() => {
      return () => setNavVisible(true);
    }, [setNavVisible])
  );

  const handleScroll = useCallback((event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;
    if (diff > 8 && currentY > 50) {
      setNavVisible(false);
    } else if (diff < -8 || currentY <= 50) {
      setNavVisible(true);
    }
    lastScrollY.current = currentY;
  }, [setNavVisible]);

  const fetchCatalogue = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/mobile/catalogue`, {
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
      // ignore network errors silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchCatalogue();
  }, [fetchCatalogue]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchCatalogue();
  };

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null;

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (categories.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons name="cube-outline" size={56} color={COLORS.grayLight} />
        <Text style={styles.emptyTitle}>No products assigned yet</Text>
        <Text style={styles.emptySubtitle}>
          Your account manager will assign products once available.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {isSearching ? (
          <View style={styles.searchBar}>
            <TouchableOpacity
              onPress={() => { setIsSearching(false); setSearchQuery(''); }}
              style={{ padding: 4 }}
            >
              <Ionicons name="arrow-back" size={20} color="#111827" />
            </TouchableOpacity>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
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
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>My Catalogue</Text>
              <Text style={styles.headerSub}>Your exclusive prices</Text>
            </View>
            <TouchableOpacity onPress={() => setIsSearching(true)} style={styles.searchIconBtn}>
              <Ionicons name="search" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.body}>
        {isSearching && searchQuery.trim().length > 0 ? (
          /* ── Search results (full width, no sidebar) ── */
          <FlatList
            key="search-results"
            style={styles.productList}
            data={searchResults}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={[styles.listContent, totalQty > 0 && styles.listContentWithCart]}
            renderItem={({ item }) => <B2BProductCard item={item} />}
            ListEmptyComponent={
              <View style={[styles.centered, { paddingTop: 48 }]}>
                <Ionicons name="search-outline" size={52} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No results</Text>
                <Text style={styles.emptySubtitle}>No products match "{searchQuery}"</Text>
              </View>
            }
          />
        ) : (
          <>
            {/* Category sidebar */}
            <ScrollView
              style={styles.sidebar}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sidebarContent}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catItem, activeCategoryId === cat.id && styles.catItemActive]}
                  onPress={() => setActiveCategoryId(cat.id)}
                >
                  <Text
                    style={[styles.catName, activeCategoryId === cat.id && styles.catNameActive]}
                    numberOfLines={2}
                  >
                    {cat.name}
                  </Text>
                  <Text style={styles.catCount}>{cat.products.length}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Products grid */}
            <FlatList
              key="b2b-products"
              style={styles.productList}
              data={activeCategory?.products ?? []}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={[styles.listContent, totalQty > 0 && styles.listContentWithCart]}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              renderItem={({ item }) => <B2BProductCard item={item} />}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={styles.emptySubtitle}>No products in this category.</Text>
                </View>
              }
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchIconBtn: { padding: 8, borderRadius: 8, backgroundColor: '#F3F4F6' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 10, gap: 6,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 9 },
  body: { flex: 1, flexDirection: 'row' },
  sidebar: {
    maxWidth:100,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  sidebarContent: { paddingVertical: 4 },
  catItem: {
    paddingHorizontal: 4,
    paddingVertical: 10,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  catItemActive: {
    backgroundColor: '#F0FDF4',
    borderLeftColor: COLORS.primary,
  },
  catName: { fontSize: 12, color: '#6B7280', textAlign: 'center', fontWeight: '500' },
  catNameActive: { color: COLORS.primary, fontWeight: '700' },
  catCount: { fontSize: 9, color: '#9CA3AF', marginTop: 1 },
  productList: { flex: 1 },
  listContent: { padding: 6 },
  listContentWithCart: { paddingBottom: 90 },
  row: { justifyContent: 'space-between', paddingHorizontal: 2 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center', lineHeight: 20 },
});

const card = StyleSheet.create({
  container: {
    flex: 1,
    margin: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  imageWrapper: { width: '100%', height: 110, backgroundColor: '#F9FAFB' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  outOfStockBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  outOfStockText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  info: { padding: 6 },
  name: { fontSize: 11, fontWeight: '600', color: '#111827', lineHeight: 15 },
  brand: { fontSize: 9, color: '#9CA3AF', marginTop: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  customPrice: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  mrp: { fontSize: 10, color: '#9CA3AF', textDecorationLine: 'line-through', marginTop: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  ratingText: { fontSize: 10, color: '#F59E0B', fontWeight: '700' },
  ratingCount: { fontSize: 10, color: '#9CA3AF' },
  cartRow: { paddingHorizontal: 6, paddingBottom: 6 },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  addBtnDisabled: { backgroundColor: '#E5E7EB' },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    overflow: 'hidden',
  },
  qtyBtn: { padding: 6, alignItems: 'center', justifyContent: 'center', flex: 1 },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    minWidth: 36,
  },
});
