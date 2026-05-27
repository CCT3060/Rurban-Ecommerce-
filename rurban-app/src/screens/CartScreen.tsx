import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';
import { useCart } from '../context/CartContext';

export default function CartScreen({ navigation }: { navigation: any }) {
  const { items, totalPrice, addItem, removeItem } = useCart();
  const insets = useSafeAreaInsets();

  const delivery = totalPrice >= 199 ? 0 : 29;
  const total    = totalPrice + delivery;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 10, padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.dark} />
          </TouchableOpacity>
          <Ionicons name="cart" size={22} color={COLORS.primary} style={{ marginRight: 8 }} />
          <Text style={s.title}>My Cart</Text>
        </View>
        <Text style={s.itemCount}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
      </View>

      {items.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="bag-outline" size={72} color={COLORS.grayLight} style={{ marginBottom: 16 }} />
          <Text style={s.emptyTitle}>Your cart is empty</Text>
          <Text style={s.emptySub}>Add items to get started</Text>
          <TouchableOpacity style={s.shopBtn} onPress={() => navigation.getParent()?.navigate('Main')} activeOpacity={0.8}>
            <Text style={s.shopBtnText}>Shop Now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={i => i.product.id}
            contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 290 }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const img = item.product.images?.find(i => i.is_primary)?.image_url
                ?? item.product.images?.[0]?.image_url;
              const price = item.product.sale_price
                ? Number(item.product.sale_price) : Number(item.product.price);
              const original = Number(item.product.price);
              const discount = item.product.sale_price
                ? Math.round(((original - price) / original) * 100) : 0;
              return (
                <View style={s.cartItem}>
                  <View style={s.itemImg}>
                    {img
                      ? <Image source={{ uri: img }} style={s.itemImgFull} resizeMode="cover" />
                      : <Ionicons name="cube-outline" size={32} color={COLORS.primary} />}
                  </View>
                  <View style={s.itemInfo}>
                    <Text style={s.itemName} numberOfLines={2}>{item.product.name}</Text>
                    {item.product.category && (
                      <Text style={s.itemCat}>{item.product.category.name}</Text>
                    )}
                    <View style={s.priceRow}>
                      <Text style={s.itemPrice}>Rs.{price}</Text>
                      {discount > 0 && (
                        <>
                          <Text style={s.itemMrp}>Rs.{original}</Text>
                          <View style={s.discBadge}><Text style={s.discText}>{discount}% OFF</Text></View>
                        </>
                      )}
                    </View>
                    {item.quantity > 1 && (
                      <Text style={s.itemSubtotal}>Rs.{price} × {item.quantity} = Rs.{price * item.quantity}</Text>
                    )}
                  </View>
                  <View style={s.qtyRow}>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => removeItem(item.product.id)}>
                      <Ionicons name="remove" size={16} color="#fff" />
                    </TouchableOpacity>
                    <Text style={s.qtyCount}>{item.quantity}</Text>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => addItem(item.product)}>
                      <Ionicons name="add" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />

          <View style={[s.bill, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={s.billTitle}>Bill Summary</Text>
            <View style={s.billRow}>
              <Text style={s.billLabel}>Subtotal</Text>
              <Text style={s.billValue}>Rs.{Math.round(totalPrice)}</Text>
            </View>
            <View style={s.billRow}>
              <Text style={s.billLabel}>Delivery fee</Text>
              <Text style={[s.billValue, delivery === 0 && s.free]}>
                {delivery === 0 ? 'FREE' : `Rs.${delivery}`}
              </Text>
            </View>
            {delivery > 0 && (
              <View style={s.freeHintRow}>
                <Ionicons name="information-circle-outline" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
                <Text style={s.freeHint}>Add Rs.{199 - Math.round(totalPrice)} more for free delivery</Text>
              </View>
            )}
            <View style={s.divider} />
            <View style={s.billRow}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalValue}>Rs.{Math.round(total)}</Text>
            </View>
            <TouchableOpacity
              style={s.checkoutBtn}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('Checkout')}
            >
              <Text style={s.checkoutText}>Proceed to Checkout</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.dark },
  itemCount: { fontSize: 14, color: COLORS.gray, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.dark, marginBottom: 8 },
  emptySub: { fontSize: 14, color: COLORS.gray, marginBottom: 24 },
  shopBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  shopBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  list: { padding: 16, gap: 12 },
  cartItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: 16, padding: 14, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  itemImg: {
    width: 70, height: 70, borderRadius: 12, backgroundColor: COLORS.bg,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  itemImgFull: { width: 70, height: 70 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: COLORS.dark, marginBottom: 3, lineHeight: 19 },
  itemCat: { fontSize: 11, color: COLORS.grayLight, marginBottom: 5 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemPrice: { fontSize: 15, fontWeight: '800', color: COLORS.dark },
  itemMrp: { fontSize: 12, color: COLORS.grayLight, textDecorationLine: 'line-through' },
  discBadge: { backgroundColor: COLORS.greenLight, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  discText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  itemSubtotal: { fontSize: 12, color: COLORS.primary, fontWeight: '700', marginTop: 4 },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary,
    borderRadius: 22, padding: 4, gap: 4,
  },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center',
  },
  qtyCount: { color: '#fff', fontSize: 14, fontWeight: '800', minWidth: 18, textAlign: 'center' },
  bill: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10,
  },
  billTitle: { fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 14 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  billLabel: { fontSize: 14, color: COLORS.gray },
  billValue: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  free: { color: COLORS.green, fontWeight: '800' },
  freeHintRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight,
    borderRadius: 8, padding: 8, marginBottom: 10,
  },
  freeHint: { fontSize: 12, color: COLORS.primary, flex: 1 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  totalValue: { fontSize: 18, fontWeight: '900', color: COLORS.primary },
  checkoutBtn: {
    flexDirection: 'row', backgroundColor: COLORS.primary, borderRadius: 14, height: 54,
    justifyContent: 'center', alignItems: 'center', marginTop: 14,
  },
  checkoutText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
