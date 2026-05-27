import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../lib/theme';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { placeOrder } from '../lib/api';

type PayMethod = 'cod' | 'upi' | 'card';

const PAY_OPTS: { id: PayMethod; label: string; icon: string; sub: string }[] = [
  { id: 'cod', label: 'Cash on Delivery', icon: 'cash-outline', sub: 'Pay when order arrives' },
  { id: 'upi', label: 'UPI / Wallet',     icon: 'phone-portrait-outline', sub: 'GPay, PhonePe, Paytm' },
  { id: 'card', label: 'Card',            icon: 'card-outline', sub: 'Debit / Credit card' },
];

export default function CheckoutScreen({ navigation }: { navigation: any }) {
  const { items, totalPrice, clearCart } = useCart();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [street,    setStreet]    = useState('');
  const [city,      setCity]      = useState('');
  const [state,     setState]     = useState('');
  const [zip,       setZip]       = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('cod');
  const [loading,   setLoading]   = useState(false);

  // Load saved address on mount
  useEffect(() => {
    AsyncStorage.getItem('checkout_address').then(raw => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (saved.firstName) setFirstName(saved.firstName);
        if (saved.lastName)  setLastName(saved.lastName);
        if (saved.phone)     setPhone(saved.phone);
        if (saved.street)    setStreet(saved.street);
        if (saved.city)      setCity(saved.city);
        if (saved.state)     setState(saved.state);
        if (saved.zip)       setZip(saved.zip);
      } catch (_) {}
    });
  }, []);

  // Persist address whenever any field changes
  useEffect(() => {
    AsyncStorage.setItem('checkout_address', JSON.stringify(
      { firstName, lastName, phone, street, city, state, zip }
    ));
  }, [firstName, lastName, phone, street, city, state, zip]);

  const delivery = totalPrice >= 199 ? 0 : 29;
  const total    = totalPrice + delivery;

  const handleOrder = async () => {
    if (!firstName || !lastName || !phone || !street || !city || !state || !zip) {
      Alert.alert('Incomplete Address', 'Please fill in all address fields.');
      return;
    }
    if (!token) {
      Alert.alert('Not logged in', 'Please log in to place an order.');
      return;
    }

    setLoading(true);
    const result = await placeOrder(token, {
      items: items.map(i => ({ productId: i.product.id, quantity: i.quantity })),
      shippingAddress: { firstName, lastName, phone, street, city, state, zip },
      paymentMethod: payMethod,
    });
    setLoading(false);

    if (result.error) {
      Alert.alert('Order Failed', result.error);
      return;
    }

    clearCart();
    navigation.replace('OrderSuccess', {
      orderNumber: result.data?.order_number ?? '',
      total: Math.round(total),
      payMethod,
    });
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={s.title}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Shipping Address ── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="location" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={s.sectionTitle}>Shipping Address</Text>
            </View>

            <View style={s.row}>
              <View style={[s.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={s.label}>First Name</Text>
                <TextInput style={s.input} value={firstName} onChangeText={setFirstName}
                  placeholder="Archit" placeholderTextColor={COLORS.grayLight} autoCapitalize="words" />
              </View>
              <View style={[s.inputGroup, { flex: 1 }]}>
                <Text style={s.label}>Last Name</Text>
                <TextInput style={s.input} value={lastName} onChangeText={setLastName}
                  placeholder="Kumar" placeholderTextColor={COLORS.grayLight} autoCapitalize="words" />
              </View>
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>Phone Number</Text>
              <TextInput style={s.input} value={phone} onChangeText={setPhone}
                placeholder="+91 98765 43210" placeholderTextColor={COLORS.grayLight}
                keyboardType="phone-pad" />
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>Street / Apartment</Text>
              <TextInput style={s.input} value={street} onChangeText={setStreet}
                placeholder="12, Green Park Apartments" placeholderTextColor={COLORS.grayLight} />
            </View>

            <View style={s.row}>
              <View style={[s.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={s.label}>City</Text>
                <TextInput style={s.input} value={city} onChangeText={setCity}
                  placeholder="Noida" placeholderTextColor={COLORS.grayLight} />
              </View>
              <View style={[s.inputGroup, { flex: 1 }]}>
                <Text style={s.label}>State</Text>
                <TextInput style={s.input} value={state} onChangeText={setState}
                  placeholder="UP" placeholderTextColor={COLORS.grayLight} />
              </View>
            </View>

            <View style={[s.inputGroup, { width: '50%' }]}>
              <Text style={s.label}>PIN Code</Text>
              <TextInput style={s.input} value={zip} onChangeText={setZip}
                placeholder="201301" placeholderTextColor={COLORS.grayLight}
                keyboardType="number-pad" maxLength={6} />
            </View>
          </View>

          {/* ── Payment Method ── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="card" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={s.sectionTitle}>Payment Method</Text>
            </View>
            {PAY_OPTS.map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={[s.payOpt, payMethod === opt.id && s.payOptActive]}
                onPress={() => setPayMethod(opt.id)}
                activeOpacity={0.8}
              >
                <Ionicons name={opt.icon as any} size={22} color={payMethod === opt.id ? COLORS.primary : COLORS.gray} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.payLabel, payMethod === opt.id && s.payLabelActive]}>{opt.label}</Text>
                  <Text style={s.paySub}>{opt.sub}</Text>
                </View>
                <View style={[s.radio, payMethod === opt.id && s.radioActive]}>
                  {payMethod === opt.id && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Order Summary ── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="receipt" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={s.sectionTitle}>Order Summary</Text>
            </View>
            {items.map(i => {
              const price = i.product.sale_price ? Number(i.product.sale_price) : Number(i.product.price);
              return (
                <View key={i.product.id} style={s.summaryItem}>
                  <Text style={s.summaryName} numberOfLines={1}>{i.product.name}</Text>
                  <Text style={s.summaryQty}>x{i.quantity}</Text>
                  <Text style={s.summaryPrice}>Rs.{price * i.quantity}</Text>
                </View>
              );
            })}
            <View style={s.divider} />
            <View style={s.summaryRow}>
              <Text style={s.summaryGray}>Subtotal</Text>
              <Text style={s.summaryVal}>Rs.{Math.round(totalPrice)}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryGray}>Delivery</Text>
              <Text style={[s.summaryVal, delivery === 0 && { color: COLORS.green }]}>
                {delivery === 0 ? 'FREE' : `Rs.${delivery}`}
              </Text>
            </View>
            <View style={[s.summaryRow, { marginTop: 6 }]}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalVal}>Rs.{Math.round(total)}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Place Order Button ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.footerTotal}>
          <Text style={s.footerTotalLabel}>Total</Text>
          <Text style={s.footerTotalVal}>Rs.{Math.round(total)}</Text>
        </View>
        <TouchableOpacity style={s.orderBtn} onPress={handleOrder} activeOpacity={0.88} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <>
                <Text style={s.orderBtnText}>Place Order</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
              </>}
        </TouchableOpacity>
      </View>
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
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.dark },
  scroll: { padding: 16, gap: 16 },
  section: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  row: { flexDirection: 'row' },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.gray, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, height: 46, fontSize: 14, color: COLORS.dark, backgroundColor: COLORS.bg,
  },
  payOpt: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  payOptActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  payLabel: { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  payLabelActive: { color: COLORS.primary },
  paySub: { fontSize: 12, color: COLORS.grayLight, marginTop: 2 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  radioActive: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  summaryItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  summaryName: { flex: 1, fontSize: 13, color: COLORS.text },
  summaryQty: { fontSize: 13, color: COLORS.grayLight, marginHorizontal: 8 },
  summaryPrice: { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryGray: { fontSize: 14, color: COLORS.gray },
  summaryVal: { fontSize: 14, fontWeight: '600', color: COLORS.dark },
  totalLabel: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  totalVal: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  footer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    paddingHorizontal: 16, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 6,
  },
  footerTotal: { flex: 1 },
  footerTotalLabel: { fontSize: 12, color: COLORS.gray },
  footerTotalVal: { fontSize: 20, fontWeight: '900', color: COLORS.dark },
  orderBtn: {
    flexDirection: 'row', backgroundColor: COLORS.primary, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14, alignItems: 'center',
  },
  orderBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
