import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

type OrderItem = {
  id: string;
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
  variant_info: string | null;
};

type WarehouseOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  discount: number;
  shipping_cost: number;
  total: number;
  shipping_address: Record<string, string> | null;
  notes: string | null;
  created_at: string;
  customer: { full_name: string | null; email: string; phone: string | null } | null;
  order_items: OrderItem[];
};

type StatusTab = 'all' | OrderStatus;

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:    { label: 'Pending',    color: '#6366F1', bg: '#EEF2FF', icon: 'time-outline' },
  confirmed:  { label: 'Confirmed',  color: COLORS.primary, bg: COLORS.primaryLight, icon: 'checkmark-circle-outline' },
  processing: { label: 'Processing', color: '#D97706', bg: '#FEF3C7', icon: 'construct-outline' },
  shipped:    { label: 'Shipped',    color: '#0891B2', bg: '#E0F2FE', icon: 'bicycle-outline' },
  delivered:  { label: 'Delivered',  color: COLORS.green, bg: COLORS.greenLight, icon: 'bag-check-outline' },
  cancelled:  { label: 'Cancelled',  color: COLORS.red, bg: '#FEE2E2', icon: 'close-circle-outline' },
};

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'pending',    label: 'Pending' },
  { key: 'confirmed',  label: 'Confirmed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped',    label: 'Shipped' },
  { key: 'delivered',  label: 'Delivered' },
  { key: 'cancelled',  label: 'Cancelled' },
];

