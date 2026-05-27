import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  Dimensions, FlatList, Share, NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';
import { Product } from '../lib/api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

const { width: SCREEN_W } = Dimensions.get('window');

export default function ProductDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const { product }: { product: Product } = route.params;
  const insets = useSafeAreaInsets();
  const { addItem, removeItem, getQty } = useCart();
  const { toggle, isWishlisted } = useWishlist();

  const [imgIndex, setImgIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);

  const images = product.images?.length > 0
    ? product.images
    : [{ id: 'ph', image_url: '', is_primary: true }];

  const price = product.sale_price ? Number(product.sale_price) : Number(product.price);
  const original = Number(product.price);
  const discount = product.sale_price
    ? Math.round(((original - price) / original) * 100) : 0;
  const qty = getQty(product.id);
  const wishlisted = isWishlisted(product.id);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setImgIndex(idx);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out ${product.name} on Rurban! Rs.${price}` });
    } catch {}
  };

  const tags: string[] = (product as any).tags ?? [];
  const brand: string = (product as any).brand ?? '';
  const description: string = (product as any).description ?? '';
  const shortDescription: string = (product as any).short_description ?? '';
  const categoryName = product.category?.name ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        {/* ── Floating Header ── */}
        <View style={s.floatingHeader}>
          <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-down" size={22} color={COLORS.dark} />
          </TouchableOpacity>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.headerBtn} onPress={() => toggle(product)}>
              <Ionicons
                name={wishlisted ? 'heart' : 'heart-outline'}
                size={22}
                color={wishlisted ? COLORS.red : COLORS.dark}
              />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={22} color={COLORS.dark} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      >
        {/* ── Image Gallery ── */}
        <View style={s.galleryWrap}>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={i => i.id}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <View style={s.imgSlide}>
                {item.image_url
                  ? <Image source={{ uri: item.image_url }} style={s.img} resizeMode="contain" />
                  : <View style={s.imgPlaceholder}>
                      <Ionicons name="cube-outline" size={80} color={COLORS.grayLight} />
                    </View>}
              </View>
            )}
          />

          {/* Dot indicators */}
          {images.length > 1 && (
            <View style={s.dotsRow}>
              {images.map((_, i) => (
                <View key={i} style={[s.dot, i === imgIndex && s.dotActive]} />
              ))}
            </View>
          )}

          {/* Veg/non-veg badge top-right */}
          <View style={s.vegBadge}>
            <View style={[s.vegDot, { backgroundColor: COLORS.green }]} />
          </View>

          {/* Discount badge */}
          {discount > 0 && (
            <View style={s.discBadge}>
              <Text style={s.discText}>{discount}% OFF</Text>
            </View>
          )}
        </View>

        {/* ── Info Section ── */}
        <View style={s.infoSection}>
          {/* Category + rating row */}
          <View style={s.metaRow}>
            {categoryName ? (
              <View style={s.catChip}>
                <Text style={s.catChipText}>{categoryName}</Text>
              </View>
            ) : null}
            {product.avg_rating != null && product.avg_rating > 0 && (
              <View style={s.ratingChip}>
                <Ionicons name="star" size={12} color={COLORS.amber} />
                <Text style={s.ratingChipText}>{Number(product.avg_rating).toFixed(1)}</Text>
                {product.review_count != null && product.review_count > 0 && (
                  <Text style={s.reviewCountText}> · {product.review_count.toLocaleString()} reviews</Text>
                )}
              </View>
            )}
          </View>

          {/* Product Name */}
          <Text style={s.productName}>{product.name}</Text>

          {/* Short description */}
          {shortDescription ? (
            <Text style={s.shortDesc}>{shortDescription}</Text>
          ) : null}

          {/* Price block */}
          <View style={s.priceBlock}>
            <Text style={s.price}>Rs.{price}</Text>
            {product.sale_price ? (
              <>
                <Text style={s.originalPrice}>Rs.{original}</Text>
                <View style={s.savingBadge}>
                  <Text style={s.savingText}>Save Rs.{original - price}</Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Stock indicator */}
          <View style={s.stockRow}>
            <View style={[s.stockDot, { backgroundColor: product.stock > 0 ? COLORS.green : COLORS.red }]} />
            <Text style={[s.stockText, { color: product.stock > 0 ? COLORS.green : COLORS.red }]}>
              {product.stock > 10 ? 'In Stock' : product.stock > 0 ? `Only ${product.stock} left` : 'Out of Stock'}
            </Text>
          </View>
        </View>

        {/* ── Quick Info Grid ── */}
        <View style={s.quickGrid}>
          {brand ? (
            <View style={s.quickCell}>
              <Text style={s.quickLabel}>Brand</Text>
              <Text style={s.quickValue}>{brand}</Text>
            </View>
          ) : null}
          {categoryName ? (
            <View style={s.quickCell}>
              <Text style={s.quickLabel}>Category</Text>
              <Text style={s.quickValue}>{categoryName}</Text>
            </View>
          ) : null}
          <View style={[s.quickCell, { borderRightWidth: 0 }]}>
            <Text style={s.quickLabel}>SKU</Text>
            <Text style={s.quickValue}>{(product as any).sku ?? '—'}</Text>
          </View>
        </View>

        {/* ── Tags ── */}
        {tags.length > 0 && (
          <View style={s.tagsSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {tags.map((tag, i) => (
                <View key={i} style={s.tagChip}>
                  <Text style={s.tagChipText}>#{tag}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Description ── */}
        {description ? (
          <View style={s.descSection}>
            <Text style={s.sectionHeading}>About this product</Text>
            <Text
              style={s.descText}
              numberOfLines={descExpanded ? undefined : 4}
            >
              {description}
            </Text>
            {description.length > 200 && (
              <TouchableOpacity onPress={() => setDescExpanded(v => !v)} style={s.readMoreBtn}>
                <Text style={s.readMoreText}>{descExpanded ? 'Show less' : 'Read more'}</Text>
                <Ionicons
                  name={descExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={COLORS.primary}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* ── Policies ── */}
        <View style={s.policiesSection}>
          {[
            ['shield-checkmark-outline', 'Quality Assured', 'All products verified'],
            ['refresh-outline',          '72hr Replacement',  'Easy returns & replacements'],
            ['bicycle-outline',          'Fast Delivery',    'Delivered in 15 minutes'],
          ].map(([icon, title, sub]) => (
            <View key={title} style={s.policyRow}>
              <View style={s.policyIconWrap}>
                <Ionicons name={icon as any} size={20} color={COLORS.primary} />
              </View>
              <View>
                <Text style={s.policyTitle}>{title}</Text>
                <Text style={s.policySub}>{sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.grayLight} style={{ marginLeft: 'auto' }} />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Sticky Bottom Bar ── */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={s.bottomPrice}>
          <Text style={s.bottomPriceLabel}>Total Price</Text>
          <Text style={s.bottomPriceVal}>Rs.{qty > 0 ? price * qty : price}</Text>
        </View>

        {product.stock === 0 ? (
          <View style={[s.addToCartBtn, { backgroundColor: COLORS.grayLight }]}>
            <Text style={s.addToCartText}>Out of Stock</Text>
          </View>
        ) : qty === 0 ? (
          <TouchableOpacity style={s.addToCartBtn} onPress={() => addItem(product)} activeOpacity={0.85}>
            <Ionicons name="cart-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={s.addToCartText}>Add to Cart</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.qtyBlock}>
            <TouchableOpacity style={s.qtyBtn} onPress={() => removeItem(product.id)}>
              <Ionicons name="remove" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={s.qtyCount}>{qty}</Text>
            <TouchableOpacity style={s.qtyBtn} onPress={() => addItem(product)}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  floatingHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  headerActions: { flexDirection: 'row', gap: 8 },

  // Gallery
  galleryWrap: { width: SCREEN_W, height: SCREEN_W * 0.85, backgroundColor: '#F8FAFC', position: 'relative' },
  imgSlide: { width: SCREEN_W, height: SCREEN_W * 0.85, justifyContent: 'center', alignItems: 'center', padding: 16 },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', position: 'absolute', bottom: 14, width: '100%', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB' },
  dotActive: { width: 18, backgroundColor: COLORS.primary },
  vegBadge: { position: 'absolute', top: 14, right: 14, width: 24, height: 24, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.green, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 10, height: 10, borderRadius: 5 },
  discBadge: { position: 'absolute', top: 14, left: 14, backgroundColor: COLORS.green, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  discText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Info
  infoSection: { padding: 18, paddingBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  catChip: { backgroundColor: COLORS.primaryLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  catChipText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  ratingChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF9C3', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 3 },
  ratingChipText: { fontSize: 12, fontWeight: '800', color: '#854D0E' },
  reviewCountText: { fontSize: 11, color: '#854D0E' },
  productName: { fontSize: 22, fontWeight: '900', color: COLORS.dark, lineHeight: 30, marginBottom: 6 },
  shortDesc: { fontSize: 14, color: COLORS.gray, lineHeight: 20, marginBottom: 12 },
  priceBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  price: { fontSize: 26, fontWeight: '900', color: COLORS.dark },
  originalPrice: { fontSize: 16, color: COLORS.grayLight, textDecorationLine: 'line-through' },
  savingBadge: { backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  savingText: { fontSize: 12, fontWeight: '700', color: '#15803D' },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stockDot: { width: 8, height: 8, borderRadius: 4 },
  stockText: { fontSize: 13, fontWeight: '700' },

  // Quick info grid
  quickGrid: {
    flexDirection: 'row', marginHorizontal: 16, marginVertical: 14,
    backgroundColor: '#F8FAFC', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  quickCell: { flex: 1, padding: 14, borderRightWidth: 1, borderRightColor: COLORS.border },
  quickLabel: { fontSize: 11, color: COLORS.grayLight, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  quickValue: { fontSize: 13, fontWeight: '800', color: COLORS.dark },

  // Tags
  tagsSection: { marginBottom: 8 },
  tagChip: { backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagChipText: { fontSize: 12, color: '#4F46E5', fontWeight: '600' },

  // Description
  descSection: { marginHorizontal: 16, marginBottom: 16, padding: 18, backgroundColor: '#F8FAFC', borderRadius: 18, borderWidth: 1, borderColor: COLORS.border },
  sectionHeading: { fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 10 },
  descText: { fontSize: 14, color: COLORS.gray, lineHeight: 22 },
  readMoreBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  readMoreText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  // Policies
  policiesSection: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#F8FAFC', borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  policyRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  policyIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  policyTitle: { fontSize: 14, fontWeight: '700', color: COLORS.dark, marginBottom: 2 },
  policySub: { fontSize: 12, color: COLORS.grayLight },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 10,
  },
  bottomPrice: {},
  bottomPriceLabel: { fontSize: 11, color: COLORS.grayLight, marginBottom: 2 },
  bottomPriceVal: { fontSize: 20, fontWeight: '900', color: COLORS.dark },
  addToCartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14,
  },
  addToCartText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  qtyBlock: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary,
    borderRadius: 16, paddingHorizontal: 6, paddingVertical: 6, gap: 4,
  },
  qtyBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  qtyCount: { color: '#fff', fontSize: 18, fontWeight: '900', minWidth: 32, textAlign: 'center' },
});
