import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';

export default function OrderSuccessScreen({ navigation, route }: { navigation: any; route: any }) {
  const insets = useSafeAreaInsets();
  const { orderNumber, total, payMethod } = route.params ?? {};

  const payLabel: Record<string, string> = {
    cod: 'Cash on Delivery',
    upi: 'UPI / Wallet',
    card: 'Card',
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={[s.content, { paddingBottom: insets.bottom + 20 }]}>
        {/* Success animation placeholder */}
        <View style={s.iconWrap}>
          <View style={s.iconCircle}>
            <Ionicons name="checkmark" size={52} color="#fff" />
          </View>
        </View>

        <Text style={s.congrats}>Order Placed!</Text>
        <Text style={s.sub}>Your order has been placed successfully and will be delivered soon.</Text>

        <View style={s.detailCard}>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Order ID</Text>
            <Text style={s.detailVal}>{orderNumber ?? 'N/A'}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Amount</Text>
            <Text style={s.detailVal}>Rs.{total}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Payment</Text>
            <Text style={s.detailVal}>{payLabel[payMethod] ?? payMethod}</Text>
          </View>
        </View>

        <View style={s.stepsWrap}>
          {[
            ['checkmark-circle', COLORS.green,   'Order Placed'],
            ['construct-outline', COLORS.amber,  'Processing'],
            ['bicycle-outline',  COLORS.primary, 'On the Way'],
            ['home-outline',     COLORS.gray,    'Delivered'],
          ].map(([icon, color, label], idx) => (
            <View key={label} style={s.stepItem}>
              <View style={[s.stepDot, { backgroundColor: idx === 0 ? color : COLORS.border }]}>
                <Ionicons name={icon as any} size={16} color={idx === 0 ? '#fff' : COLORS.grayLight} />
              </View>
              {idx < 3 && <View style={[s.stepLine, { backgroundColor: idx === 0 ? COLORS.green : COLORS.border }]} />}
              <Text style={[s.stepLabel, idx === 0 && { color: COLORS.green, fontWeight: '700' }]}>{label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={s.trackBtn}
          onPress={() => { navigation.getParent()?.navigate('Main', { screen: 'Orders' }); }}
          activeOpacity={0.85}
        >
          <Ionicons name="receipt-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={s.trackBtnText}>Track Order</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.homeBtn}
          onPress={() => { navigation.getParent()?.navigate('Main', { screen: 'Home' }); }}
          activeOpacity={0.8}
        >
          <Text style={s.homeBtnText}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40 },
  iconWrap: { marginBottom: 24 },
  iconCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: COLORS.green, justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.green, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },
  congrats: { fontSize: 28, fontWeight: '900', color: COLORS.dark, marginBottom: 10 },
  sub: { fontSize: 14, color: COLORS.gray, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  detailCard: {
    width: '100%', backgroundColor: COLORS.white, borderRadius: 20, padding: 20, marginBottom: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  detailLabel: { fontSize: 14, color: COLORS.gray },
  detailVal: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  divider: { height: 1, backgroundColor: COLORS.border },
  stepsWrap: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', marginBottom: 36, justifyContent: 'center' },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  stepLine: { position: 'absolute', top: 18, left: '50%', right: '-50%', height: 2, zIndex: -1 },
  stepLabel: { fontSize: 11, color: COLORS.grayLight, textAlign: 'center' },
  trackBtn: {
    flexDirection: 'row', backgroundColor: COLORS.primary, borderRadius: 14, height: 54,
    justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: 12,
  },
  trackBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  homeBtn: {
    height: 50, justifyContent: 'center', alignItems: 'center', width: '100%',
    borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border,
  },
  homeBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.gray },
});
