import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../lib/theme';
import { API_BASE } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

type CatalogueProduct = {
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

type CatalogueCategory = {
  id: string;
  name: string;
  slug: string;
  products: CatalogueProduct[];
};

function B2BProductCard({ item }: { item: CatalogueProduct }) {
  const navigation = useNavigation<any>();
  const { addItem, getQty, removeItem } = useCart();
  const qty = getQty(item.id);
  const isOutOfStock = item.stock <= 0;

  const productForCart = {
    id: item.id,
    name: item.name,
    slug: item.slug,
    price: item.price,
    sale_price: item.custom_price, // use custom price as sale price
    stock: item.stock,
    images: item.image_url ? [{ id: '0', image_url: item.image_url, is_primary: true }] : [],
    is_featured: false,
    is_trending: false,
    is_new_arrival: false,
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
          {isOutOfStock && (
            <View style={card.outOfStockBadge}>
              <Text style={card.outOfStockText}>Out of Stock</Text>
            </View>
          )}
        </View>
        <View style={card.info}>
          <Text style={card.name} numberOfLines={3}>{item.name}</Text>
          {item.brand ? <Text style={card.brand}>{item.brand}</Text> : null}
          <View style={card.priceRow}>
            <Text style={card.customPrice}>₹{item.custom_price.toFixed(2)}</Text>
          </View>
          {item.price > item.custom_price && (
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
            style={[card.addBtn, isOutOfStock && card.addBtnDisabled]}
            onPress={() => !isOutOfStock && addItem(productForCart)}
            disabled={isOutOfStock}
          >
            <Text style={card.addBtnText}>{isOutOfStock ? 'Out of Stock' : 'Add'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={card.qtyRow}>
            <TouchableOpacity style={card.qtyBtn} onPress={() => removeItem(item.id)}>
              <Ionicons name="remove" size={16} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={card.qtyText}>{qty}</Text>
            <TouchableOpacity
              style={[card.qtyBtn, qty >= item.stock && card.qtyBtnDisabled]}
              onPress={() => qty < item.stock && addItem(productForCart)}
              disabled={qty >= item.stock}
            >
              <Ionicons name="add" size={16} color={qty >= item.stock ? COLORS.grayLight : COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export default function B2BCatalogueScreen() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<CatalogueCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

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
        <Text style={styles.headerTitle}>My Catalogue</Text>
        <Text style={styles.headerSub}>Your exclusive prices</Text>
      </View>

      <View style={styles.body}>
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
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => <B2BProductCard item={item} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptySubtitle}>No products in this category.</Text>
            </View>
          }
        />
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
  qtyText: { fontSize: 13, fontWeight: '800', color: '#111827', flex: 1, textAlign: 'center' },
});