const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped:    ['delivered', 'cancelled'],
};

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onUpdateStatus,
}: {
  order: WarehouseOrder;
  onUpdateStatus: (order: WarehouseOrder) => void;
}) {
  const meta = STATUS_META[order.status] ?? STATUS_META.pending;
  const addr = order.shipping_address;
  const customerName = order.customer?.full_name || order.customer?.email || 'Customer';

  return (
    <View style={card.container}>
      {/* Header */}
      <View style={card.header}>
        <View>
          <Text style={card.orderNo}>{order.order_number}</Text>
          <Text style={card.date}>
            {new Date(order.created_at).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
          </Text>
        </View>
        <View style={[card.badge, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon as any} size={12} color={meta.color} style={{ marginRight: 4 }} />
          <Text style={[card.badgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      {/* Customer */}
      <View style={card.row}>
        <Ionicons name="person-outline" size={14} color={COLORS.gray} />
        <Text style={card.rowText}>{customerName}</Text>
        {order.customer?.phone ? (
          <Text style={card.phone}>{order.customer.phone}</Text>
        ) : null}
      </View>

      {/* Address */}
      {addr ? (
        <View style={card.row}>
          <Ionicons name="location-outline" size={14} color={COLORS.gray} />
          <Text style={card.rowText} numberOfLines={1}>
            {[addr.street, addr.city, addr.state].filter(Boolean).join(', ')}
          </Text>
        </View>
      ) : null}

      {/* Items */}
      <View style={card.itemsList}>
        {order.order_items.slice(0, 3).map((item) => (
          <Text key={item.id} style={card.itemText} numberOfLines={1}>
            • {item.name}{item.variant_info ? ` (${item.variant_info})` : ''} × {item.quantity}
          </Text>
        ))}
        {order.order_items.length > 3 && (
          <Text style={card.itemMore}>+ {order.order_items.length - 3} more items</Text>
        )}
      </View>

      {/* Footer */}
      <View style={card.footer}>
        <Text style={card.total}>₹{Number(order.total).toLocaleString('en-IN')}</Text>
        <View style={card.payRow}>
          <Text style={card.payMethod}>
            {order.payment_method === 'cod' ? 'COD' : 'Online'}
          </Text>
          <View style={[card.payBadge, order.payment_status === 'paid' ? card.payBadgePaid : card.payBadgePending]}>
            <Text style={[card.payBadgeText, order.payment_status === 'paid' ? card.payTextPaid : card.payTextPending]}>
              {order.payment_status}
            </Text>
          </View>
        </View>

        {NEXT_STATUSES[order.status] && (
          <TouchableOpacity
            style={card.updateBtn}
            onPress={() => onUpdateStatus(order)}
            activeOpacity={0.8}
          >
            <Text style={card.updateBtnText}>Update Status</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WarehouseDashboardScreen() {
  const { token, user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<WarehouseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusTab>('all');

  // Status update modal
  const [selectedOrder, setSelectedOrder] = useState<WarehouseOrder | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/mobile/warehouse/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as { data?: WarehouseOrder[]; error?: string };
      if (res.ok) setOrders(json.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void fetchOrders(); }, [fetchOrders]);

  const onRefresh = () => { setRefreshing(true); void fetchOrders(); };

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!selectedOrder || !token) return;
    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/api/mobile/warehouse/orders`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: selectedOrder.id, status: newStatus }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (res.ok && json.success) {
        setOrders((prev) =>
          prev.map((o) => o.id === selectedOrder.id ? { ...o, status: newStatus } : o)
        );
        setSelectedOrder(null);
      } else {
        Alert.alert('Error', json.error ?? 'Failed to update status');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  const filtered = activeTab === 'all'
    ? orders
    : orders.filter((o) => o.status === activeTab);

  const counts: Record<string, number> = { all: orders.length };
  for (const o of orders) {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  }

  if (loading) {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { paddingTop: 4 }]}>
        <View>
          <Text style={s.headerTitle}>Warehouse Orders</Text>
          <Text style={s.headerSub}>{user?.full_name || user?.email || 'Warehouse Admin'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.red} />
        </TouchableOpacity>
      </View>

      {/* Summary chips */}
      <View style={s.summaryRow}>
        {(['pending', 'processing', 'shipped'] as OrderStatus[]).map((s2) => (
          <TouchableOpacity
            key={s2}
            style={[s.chip, { backgroundColor: STATUS_META[s2].bg }]}
            onPress={() => setActiveTab(s2)}
            activeOpacity={0.8}
          >
            <Text style={[s.chipCount, { color: STATUS_META[s2].color }]}>{counts[s2] ?? 0}</Text>
            <Text style={[s.chipLabel, { color: STATUS_META[s2].color }]}>{STATUS_META[s2].label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabsContainer}
        style={s.tabsScroll}
      >
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
              {tab.label}
              {counts[tab.key] ? ` (${counts[tab.key]})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders list */}
      <FlatList
        data={filtered}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => (
          <OrderCard order={item} onUpdateStatus={(o) => setSelectedOrder(o)} />
        )}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={52} color={COLORS.grayLight} />
            <Text style={s.emptyTitle}>No orders</Text>
            <Text style={s.emptySub}>No {activeTab !== 'all' ? activeTab + ' ' : ''}orders found for this warehouse.</Text>
          </View>
        }
      />

      {/* Status update modal */}
      <Modal
        visible={!!selectedOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={m.overlay}>
          <View style={m.sheet}>
            <Text style={m.title}>Update Order Status</Text>
            <Text style={m.orderNo}>{selectedOrder?.order_number}</Text>
            <Text style={m.current}>
              Current: <Text style={{ color: STATUS_META[selectedOrder?.status ?? 'pending']?.color }}>
                {STATUS_META[selectedOrder?.status ?? 'pending']?.label}
              </Text>
            </Text>

            <View style={m.options}>
              {(NEXT_STATUSES[selectedOrder?.status ?? 'pending'] ?? []).map((status) => {
                const meta = STATUS_META[status];
                return (
                  <TouchableOpacity
                    key={status}
                    style={[m.option, { backgroundColor: meta.bg, borderColor: meta.color }]}
                    onPress={() => void handleUpdateStatus(status)}
                    disabled={updating}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                    <Text style={[m.optionText, { color: meta.color }]}>{meta.label}</Text>
                    {updating && <ActivityIndicator size="small" color={meta.color} style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={m.cancelBtn} onPress={() => setSelectedOrder(null)} disabled={updating}>
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.dark },
  headerSub:   { fontSize: 12, color: COLORS.gray, marginTop: 1 },
  logoutBtn:   { padding: 6 },
  summaryRow:  { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  chip:        { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  chipCount:   { fontSize: 22, fontWeight: '800' },
  chipLabel:   { fontSize: 11, fontWeight: '600', marginTop: 2 },
  tabsScroll:  { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border, maxHeight: 44 },
  tabsContainer: { paddingHorizontal: 12, gap: 4, alignItems: 'center' },
  tab:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  tabActive:   { backgroundColor: COLORS.primaryLight },
  tabText:     { fontSize: 13, color: COLORS.gray, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },
  empty:       { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  emptySub:    { fontSize: 13, color: COLORS.gray, textAlign: 'center', paddingHorizontal: 30 },
});

const card = StyleSheet.create({
  container:   { backgroundColor: '#fff', borderRadius: 16, padding: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderNo:     { fontSize: 14, fontWeight: '800', color: COLORS.dark },
  date:        { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  badge:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText:   { fontSize: 11, fontWeight: '700' },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  rowText:     { fontSize: 13, color: COLORS.text, flex: 1 },
  phone:       { fontSize: 12, color: COLORS.gray },
  itemsList:   { backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, marginVertical: 8, gap: 3 },
  itemText:    { fontSize: 12, color: COLORS.text },
  itemMore:    { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  footer:      { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  total:       { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  payRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  payMethod:   { fontSize: 12, color: COLORS.gray },
  payBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  payBadgePaid:    { backgroundColor: '#DCFCE7' },
  payBadgePending: { backgroundColor: '#FEF9C3' },
  payBadgeText: { fontSize: 11, fontWeight: '600' },
  payTextPaid:    { color: '#16A34A' },
  payTextPending: { color: '#CA8A04' },
  updateBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  updateBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
});

const m = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  title:      { fontSize: 18, fontWeight: '800', color: COLORS.dark, marginBottom: 4 },
  orderNo:    { fontSize: 13, color: COLORS.gray, marginBottom: 2 },
  current:    { fontSize: 13, color: COLORS.text, marginBottom: 20 },
  options:    { gap: 12, marginBottom: 20 },
  option:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1.5 },
  optionText: { fontSize: 15, fontWeight: '700' },
  cancelBtn:  { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 15, color: COLORS.gray, fontWeight: '600' },
});
