import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, SectionList, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';
import { fetchProducts, fetchCategories, Product, Category } from '../lib/api';
import { useCart } from '../context/CartContext';

const { width: SW } = Dimensions.get('window');
const SIDEBAR_W = 88;
const CARD_W = (SW - SIDEBAR_W - 12 - 8) / 2;   // 2 cols in right panel

interface Props {
  route?: { params?: { categoryId?: string; categoryName?: string; initialSubCatId?: string } };
  navigation?: any;
}

function ProductCard({
  item, wishlist, toggleWishlist, cart, add, remove,
}: {
  item: Product;
  wishlist: Set<string>;
  toggleWishlist: (id: string) => void;
  cart: Record<string, number>;
  add: (id: string) => void;
  remove: (id: string) => void;
}) {
  const qty = cart[item.id] || 0;
  const primaryImg = item.images?.find(i => i.is_primary)?.image_url || item.images?.[0]?.image_url;
  const displayPrice = item.sale_price ? Number(item.sale_price) : Number(item.price);
  const originalPrice = Number(item.price);
  const discount = item.sale_price
    ? Math.round(((originalPrice - Number(item.sale_price)) / originalPrice) * 100) : 0;

  return (
    <View style={pc.card}>
      {discount > 0 && (
        <View style={pc.badge}><Text style={pc.badgeText}>{discount}% OFF</Text></View>
      )}
      <TouchableOpacity style={pc.wishBtn} onPress={() => toggleWishlist(item.id)}>
        <Ionicons
          name={wishlist.has(item.id) ? 'heart' : 'heart-outline'}
          size={16}
          color={wishlist.has(item.id) ? COLORS.red : COLORS.grayLight}
        />
      </TouchableOpacity>
      <View style={pc.imgWrap}>
        {primaryImg
          ? <Image source={{ uri: primaryImg }} style={pc.img} resizeMode="contain" />
          : <Ionicons name="cube-outline" size={36} color={COLORS.grayLight} />}
      </View>
      <Text style={pc.name} numberOfLines={2}>{item.name}</Text>
      <View style={pc.priceRow}>
        <Text style={pc.price}>Rs.{displayPrice}</Text>
        {item.sale_price && <Text style={pc.mrp}>Rs.{originalPrice}</Text>}
      </View>
      {qty === 0 ? (
        <TouchableOpacity style={pc.addBtn} onPress={() => add(item.id)} activeOpacity={0.8}>
          <Ionicons name="add" size={14} color={COLORS.primary} />
          <Text style={pc.addBtnText}>ADD</Text>
        </TouchableOpacity>
      ) : (
        <View style={pc.qtyRow}>
          <TouchableOpacity style={pc.qtyBtn} onPress={() => remove(item.id)}>
            <Ionicons name="remove" size={15} color="#fff" />
          </TouchableOpacity>
          <Text style={pc.qtyCount}>{qty}</Text>
          <TouchableOpacity style={pc.qtyBtn} onPress={() => add(item.id)}>
            <Ionicons name="add" size={15} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function CategoryDetailScreen({ route, navigation }: Props) {
  const categoryId       = route?.params?.categoryId       ?? '';
  const categoryName     = route?.params?.categoryName     ?? 'Category';
  const initialSubCatId  = route?.params?.initialSubCatId  ?? null;
  const [allCategories, setAllCategories]   = useState<Category[]>([]);
  const [products, setProducts]             = useState<Product[]>([]);
  const [activeCatId, setActiveCatId]       = useState<string | null>(initialSubCatId);
  const [loading, setLoading]               = useState(true);
  const { addItem, removeItem, getQty, totalQty: cartCount } = useCart();
  const [wishlist, setWishlist]             = useState<Set<string>>(new Set());
  const sectionListRef                      = useRef<SectionList>(null);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const [cats, prods] = await Promise.all([fetchCategories(), fetchProducts()]);
    setAllCategories(cats);
    setProducts(prods);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Sub-categories of the tapped parent
  const subCats = allCategories.filter(c => c.parent_id === categoryId);
  // If the categoryId itself is a leaf (no children), treat it as the target
  const leafCat = subCats.length === 0
    ? allCategories.find(c => c.id === categoryId)
    : null;

  // Also include an "All" pseudo entry
  const sidebarItems: (Category & { isAll?: boolean })[] = [
    { id: '__all__', name: 'All', slug: 'all', product_count: products.length, isAll: true } as any,
    ...subCats,
  ];
  const selectedId = activeCatId ?? '__all__';

  // Slug set for the current parent's sub-categories (used by "All" filter)
  const subCatSlugs = new Set(subCats.map(s => s.slug));

  // Products for selected sidebar item
  const visibleProducts = selectedId === '__all__'
    ? leafCat
      ? products.filter(p => p.category?.slug === leafCat.slug)          // leaf: exact match
      : products.filter(p => p.category?.slug && subCatSlugs.has(p.category.slug)) // parent: any child
    : products.filter(p => p.category?.slug === subCats.find(s => s.id === selectedId)?.slug);

  const addToCart    = (id: string) => {
    const product = products.find(p => p.id === id);
    if (product) addItem(product);
  };
  const removeFromCart = (id: string) => removeItem(id);
  const toggleWishlist = (id: string) =>
    setWishlist(w => { const next = new Set(w); next.has(id) ? next.delete(id) : next.add(id); return next; });

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{categoryName}</Text>
        <TouchableOpacity style={s.cartBtn} onPress={() => navigation.navigate('Cart')}>
          <Ionicons name="cart-outline" size={22} color={COLORS.dark} />
          {cartCount > 0 && (
            <View style={s.cartBadge}><Text style={s.cartBadgeText}>{cartCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loadingWrap}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <View style={s.body}>
          {/* Left sidebar */}
          <View style={s.sidebar}>
            <FlatList
              data={sidebarItems}
              keyExtractor={i => i.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
              renderItem={({ item }) => {
                const active = item.id === selectedId;
                return (
                  <TouchableOpacity
                    style={[s.sideItem, active && s.sideItemActive]}
                    onPress={() => setActiveCatId(item.isAll ? null : item.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[s.sideImgWrap, active && s.sideImgWrapActive]}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={s.sideImg} resizeMode="contain" />
                      ) : (
                        <Ionicons name="grid-outline" size={22} color={active ? COLORS.primary : COLORS.grayLight} />
                      )}
                    </View>
                    <Text style={[s.sideName, active && s.sideNameActive]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {active && <View style={s.activeBar} />}
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
                <Text style={s.emptyText}>No products in this category</Text>
              </View>
            }
            renderItem={({ item }) => (
              <ProductCard
                item={item}
                wishlist={wishlist}
                toggleWishlist={toggleWishlist}
                cart={{ [item.id]: getQty(item.id) }}
                add={addToCart}
                remove={removeFromCart}
              />
            )}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const pc = StyleSheet.create({
  card: { width: CARD_W, backgroundColor: COLORS.white, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10, position: 'relative' },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: COLORS.greenLight, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, zIndex: 2 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#15803d' },
  wishBtn: { position: 'absolute', top: 8, right: 8, zIndex: 2, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 12, padding: 4 },
  imgWrap: { width: '100%', height: 100, backgroundColor: COLORS.bg, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  img: { width: '100%', height: 100, borderRadius: 10 },
  name: { fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 4, lineHeight: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 5 },
  price: { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  mrp: { fontSize: 11, color: COLORS.grayLight, textDecorationLine: 'line-through' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingVertical: 6, borderWidth: 1.5, borderColor: COLORS.primary, gap: 3 },
  addBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 3, paddingVertical: 3 },
  qtyBtn: { width: 26, height: 26, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  qtyCount: { color: '#fff', fontSize: 13, fontWeight: '800', minWidth: 18, textAlign: 'center' },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: '#fff' },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: COLORS.dark },
  cartBtn: { padding: 4, position: 'relative' },
  cartBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: COLORS.primary, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { flex: 1, flexDirection: 'row' },
  sidebar: { width: SIDEBAR_W, backgroundColor: COLORS.bg, borderRightWidth: 1, borderRightColor: COLORS.border },
  sideItem: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, position: 'relative' },
  sideItemActive: { backgroundColor: '#fff' },
  sideImgWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 5, borderWidth: 1.5, borderColor: COLORS.border },
  sideImgWrapActive: { borderColor: COLORS.primary },
  sideImg: { width: 44, height: 44, borderRadius: 22 },
  sideName: { fontSize: 10, color: COLORS.gray, textAlign: 'center', fontWeight: '500', lineHeight: 13 },
  sideNameActive: { color: COLORS.primary, fontWeight: '700' },
  activeBar: { position: 'absolute', left: 0, top: '25%', bottom: '25%', width: 3, backgroundColor: COLORS.primary, borderRadius: 2 },
  productList: { padding: 8 },
  colWrapper: { justifyContent: 'space-between', paddingHorizontal: 2 },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 13, color: COLORS.grayLight, fontWeight: '600' },
});
