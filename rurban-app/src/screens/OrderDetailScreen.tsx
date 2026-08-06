import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';
import { Order } from '../lib/api';

/* ─── Status config ─────────────────────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending:    { label: 'Order Placed',  color: '#6366F1', icon: 'receipt-outline' },
  confirmed:  { label: 'Confirmed',     color: COLORS.primary, icon: 'checkmark-circle-outline' },
  processing: { label: 'Processing',    color: COLORS.amber,   icon: 'construct-outline' },
  shipped:    { label: 'On the Way',    color: COLORS.amber,   icon: 'bicycle-outline' },
  delivered:  { label: 'Delivered',     color: COLORS.green,   icon: 'bag-check-outline' },
  cancelled:  { label: 'Cancelled',     color: COLORS.red,     icon: 'close-circle-outline' },
};

const STATUS_FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}

/* ─── Screen ────────────────────────────────────────────────────────────────── */
export default function OrderDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const order: Order = route.params?.order;
  const insets = useSafeAreaInsets();

  if (!order) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.errorWrap}>
          <Text style={s.errorText}>Order not found.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[order.status] ?? STATUS_META['pending'];

  /* ── Tax breakdown grouped by rate (CGST + SGST) ── */
  const taxGroups = new Map<number, { cgst: number; sgst: number }>();
  (order.order_items ?? []).forEach(item => {
    const rate = item.intra_state_tax_rate ?? 0;
    if (rate === 0) return;
    const halfRate = rate / 2;
    const lineTotal = Number(item.price) * item.quantity;
    const existing = taxGroups.get(rate) ?? { cgst: 0, sgst: 0 };
    taxGroups.set(rate, {
      cgst: existing.cgst + (lineTotal * halfRate) / 100,
      sgst: existing.sgst + (lineTotal * halfRate) / 100,
    });
  });
  const totalTax = Array.from(taxGroups.values()).reduce((s, t) => s + t.cgst + t.sgst, 0);

  /* ── Shipping address ── */
  const addr = order.shipping_address ?? {};
  const addrLines = [
    addr.street ?? addr.line1 ?? addr.address_line1,
    [addr.city, addr.state, addr.zip ?? addr.pincode ?? addr.postal_code].filter(Boolean).join(', '),
  ].filter(Boolean);

  /* ── Status progress (don't show for cancelled) ── */
  const currentIdx = STATUS_FLOW.indexOf(order.status as any);
  const showProgress = order.status !== 'cancelled';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backIcon}>
          <Ionicons name="arrow-back" size={22} color={COLORS.dark} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.headerTitle}>{order.order_number}</Text>
          <Text style={s.headerSub}>{formatDate(order.created_at)}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: meta.color + '18' }]}>
          <Ionicons name={meta.icon as any} size={13} color={meta.color} style={{ marginRight: 4 }} />
          <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status Progress Bar ── */}
        {showProgress && (
          <View style={s.section}>
            <View style={s.progressRow}>
              {STATUS_FLOW.map((step, idx) => {
                const done = idx <= currentIdx;
                const stepMeta = STATUS_META[step];
                return (
                  <React.Fragment key={step}>
                    <View style={s.progressStep}>
                      <View style={[s.progressDot, done && { backgroundColor: stepMeta.color }]}>
                        <Ionicons
                          name={done ? 'checkmark' : 'ellipse-outline'}
                          size={done ? 12 : 10}
                          color={done ? '#fff' : COLORS.border}
                        />
                      </View>
                      <Text style={[s.progressLabel, done && { color: stepMeta.color, fontWeight: '700' }]} numberOfLines={1}>
                        {stepMeta.label}
                      </Text>
                    </View>
                    {idx < STATUS_FLOW.length - 1 && (
                      <View style={[s.progressLine, idx < currentIdx && { backgroundColor: COLORS.primary }]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Payment Info ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Payment</Text>
          <View style={s.infoGrid}>
            <View style={s.infoCell}>
              <Text style={s.infoLabel}>Method</Text>
              <Text style={s.infoValue}>{(order.payment_method ?? 'COD').toUpperCase()}</Text>
            </View>
            <View style={s.infoCell}>
              <Text style={s.infoLabel}>Status</Text>
              <Text style={[s.infoValue, {
                color: order.payment_status === 'paid' ? COLORS.green :
                  order.payment_status === 'failed' ? COLORS.red : COLORS.amber,
              }]}>{order.payment_status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* ── Shipping Address ── */}
        {addrLines.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Delivery Address</Text>
            <View style={s.addrBox}>
              <Ionicons name="location-outline" size={18} color={COLORS.primary} style={{ marginRight: 10, marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                {[`${addr.firstName ?? addr.full_name ?? ''} ${addr.lastName ?? ''}`.trim(), ...addrLines, addr.phone ? `Ph: ${addr.phone}` : null]
                  .filter(Boolean)
                  .map((line, i) => (
                    <Text key={i} style={[s.addrLine, i === 0 && s.addrName]}>{line}</Text>
                  ))}
              </View>
            </View>
          </View>
        )}

        {/* ── Items ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>
            Items ({(order.order_items ?? []).reduce((s, i) => s + i.quantity, 0)})
          </Text>
          {(order.order_items ?? []).map((item, idx) => {
            const lineAmt = Number(item.price) * item.quantity;
            const rate = item.intra_state_tax_rate ?? 0;
            const halfRate = rate / 2;
            const gstAmt = (lineAmt * rate) / 100;
            return (
              <View key={item.id ?? idx} style={[s.itemRow, idx > 0 && s.itemRowBorder]}>
                {/* Image */}
                <View style={s.itemImg}>
                  {item.image_url
                    ? <Image source={{ uri: item.image_url }} style={s.itemImgFull} resizeMode="cover" />
                    : <Ionicons name="cube-outline" size={26} color={COLORS.primary} />}
                </View>
                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
                  {item.variant_info && (
                    <Text style={s.itemVariant}>{item.variant_info}</Text>
                  )}
                  {item.hsn_or_sac && (
                    <Text style={s.itemHsn}>HSN: {item.hsn_or_sac}</Text>
                  )}
                  <View style={s.itemPriceRow}>
                    <Text style={s.itemPrice}>Rs.{fmt(Number(item.price))}</Text>
                    <Text style={s.itemQty}>× {item.quantity}{item.zoho_unit ? ` ${item.zoho_unit}` : ''}</Text>
                    <Text style={s.itemTotal}>= Rs.{fmt(lineAmt)}</Text>
                  </View>
                  {rate > 0 && (
                    <Text style={s.itemGst}>
                      CGST {halfRate}% + SGST {halfRate}% = Rs.{fmt(gstAmt)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Bill Summary ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Bill Summary</Text>
          <View style={s.summaryBox}>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Sub Total</Text>
              <Text style={s.summaryValue}>{fmt(Number(order.subtotal))}</Text>
            </View>

            {/* Per-rate tax breakdown — CGST + SGST at half the GST rate each */}
            {Array.from(taxGroups.entries()).map(([rate, amounts]) => (
              <React.Fragment key={rate}>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>CGST ({rate / 2}%)</Text>
                  <Text style={s.summaryValue}>{fmt(amounts.cgst)}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>SGST ({rate / 2}%)</Text>
                  <Text style={s.summaryValue}>{fmt(amounts.sgst)}</Text>
                </View>
              </React.Fragment>
            ))}

            {/* Fallback: use stored tax if per-item breakdown is unavailable */}
            {taxGroups.size === 0 && Number(order.tax ?? 0) > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>GST</Text>
                <Text style={s.summaryValue}>{fmt(Number(order.tax))}</Text>
              </View>
            )}

            {Number(order.discount) > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Discount</Text>
                <Text style={[s.summaryValue, { color: COLORS.green }]}>−{fmt(Number(order.discount))}</Text>
              </View>
            )}

            {Number(order.shipping_cost) > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Shipping</Text>
                <Text style={s.summaryValue}>{fmt(Number(order.shipping_cost))}</Text>
              </View>
            )}

            <View style={s.divider} />
            <View style={s.summaryRow}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalValue}>₹{fmt(Number(order.total))}</Text>
            </View>
          </View>
        </View>

        {/* ── Notes ── */}
        {order.notes && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Notes</Text>
            <View style={s.notesBox}>
              <Ionicons name="document-text-outline" size={16} color={COLORS.gray} style={{ marginRight: 8 }} />
              <Text style={s.notesText}>{order.notes}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backIcon: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  headerSub: { fontSize: 11, color: COLORS.grayLight, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  scroll: { padding: 14, gap: 12 },

  /* Sections */
  section: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.dark, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.4 },

  /* Progress */
  progressRow: { flexDirection: 'row', alignItems: 'flex-start' },
  progressStep: { alignItems: 'center', width: 52 },
  progressDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginBottom: 5,
  },
  progressLabel: { fontSize: 9, color: COLORS.grayLight, textAlign: 'center', lineHeight: 13 },
  progressLine: { flex: 1, height: 2, backgroundColor: COLORS.border, marginTop: 12 },

  /* Payment info */
  infoGrid: { flexDirection: 'row', gap: 12 },
  infoCell: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 12, padding: 12 },
  infoLabel: { fontSize: 11, color: COLORS.grayLight, marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '800', color: COLORS.dark },

  /* Address */
  addrBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.bg, borderRadius: 12, padding: 12 },
  addrLine: { fontSize: 13, color: COLORS.gray, lineHeight: 20 },
  addrName: { fontWeight: '700', color: COLORS.dark },

  /* Items */
  itemRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  itemRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  itemImg: {
    width: 64, height: 64, borderRadius: 12, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border, flexShrink: 0,
  },
  itemImgFull: { width: 64, height: 64 },
  itemName: { fontSize: 13, fontWeight: '700', color: COLORS.dark, lineHeight: 18, marginBottom: 2 },
  itemVariant: { fontSize: 11, color: COLORS.grayLight, marginBottom: 2 },
  itemHsn: { fontSize: 10, color: COLORS.grayLight, marginBottom: 4 },
  itemPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  itemPrice: { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  itemQty: { fontSize: 12, color: COLORS.grayLight },
  itemTotal: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  itemGst: { fontSize: 11, color: COLORS.gray, marginTop: 3 },

  /* Summary */
  summaryBox: { gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, color: COLORS.gray },
  summaryValue: { fontSize: 13, fontWeight: '600', color: COLORS.dark },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  totalValue: { fontSize: 18, fontWeight: '900', color: COLORS.primary },

  /* Notes */
  notesBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.bg, borderRadius: 12, padding: 12 },
  notesText: { flex: 1, fontSize: 13, color: COLORS.gray, lineHeight: 19 },

  /* Error */
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 16, color: COLORS.gray, marginBottom: 16 },
  backBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
