import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';

export default function WishlistScreen({ navigation }: { navigation: any }) {
  const { items, toggle } = useWishlist();
  const { addItem, getQty, removeItem } = useCart();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={s.title}>Wishlist</Text>
        <Text style={s.count}>{items.length} items</Text>
      </View>

      {items.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="heart-outline" size={72} color={COLORS.grayLight} style={{ marginBottom: 16 }} />
          <Text style={s.emptyTitle}>Your wishlist is empty</Text>
          <Text style={s.emptySub}>Save your favourite products here</Text>
          <TouchableOpacity style={s.shopBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={s.shopBtnText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={s.columnWrap}
          renderItem={({ item }) => {
            const img = item.images?.find(i => i.is_primary)?.image_url ?? item.images?.[0]?.image_url;
            const price = item.sale_price ? Number(item.sale_price) : Number(item.price);
            const original = Number(item.price);
            const discount = item.sale_price ? Math.round(((original - price) / original) * 100) : 0;
            const qty = getQty(item.id);
            return (
              <View style={s.card}>
                {discount > 0 && (
                  <View style={s.discBadge}><Text style={s.discText}>{discount}% OFF</Text></View>
                )}
                <TouchableOpacity style={s.heartBtn} onPress={() => toggle(item)}>
                  <Ionicons name="heart" size={16} color={COLORS.red} />
                </TouchableOpacity>
                <View style={s.imgWrap}>
                  {img
                    ? <Image source={{ uri: img }} style={s.img} resizeMode="cover" />
                    : <Ionicons name="cube-outline" size={36} color={COLORS.grayLight} />}
                </View>
                <Text style={s.name} numberOfLines={2}>{item.name}</Text>
                <View style={s.priceRow}>
                  <Text style={s.price}>Rs.{price}</Text>
                  {item.sale_price && <Text style={s.mrp}>Rs.{original}</Text>}
                </View>
                {qty === 0 ? (
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
                    <TouchableOpacity style={s.qtyBtn} onPress={() => addItem(item)}>
                      <Ionicons name="add" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.dark },
  count: { fontSize: 14, color: COLORS.gray },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.dark, marginBottom: 8 },
  emptySub: { fontSize: 14, color: COLORS.gray, marginBottom: 24 },
  shopBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  shopBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  list: { padding: 12 },
  columnWrap: { gap: 12 },
  card: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 16, padding: 12,
    marginBottom: 12, position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  discBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: COLORS.greenLight,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, zIndex: 1,
  },
  discText: { fontSize: 10, fontWeight: '800', color: '#15803d' },
  heartBtn: {
    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', zIndex: 2,
  },
  imgWrap: {
    width: '100%', aspectRatio: 1, backgroundColor: COLORS.bg, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10, overflow: 'hidden',
  },
  img: { width: '100%', height: '100%' },
  name: { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  price: { fontSize: 15, fontWeight: '800', color: COLORS.dark },
  mrp: { fontSize: 12, color: COLORS.grayLight, textDecorationLine: 'line-through' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primaryLight, borderRadius: 20, paddingVertical: 7,
    borderWidth: 1.5, borderColor: COLORS.primary, gap: 4,
  },
  addBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 4, paddingVertical: 4,
  },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center',
  },
  qtyCount: { color: '#fff', fontSize: 13, fontWeight: '800', minWidth: 18, textAlign: 'center' },
});
