import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';
import { Product, Category, fetchCategories } from '../lib/api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

type ListType = 'featured' | 'trending' | 'popular' | 'new_arrivals' | 'all';

const { width: SW } = Dimensions.get('window');
const SIDEBAR_W = 88;
const CARD_W = (SW - SIDEBAR_W - 12 - 8) / 2;

export default function AllProductsScreen({ navigation, route }: { navigation: any; route: any }) {
  const { type, title, products = [] }: { type: ListType; title: string; products: Product[] } =
    route.params ?? { type: 'all', title: 'Products', products: [] };

  const { addItem, removeItem, getQty, totalQty: cartCount } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const insets = useSafeAreaInsets();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await fetchCategories();
      setAllCategories(cats);
    } catch (_) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  // Type-filtered base list
  const typeFiltered = useMemo(() => {
    switch (type) {
      case 'featured':     return products.filter(p => p.is_featured);
      case 'trending':     return products.filter(p => p.is_trending);
      case 'new_arrivals': return products.filter(p => p.is_new_arrival);
      case 'popular':
        return [...products].sort(
          (a, b) => (b.review_count ?? 0) - (a.review_count ?? 0) || (b.avg_rating ?? 0) - (a.avg_rating ?? 0)
        );
      default: return [...products];
    }
  }, [type, products]);

  // Sidebar: categories that appear in the current type-filtered list
  const sidebarItems = useMemo(() => {
    const slugsInList = new Set(
      typeFiltered.map(p => p.category?.slug).filter(Boolean) as string[]
    );
    return allCategories.filter(c => slugsInList.has(c.slug));
  }, [typeFiltered, allCategories]);

  // Products shown in right panel
  const visibleProducts = useMemo(() => {
    if (activeCatId === null) return typeFiltered;
    const cat = allCategories.find(c => c.id === activeCatId);
    if (!cat) return typeFiltered;
    return typeFiltered.filter(p => p.category?.slug === cat.slug);
  }, [typeFiltered, activeCatId, allCategories]);

  const selectedId = activeCatId ?? '__all__';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        <TouchableOpacity style={s.cartBtn} onPress={() => navigation.navigate('Cart')}>
          <Ionicons name="cart-outline" size={22} color={COLORS.dark} />
          {cartCount > 0 && (
            <View style={s.cartBadge}><Text style={s.cartBadgeText}>{cartCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <View style={s.body}>
          {/* Left sidebar */}
          <View style={s.sidebar}>
            <FlatList
              data={sidebarItems}
              keyExtractor={i => i.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
              ListHeaderComponent={
                <TouchableOpacity
                  style={[s.sideItem, selectedId === '__all__' && s.sideItemActive]}
                  onPress={() => setActiveCatId(null)}
                  activeOpacity={0.75}
                >
                  {selectedId === '__all__' && <View style={s.activeBar} />}
                  <View style={[s.sideImgWrap, selectedId === '__all__' && s.sideImgWrapActive]}>
                    <Ionicons name="grid-outline" size={22} color={selectedId === '__all__' ? COLORS.primary : COLORS.grayLight} />
                  </View>
                  <Text style={[s.sideName, selectedId === '__all__' && s.sideNameActive]}>All</Text>
                </TouchableOpacity>
              }
              renderItem={({ item }) => {
                const active = item.id === selectedId;
                return (
                  <TouchableOpacity
                    style={[s.sideItem, active && s.sideItemActive]}
                    onPress={() => setActiveCatId(active ? null : item.id)}
                    activeOpacity={0.75}
                  >
                    {active && <View style={s.activeBar} />}
                    <View style={[s.sideImgWrap, active && s.sideImgWrapActive]}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={s.sideImg} resizeMode="contain" />
                      ) : (
                        <Ionicons name="pricetag-outline" size={22} color={active ? COLORS.primary : COLORS.grayLight} />
                      )}
                    </View>
                    <Text style={[s.sideName, active && s.sideNameActive]} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {/* Right product grid */}
          <FlatList
            data={visibleProducts}
            keyExtractor={i => i.id}
            numColumns={2}
            columnWrapperStyle={s.colWrapper}
            contentContainerStyle={[s.productList, { paddingBottom: insets.bottom + 90 }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Ionicons name="cube-outline" size={48} color={COLORS.grayLight} style={{ marginBottom: 12 }} />
                <Text style={s.emptyText}>No products found</Text>
              </View>
            }
            renderItem={({ item }) => {
              const img = item.images?.find(i => i.is_primary)?.image_url ?? item.images?.[0]?.image_url;
              const price = item.sale_price ? Number(item.sale_price) : Number(item.price);
              const original = Number(item.price);
              const discount = item.sale_price
                ? Math.round(((original - price) / original) * 100)
                : 0;
              const qty = getQty(item.id);
              const wishlisted = isWishlisted(item.id);
              const isOutOfStock = item.stock <= 0;
              const atStockLimit = qty >= item.stock;

              return (
                <TouchableOpacity
                  style={[s.card, { width: CARD_W }]}
                  activeOpacity={0.92}
                  onPress={() => navigation.navigate('ProductDetail', { product: item })}
                >
                  {discount > 0 && (
                    <View style={s.discBadge}><Text style={s.discText}>{discount}% OFF</Text></View>
                  )}
                  <TouchableOpacity style={s.heartBtn} onPress={() => toggle(item)}>
                    <Ionicons
                      name={wishlisted ? 'heart' : 'heart-outline'}
                      size={15}
                      color={wishlisted ? COLORS.red : COLORS.grayLight}
                    />
                  </TouchableOpacity>
                  <View style={s.imgWrap}>
                    {img
                      ? <Image source={{ uri: img }} style={s.img} resizeMode="contain" />
                      : <Ionicons name="cube-outline" size={36} color={COLORS.grayLight} />}
                  </View>
                  <Text style={s.name} numberOfLines={2}>{item.name}</Text>
                  <View style={s.priceRow}>
                    <Text style={s.price}>Rs.{price}</Text>
                    {item.sale_price && <Text style={s.mrp}>Rs.{original}</Text>}
                  </View>
                  {(item.avg_rating ?? 0) > 0 && (
                    <View style={s.ratingRow}>
                      <View style={s.ratingBadge}>
                        <Text style={s.ratingText}>{(item.avg_rating ?? 0).toFixed(1)} ★</Text>
                      </View>
                      {(item.review_count ?? 0) > 0 && (
                        <Text style={s.ratingCount}>({item.review_count})</Text>
                      )}
                    </View>
                  )}
                  {isOutOfStock ? (
                    <View style={[s.addBtn, s.outOfStockBtn]}>
                      <Text style={s.outOfStockText}>Out of Stock</Text>
                    </View>
                  ) : qty === 0 ? (
                    <TouchableOpacity style={s.addBtn} onPress={() => addItem(item)} activeOpacity={0.8}>
                      <Ionicons name="add" size={14} color={COLORS.primary} />
                      <Text style={s.addBtnText}>ADD</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={s.qtyRow}>
                      <TouchableOpacity style={s.qtyBtn} onPress={() => removeItem(item.id)}>
                        <Ionicons name="remove" size={14} color="#fff" />
                      </TouchableOpacity>
                      <Text style={s.qtyCount}>{qty}</Text>
                      <TouchableOpacity
                        style={[s.qtyBtn, atStockLimit && s.qtyBtnDisabled]}
                        onPress={() => { if (!atStockLimit) addItem(item); }}
                        activeOpacity={atStockLimit ? 1 : 0.8}
                      >
                        <Ionicons name="add" size={14} color={atStockLimit ? 'rgba(255,255,255,0.3)' : '#fff'} />
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark, flex: 1, textAlign: 'center' },
  cartBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  cartBadge: {
    position: 'absolute', top: 2, right: 2, backgroundColor: COLORS.primary,
    borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: SIDEBAR_W, backgroundColor: COLORS.white,
    borderRightWidth: 1, borderRightColor: COLORS.border,
  },
  sideItem: {
    alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, position: 'relative',
  },
  sideItemActive: { backgroundColor: COLORS.primaryLight },
  activeBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    backgroundColor: COLORS.primary, borderRadius: 2,
  },
  sideImgWrap: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.bg,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    marginBottom: 6, borderWidth: 1.5, borderColor: COLORS.border,
  },
  sideImgWrapActive: { borderColor: COLORS.primary },
  sideImg: { width: 48, height: 48 },
  sideName: { fontSize: 10, color: COLORS.gray, textAlign: 'center', fontWeight: '600', lineHeight: 13 },
  sideNameActive: { color: COLORS.primary, fontWeight: '800' },
  productList: { padding: 8 },
  colWrapper: { gap: 8, marginBottom: 8 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 10, position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  discBadge: {
    position: 'absolute', top: 6, left: 6, backgroundColor: COLORS.greenLight,
    borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, zIndex: 1,
  },
  discText: { fontSize: 9, fontWeight: '800', color: '#15803d' },
  heartBtn: {
    position: 'absolute', top: 6, right: 6, width: 26, height: 26,
    borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center', zIndex: 2,
  },
  imgWrap: {
    width: '100%', aspectRatio: 1, backgroundColor: COLORS.bg, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6, overflow: 'hidden',
  },
  img: { width: '100%', height: '100%' },
  name: { fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 4, lineHeight: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  price: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  mrp: { fontSize: 11, color: COLORS.grayLight, textDecorationLine: 'line-through' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primaryLight, borderRadius: 18, paddingVertical: 6,
    borderWidth: 1.5, borderColor: COLORS.primary, gap: 3,
  },
  addBtnText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primary, borderRadius: 18, paddingHorizontal: 4, paddingVertical: 4,
  },
  qtyBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  qtyCount: { color: '#fff', fontSize: 12, fontWeight: '800', minWidth: 16, textAlign: 'center' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 4 },
  ratingBadge: { backgroundColor: '#059669', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  ratingText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  ratingCount: { fontSize: 9, color: COLORS.grayLight },
  outOfStockBtn: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
  outOfStockText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: COLORS.grayLight, fontWeight: '600' },
});
