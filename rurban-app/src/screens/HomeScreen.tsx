import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView,
  TouchableOpacity, FlatList, Image, ActivityIndicator,
  Dimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

import { fetchBanners, fetchProducts, fetchCategories, Banner, Product, Category } from '../lib/api';
import { COLORS } from '../lib/theme';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

const { width: SW } = Dimensions.get('window');
const BANNER_W = SW - 32;

const CAT_BG = ['#E8F5E9','#FFF3E0','#E3F2FD','#FCE4EC','#F3E5F5','#E0F7FA','#FFFDE7','#F1F8E9'];

const FALLBACK_BANNERS = [
  { id: 'f1', title: 'Mega Savings!', subtitle: 'Up to 50% OFF on Groceries', bg: COLORS.primaryLight, textColor: COLORS.primary, image_url: '' },
  { id: 'f2', title: 'Fresh & Fast', subtitle: 'Delivered in 15 mins', bg: COLORS.greenLight, textColor: '#3A6B10', image_url: '' },
];

const OFFERS = [
  { id: '1', label: '50% OFF',       desc: 'On first order',    icon: 'gift-outline',    bg: '#FEF3C7' },
  { id: '2', label: 'Free Delivery', desc: 'Orders above 199',  icon: 'bicycle-outline', bg: '#E0F2FE' },
  { id: '3', label: '50 Cashback',   desc: 'Pay via UPI',       icon: 'cash-outline',    bg: '#F0FDF4' },
];

