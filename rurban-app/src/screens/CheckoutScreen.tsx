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
import { placeOrder, API_BASE } from '../lib/api';

type PayMethod = 'cod' | 'upi' | 'card';

const PAY_OPTS: { id: PayMethod; label: string; icon: string; sub: string }[] = [
  { id: 'cod', label: 'Cash on Delivery', icon: 'cash-outline', sub: 'Pay when order arrives' },
  { id: 'upi', label: 'UPI / Wallet',     icon: 'phone-portrait-outline', sub: 'GPay, PhonePe, Paytm' },
  { id: 'card', label: 'Card',            icon: 'card-outline', sub: 'Debit / Credit card' },
];

export default function CheckoutScreen({ navigation }: { navigation: any }) {
  const { items, totalPrice, clearCart } = useCart();
  const { token, user } = useAuth();
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
  const [deliveryDate, setDeliveryDate] = useState<string | null>(null);
  const [paymentTerms, setPaymentTerms] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const formatDateLabel = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  };

  const calendarRows = () => {
    const { year, month } = calendarMonth;
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  };

  const todayMidnight = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const tomorrowMs = todayMidnight.getTime() + 86400000;
  const isDayDisabled = (day: number) =>
    new Date(calendarMonth.year, calendarMonth.month, day).getTime() < tomorrowMs;

  const toIso = (day: number) => {
    const m = String(calendarMonth.month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${calendarMonth.year}-${m}-${dd}`;
  };

  const canGoPrev = (() => {
    const now = new Date();
    return calendarMonth.year > now.getFullYear() || calendarMonth.month > now.getMonth();
  })();

  const goPrev = () => {
    if (!canGoPrev) return;
    setCalendarMonth(prev => {
      const d = new Date(prev.year, prev.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const goNext = () => {
    setCalendarMonth(prev => {
      const d = new Date(prev.year, prev.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  // For B2B users: fetch and pre-fill the registered shipping address
  useEffect(() => {
    if (user?.user_type !== 'b2b' || !token) return;
    fetch(`${API_BASE}/api/mobile/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((json: { data?: { full_name?: string; phone?: string; b2b_details?: { shipping_attention?: string; shipping_address?: string; shipping_street2?: string; shipping_city?: string; shipping_state?: string; shipping_code?: string; shipping_phone?: string; payment_terms?: string | null } | null } }) => {
        const d = json.data;
        if (!d) return;

        // Split full_name into first / last
        const nameParts = (d.full_name ?? '').trim().split(' ');
        setFirstName(nameParts[0] ?? '');
        setLastName(nameParts.slice(1).join(' '));

        const det = d.b2b_details;
        // Phone: prefer shipping_phone, fall back to profile phone
        setPhone(det?.shipping_phone ?? d.phone ?? '');

        if (det) {
          const streetLine = [det.shipping_address, det.shipping_street2]
            .filter(Boolean).join(', ');
          if (streetLine) setStreet(streetLine);
          if (det.shipping_city)  setCity(det.shipping_city);
          if (det.shipping_state) setState(det.shipping_state);
          if (det.shipping_code)  setZip(det.shipping_code);
          if (det.payment_terms)  setPaymentTerms(det.payment_terms);
        }
      })
      .catch(() => {});
  }, [token, user?.user_type]);

  // Load saved address on mount (for non-B2B users)
  useEffect(() => {
    if (user?.user_type === 'b2b') return;
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
  }, [user?.user_type]);

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
    if (user?.user_type === 'b2b' && !deliveryDate) {
      Alert.alert('Delivery Date Required', 'Please select a requested delivery date.');
      return;
    }
    if (!token) {
      Alert.alert('Not logged in', 'Please log in to place an order.');
      return;
    }

    setLoading(true);
    const notes = deliveryDate ? `Requested delivery date: ${formatDateLabel(deliveryDate)}` : undefined;
    const result = await placeOrder(token, {
      items: items.map(i => ({ productId: i.product.id, quantity: i.quantity })),
      shippingAddress: { firstName, lastName, phone, street, city, state, zip },
      paymentMethod: user?.user_type === 'b2b' ? (paymentTerms ?? 'b2b_terms') : payMethod,
      notes,
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

          {/* ── Requested Delivery Date (B2B only) ── */}
          {user?.user_type === 'b2b' && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Ionicons name="calendar-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={s.sectionTitle}>Requested Delivery Date</Text>
              </View>
              {/* Month navigation */}
              <View style={s.calHeader}>
                <TouchableOpacity onPress={goPrev} disabled={!canGoPrev} style={s.calNavBtn}>
                  <Ionicons name="chevron-back" size={22} color={canGoPrev ? COLORS.dark : COLORS.border} />
                </TouchableOpacity>
                <Text style={s.calMonthLabel}>{MONTHS_FULL[calendarMonth.month]} {calendarMonth.year}</Text>
                <TouchableOpacity onPress={goNext} style={s.calNavBtn}>
                  <Ionicons name="chevron-forward" size={22} color={COLORS.dark} />
                </TouchableOpacity>
              </View>

              {/* Day-of-week headers */}
              <View style={s.calDayHeaders}>
                {DAYS_SHORT.map(d => (
                  <Text key={d} style={s.calDayHeader}>{d}</Text>
                ))}
              </View>

              {/* Day grid */}
              {calendarRows().map((row, ri) => (
                <View key={ri} style={s.calRow}>
                  {row.map((day, ci) => {
                    if (!day) return <View key={ci} style={s.calCell} />;
                    const iso = toIso(day);
                    const selected = deliveryDate === iso;
                    const disabled = isDayDisabled(day);
                    return (
                      <TouchableOpacity
                        key={ci}
                        style={[s.calCell, selected && s.calCellSelected, disabled && s.calCellDisabled]}
                        onPress={() => !disabled && setDeliveryDate(iso)}
                        activeOpacity={disabled ? 1 : 0.75}
                        disabled={disabled}
                      >
                        <Text style={[s.calDayNum, selected && s.calDayNumSelected, disabled && s.calDayNumDisabled]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              {deliveryDate ? (
                <Text style={s.selectedDateText}>Selected: {formatDateLabel(deliveryDate)}</Text>
              ) : (
                <Text style={s.dateHintText}>Tap a date to select</Text>
              )}
            </View>
          )}

          {/* ── Payment Terms / Method ── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="card" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={s.sectionTitle}>{user?.user_type === 'b2b' ? 'Payment Terms' : 'Payment Method'}</Text>
            </View>
            {user?.user_type === 'b2b' ? (
              <View style={s.payTermsCard}>
                <Ionicons name="document-text-outline" size={22} color={COLORS.primary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.payTermsValue}>{paymentTerms ?? 'As per agreement'}</Text>
                  <Text style={s.payTermsSub}>Set by your account manager</Text>
                </View>
                <Ionicons name="lock-closed-outline" size={16} color={COLORS.grayLight} />
              </View>
            ) : (
              PAY_OPTS.map(opt => (
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
              ))
            )}
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
  // ── Payment terms (B2B read-only) ──
  payTermsCard: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
    borderColor: COLORS.primary, borderRadius: 14, padding: 14,
    backgroundColor: COLORS.primaryLight,
  },
  payTermsValue: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  payTermsSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  // ── Calendar ──
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calNavBtn: { padding: 6 },
  calMonthLabel: { fontSize: 15, fontWeight: '800', color: COLORS.dark },
  calDayHeaders: { flexDirection: 'row', marginBottom: 6 },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: COLORS.grayLight, paddingVertical: 4 },
  calRow: { flexDirection: 'row', marginBottom: 4 },
  calCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, margin: 2 },
  calCellSelected: { backgroundColor: COLORS.primary },
  calCellDisabled: { opacity: 0.25 },
  calDayNum: { fontSize: 14, fontWeight: '600', color: COLORS.dark },
  calDayNumSelected: { color: '#fff', fontWeight: '800' },
  calDayNumDisabled: { color: COLORS.grayLight },
  selectedDateText: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 10 },
  dateHintText: { fontSize: 12, color: COLORS.grayLight, marginTop: 10, textAlign: 'center' },
});