function ProductCard({ item, prefix = '' }: { item: Product; prefix?: string }) {
  const navigation = useNavigation<any>();
  const { addItem, removeItem, getQty } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const qty = getQty(item.id);
  const wishlisted = isWishlisted(item.id);
  const primaryImg = item.images?.find(i => i.is_primary)?.image_url || item.images?.[0]?.image_url;
  const displayPrice = item.sale_price ? Number(item.sale_price) : Number(item.price);
  const originalPrice = Number(item.price);
  const discount = item.sale_price
    ? Math.round(((originalPrice - Number(item.sale_price)) / originalPrice) * 100) : 0;
  const isOutOfStock = item.stock <= 0;
  const atStockLimit = qty >= item.stock;
  return (
    <View style={ps.card}>
      {discount > 0 && <View style={ps.discountBadge}><Text style={ps.discountText}>{discount}% OFF</Text></View>}
      <TouchableOpacity style={ps.wishBtn} onPress={() => toggle(item)}>
        <Ionicons
          name={wishlisted ? 'heart' : 'heart-outline'}
          size={14}
          color={wishlisted ? COLORS.red : COLORS.grayLight}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={ps.imgWrap}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('ProductDetail', { product: item })}
      >
        {primaryImg
          ? <Image source={{ uri: primaryImg }} style={ps.img} resizeMode="cover" />
          : <Ionicons name="cube-outline" size={40} color={COLORS.grayLight} />}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('ProductDetail', { product: item })} activeOpacity={0.85}>
        <Text style={ps.name} numberOfLines={2}>{item.name}</Text>
      </TouchableOpacity>
      <View style={ps.priceRow}>
        <Text style={ps.price}>Rs.{displayPrice}</Text>
        {item.sale_price && <Text style={ps.mrp}>Rs.{originalPrice}</Text>}
      </View>
      {(item.avg_rating ?? 0) > 0 && (
        <View style={ps.ratingRow}>
          <View style={ps.ratingBadge}>
            <Text style={ps.ratingText}>{(item.avg_rating ?? 0).toFixed(1)} ★</Text>
          </View>
          {(item.review_count ?? 0) > 0 && (
            <Text style={ps.ratingCount}>({item.review_count})</Text>
          )}
        </View>
      )}
      {isOutOfStock ? (
        <View style={[ps.addBtn, ps.outOfStockBtn]}>
          <Text style={ps.outOfStockText}>Out of Stock</Text>
        </View>
      ) : qty === 0 ? (
        <TouchableOpacity style={ps.addBtn} onPress={() => addItem(item)} activeOpacity={0.8}>
          <Ionicons name="add" size={14} color={COLORS.primary} />
          <Text style={ps.addBtnText}>ADD</Text>
        </TouchableOpacity>
      ) : (
        <View style={ps.qtyRow}>
          <TouchableOpacity style={ps.qtyBtn} onPress={() => removeItem(item.id)}>
            <Ionicons name="remove" size={16} color="#fff" />
          </TouchableOpacity>
          <Text style={ps.qtyCount}>{qty}</Text>
          <TouchableOpacity
            style={[ps.qtyBtn, atStockLimit && ps.qtyBtnDisabled]}
            onPress={() => { if (!atStockLimit) addItem(item); }}
            activeOpacity={atStockLimit ? 1 : 0.8}
          >
            <Ionicons name="add" size={16} color={atStockLimit ? 'rgba(255,255,255,0.3)' : '#fff'} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function HomeScreen({ navigation }: { navigation: any }) {
  const [search, setSearch] = useState('');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationLabel, setLocationLabel] = useState('Detecting...');
  const [locationLoading, setLocationLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const { totalQty } = useCart();
  const { ids: wishlistIds, items: wishlistItems } = useWishlist();

  // Detect user location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationLabel('Location denied');
          setLocationLoading(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const [place] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (place) {
          const parts = [place.name, place.subregion ?? place.city, place.region]
            .filter(Boolean)
            .slice(0, 2);
          setLocationLabel(parts.join(', ') || 'Current Location');
        } else {
          setLocationLabel('Current Location');
        }
      } catch {
        setLocationLabel('Location unavailable');
      } finally {
        setLocationLoading(false);
      }
    })();
  }, []);

  const loadData = useCallback(async () => {
    const [b, p, c] = await Promise.all([fetchBanners('hero'), fetchProducts(), fetchCategories()]);
    setBanners(b);
    setProducts(p);
    // Only show leaf categories (those that are children) on home screen
    const leafCats = c.filter(cat => cat.parent_id != null);
    setCategories(leafCats.length > 0 ? leafCats : c);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const displayBanners = banners.length > 0 ? banners : FALLBACK_BANNERS as any[];
  const featuredProducts = products.filter(p => p.is_featured).length > 0
    ? products.filter(p => p.is_featured) : products;
  const trendingProducts = products.filter(p => p.is_trending).length > 0
    ? products.filter(p => p.is_trending) : products;
  const mostPopular = [...products]
    .sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0) || (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
  const newArrivals = products.filter(p => p.is_new_arrival).length > 0
    ? products.filter(p => p.is_new_arrival) : products.slice().reverse();

  const goSeeAll = (type: string, title: string, data: Product[]) =>
    navigation.navigate('AllProducts', { type, title, products: data });

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.badgePill}>  
            <Ionicons name="flash" size={10} color="#fff" />
            <Text style={s.badgePillText}> 15 MINS DELIVERY</Text>
          </View>
          <TouchableOpacity style={s.addressRow} activeOpacity={0.7}>
            <Text style={s.addressLabel}>Delivering to</Text>
            <View style={s.addressInner}>
              {locationLoading
                ? <ActivityIndicator size={12} color={COLORS.primary} style={{ marginRight: 4 }} />
                : <Ionicons name="location" size={14} color={COLORS.primary} />}
              <Text style={s.addressText} numberOfLines={1}> {locationLabel}</Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.gray} style={{ marginLeft: 2 }} />
            </View>
          </TouchableOpacity>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.iconBtn} activeOpacity={0.8} onPress={() => navigation.navigate('Wishlist')}>
            <Ionicons name="heart-outline" size={22} color={COLORS.dark} />
            {wishlistIds.size > 0 && (
              <View style={s.iconBadge}><Text style={s.iconBadgeText}>{wishlistIds.size}</Text></View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} activeOpacity={0.8} onPress={() => navigation.getParent()?.getParent()?.navigate('Cart')}>
            <Ionicons name="cart-outline" size={22} color={COLORS.dark} />
            {totalQty > 0 && (
              <View style={s.iconBadge}><Text style={s.iconBadgeText}>{totalQty}</Text></View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.grayLight} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Search eggs, milk, bread..."
            placeholderTextColor={COLORS.grayLight}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.grayLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 90 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.offersStrip}>
          {OFFERS.map(o => (
            <View key={o.id} style={[s.offerChip, { backgroundColor: o.bg }]}>
              <View style={s.offerIconWrap}>
                <Ionicons name={o.icon as any} size={18} color={COLORS.primary} />
              </View>
              <View>
                <Text style={s.offerLabel}>{o.label}</Text>
                <Text style={s.offerDesc}>{o.desc}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {loading ? (
          <View style={s.bannerLoading}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={s.bannerScroll} decelerationRate="fast">
            {displayBanners.map((b: any) => (
              <TouchableOpacity key={b.id} style={[s.banner, { backgroundColor: b.bg || COLORS.primaryLight }]} activeOpacity={0.92}>
                {b.image_url ? (
                  <>
                    <Image source={{ uri: b.image_url }} style={s.bannerImage} resizeMode="cover" />
                    {(b.title || b.subtitle) && (
                      <View style={s.bannerOverlay}>
                        {b.title && <Text style={s.bannerTitleOverlay}>{b.title}</Text>}
                        {b.subtitle && <Text style={s.bannerSubOverlay}>{b.subtitle}</Text>}
                        {b.cta_text && (
                          <View style={s.ctaBtn}>
                            <Text style={s.ctaBtnText}>{b.cta_text}</Text>
                            <Ionicons name="arrow-forward" size={12} color={COLORS.dark} style={{ marginLeft: 4 }} />
                          </View>
                        )}
                      </View>
                    )}
                  </>
                ) : (
                  <View style={s.bannerInner}>
                    <View style={s.bannerTextBlock}>
                      <Text style={[s.bannerTitle, { color: b.textColor || COLORS.primary }]}>{b.title}</Text>
                      <Text style={[s.bannerSub, { color: b.textColor || COLORS.primary }]}>{b.subtitle}</Text>
                      <View style={s.ctaBtn}>
                        <Text style={s.ctaBtnText}>{b.cta_text || 'Shop Now'}</Text>
                        <Ionicons name="arrow-forward" size={12} color={COLORS.dark} style={{ marginLeft: 4 }} />
                      </View>
                    </View>
                    <Ionicons name="storefront-outline" size={64} color={COLORS.primary} style={{ opacity: 0.2 }} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Shop by Category</Text>
            <TouchableOpacity style={s.seeAllBtn} onPress={() => navigation.getParent()?.navigate('Categories')}>
              <Text style={s.seeAll}>See all</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 16 }} />
          ) : (
            <View style={s.grid}>
              {categories.slice(0, 8).map((c, idx) => (
                <TouchableOpacity
                  key={c.id}
                  style={s.catCard}
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate('Categories', {
                    screen: 'CategoryDetail',
                    params: {
                      categoryId: c.parent_id ?? c.id,
                      categoryName: c.name,
                      initialSubCatId: c.parent_id ? c.id : null,
                    },
                  })}
                >
                  <View style={[s.catIconWrap, { backgroundColor: CAT_BG[idx % CAT_BG.length] }]}>
                    {c.image_url ? (
                      <Image
                        source={{ uri: c.image_url }}
                        style={s.catImg}
                        resizeMode="contain"
                      />
                    ) : (
                      <Ionicons name="grid-outline" size={26} color={COLORS.primary} />
                    )}
                  </View>
                  <Text style={s.catName} numberOfLines={2}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Featured Products ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="star" size={18} color={COLORS.amber} style={{ marginRight: 5 }} />
              <Text style={s.sectionTitle}>Featured Products</Text>
            </View>
            <TouchableOpacity style={s.seeAllBtn} onPress={() => goSeeAll('featured', 'Featured Products', products)}>
              <Text style={s.seeAll}>See all</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 16 }} />
          ) : featuredProducts.length > 0 ? (
            <FlatList
              data={featuredProducts.slice(0, 8)}
              keyExtractor={i => 'ft' + i.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 16, paddingRight: 4 }}
              renderItem={({ item }) => <ProductCard item={item} prefix="ft" />}
            />
          ) : <Text style={s.emptyText}>No products available</Text>}
        </View>

        {/* ── Most Popular Products ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="trophy" size={18} color={COLORS.orange} style={{ marginRight: 5 }} />
              <Text style={s.sectionTitle}>Most Popular</Text>
            </View>
            <TouchableOpacity style={s.seeAllBtn} onPress={() => goSeeAll('popular', 'Most Popular', products)}>
              <Text style={s.seeAll}>See all</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 16 }} />
          ) : (
            <FlatList
              data={mostPopular.slice(0, 8)}
              keyExtractor={i => 'mp' + i.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 16, paddingRight: 4 }}
              renderItem={({ item }) => <ProductCard item={item} prefix="mp" />}
            />
          )}
        </View>

        {/* ── Trending Products ── */}
        {(loading || trendingProducts.length > 0) && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <View style={s.sectionTitleRow}>
                <Ionicons name="trending-up" size={18} color={COLORS.green} style={{ marginRight: 5 }} />
                <Text style={s.sectionTitle}>Trending Now</Text>
              </View>
              <TouchableOpacity style={s.seeAllBtn} onPress={() => goSeeAll('trending', 'Trending Now', products)}>
                <Text style={s.seeAll}>See all</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 16 }} />
            ) : (
              <FlatList
                data={trendingProducts.slice(0, 8)}
                keyExtractor={i => 'tr' + i.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 16, paddingRight: 4 }}
                renderItem={({ item }) => <ProductCard item={item} prefix="tr" />}
              />
            )}
          </View>
        )}

        {(loading || newArrivals.length > 0) && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <View style={s.sectionTitleRow}>
                <Ionicons name="sparkles" size={18} color={COLORS.green} style={{ marginRight: 5 }} />
                <Text style={s.sectionTitle}>New Arrivals</Text>
              </View>
              <TouchableOpacity style={s.seeAllBtn} onPress={() => goSeeAll('new_arrivals', 'New Arrivals', products)}>
                <Text style={s.seeAll}>See all</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 16 }} />
            ) : (
              <FlatList
                data={newArrivals.slice(0, 8)}
                keyExtractor={i => 'na' + i.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 16, paddingRight: 4 }}
                renderItem={({ item }) => <ProductCard item={item} prefix="na" />}
              />
            )}
          </View>
        )}

        {wishlistItems.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <View style={s.sectionTitleRow}>
                <Ionicons name="heart" size={18} color={COLORS.red} style={{ marginRight: 5 }} />
                <Text style={s.sectionTitle}>Wishlist Products</Text>
              </View>
              <TouchableOpacity style={s.seeAllBtn} onPress={() => navigation.navigate('Wishlist')}>
                <Text style={s.seeAll}>See all</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={wishlistItems.slice(0, 8)}
              keyExtractor={i => 'wl' + i.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 16, paddingRight: 4 }}
              renderItem={({ item }) => <ProductCard item={item} prefix="wl" />}
            />
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const ps = StyleSheet.create({
  card: { width: 150, marginRight: 12, padding: 12, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, position: 'relative' },
  discountBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: COLORS.greenLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, zIndex: 1 },
  discountText: { fontSize: 10, fontWeight: '800', color: '#15803d' },
  wishBtn: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', zIndex: 2, elevation: 2 },
  imgWrap: { width: '100%', height: 90, backgroundColor: COLORS.bg, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  img: { width: '100%', height: 90, borderRadius: 12 },
  name: { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 4, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  price: { fontSize: 15, fontWeight: '800', color: COLORS.dark },
  mrp: { fontSize: 12, color: COLORS.grayLight, textDecorationLine: 'line-through' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 22, paddingVertical: 7, borderWidth: 1.5, borderColor: COLORS.primary, gap: 4 },
  addBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.primary, borderRadius: 22, paddingHorizontal: 4, paddingVertical: 4 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  qtyBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  qtyCount: { color: '#fff', fontSize: 14, fontWeight: '800', minWidth: 20, textAlign: 'center' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 4 },
  ratingBadge: { backgroundColor: '#059669', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, flexDirection: 'row', alignItems: 'center' },
  ratingText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  ratingCount: { fontSize: 10, color: COLORS.grayLight },
  outOfStockBtn: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
  outOfStockText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: COLORS.white },
  headerLeft: { flex: 1 },
  badgePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  badgePillText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  addressRow: {},
  addressLabel: { fontSize: 11, color: COLORS.grayLight, marginBottom: 2 },
  addressInner: { flexDirection: 'row', alignItems: 'center' },
  addressText: { fontSize: 15, fontWeight: '700', color: COLORS.dark, maxWidth: 200 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { position: 'relative', width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  iconBadge: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  iconBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1.5, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.dark },
  scroll: { paddingTop: 4 },
  offersStrip: { paddingLeft: 16, marginBottom: 16 },
  offerChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginRight: 10 },
  offerIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  offerLabel: { fontSize: 12, fontWeight: '800', color: COLORS.dark },
  offerDesc: { fontSize: 11, color: COLORS.gray },
  bannerLoading: { height: 170, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  bannerScroll: { marginBottom: 24 },
  banner: { width: BANNER_W, marginLeft: 16, borderRadius: 20, minHeight: 160, overflow: 'hidden' },
  bannerImage: { width: '100%', height: 170, borderRadius: 20 },
  bannerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.42)', padding: 14, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  bannerTitleOverlay: { fontSize: 18, fontWeight: '900', color: '#fff', marginBottom: 2 },
  bannerSubOverlay: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 8 },
  bannerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, minHeight: 160 },
  bannerTextBlock: { flex: 1 },
  bannerTitle: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  bannerSub: { fontSize: 13, marginBottom: 12, opacity: 0.8 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start' },
  ctaBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.dark },
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  catCard: { width: '25%', alignItems: 'center', marginBottom: 16 },
  catIconWrap: { width: 62, height: 62, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 7, overflow: 'hidden' },
  catImg: { width: 54, height: 54 },
  catName: { fontSize: 11, color: COLORS.text, textAlign: 'center', fontWeight: '600', paddingHorizontal: 2 },
  emptyText: { fontSize: 13, color: COLORS.grayLight, marginLeft: 16 },
  promoBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, marginHorizontal: 16, borderRadius: 16, padding: 16, gap: 12, marginBottom: 12 },
  promoIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center' },
  promoTitle: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  promoSub: { fontSize: 12, color: COLORS.gray },
  promoBtn: { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  promoBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
