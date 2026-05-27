import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, ActivityIndicator, Alert, RefreshControl,
  Image, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';
import { useAuth } from '../context/AuthContext';
import { fetchOrders, submitReview, Order, PendingReview } from '../lib/api';

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending:    { label: 'Order Placed', color: '#6366F1', icon: 'receipt-outline' },
  confirmed:  { label: 'Confirmed',    color: COLORS.primary, icon: 'checkmark-circle-outline' },
  processing: { label: 'Processing',   color: COLORS.amber,   icon: 'construct-outline' },
  shipped:    { label: 'On the Way',   color: COLORS.amber,   icon: 'bicycle-outline' },
  delivered:  { label: 'Delivered',    color: COLORS.green,   icon: 'bag-check-outline' },
  cancelled:  { label: 'Cancelled',    color: COLORS.red,     icon: 'close-circle-outline' },
};

type Tab = 'upcoming' | 'completed';

export default function OrdersScreen() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [currentReview, setCurrentReview] = useState<PendingReview | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const loadOrders = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchOrders(token);
      setOrders(data.data?.orders ?? []);
      const pending = data.data?.pending_reviews ?? [];
      setPendingReviews(pending);
      if (pending.length > 0 && !reviewModal) {
        setCurrentReview(pending[0]);
        setRating(5);
        setReviewText('');
        setReviewModal(true);
      }
    } catch (e) {
      console.error('Failed to load orders', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleSubmitReview = async () => {
    if (!token || !currentReview) return;
    setSubmitting(true);
    try {
      await submitReview(token, {
        product_id: currentReview.product_id,
        rating,
        comment: reviewText || undefined,
      });
      const remaining = pendingReviews.filter(r => r.product_id !== currentReview.product_id);
      setPendingReviews(remaining);
      if (remaining.length > 0) {
        setCurrentReview(remaining[0]);
        setRating(5);
        setReviewText('');
      } else {
        setReviewModal(false);
        Alert.alert('Thank you!', 'Your review has been submitted.');
      }
    } catch {
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const upcoming  = orders.filter(o => ['pending','confirmed','processing','shipped'].includes(o.status));
  const completed = orders.filter(o => ['delivered','cancelled'].includes(o.status));
  const list = tab === 'upcoming' ? upcoming : completed;

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Ionicons name="receipt" size={22} color={COLORS.primary} style={{ marginRight: 8 }} />
          <Text style={s.title}>My Orders</Text>
        </View>
        {pendingReviews.length > 0 && (
          <TouchableOpacity
            style={s.reviewBell}
            onPress={() => { setCurrentReview(pendingReviews[0]); setRating(5); setReviewText(''); setReviewModal(true); }}
          >
            <Ionicons name="star" size={16} color={COLORS.amber} />
            <Text style={s.reviewBellText}>{pendingReviews.length}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['upcoming','completed'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'upcoming' ? `Upcoming (${upcoming.length})` : `Completed (${completed.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.loadingWrap}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={o => o.id}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} colors={[COLORS.primary]} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="receipt-outline" size={64} color={COLORS.grayLight} style={{ marginBottom: 14 }} />
              <Text style={s.emptyTitle}>No {tab} orders</Text>
              <Text style={s.emptySub}>Your {tab} orders will appear here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status] ?? STATUS_META['pending'];
            const imgs = item.order_items?.map(i => i.image_url).filter(Boolean) ?? [];
            const names = item.order_items?.map(i => i.name ?? 'Item') ?? [];
            const totalItems = item.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
            return (
              <View style={[s.card, { borderLeftColor: meta.color, borderLeftWidth: 4 }]}>
                {/* ── Top row ── */}
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.orderNo}>{item.order_number}</Text>
                    <Text style={s.orderDate}>{formatDate(item.created_at)}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: meta.color + '18' }]}>
                    <Ionicons name={meta.icon as any} size={13} color={meta.color} style={{ marginRight: 4 }} />
                    <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>

                {/* ── Product image strip ── */}
                {imgs.length > 0 && (
                  <View style={s.imgStrip}>
                    {imgs.slice(0, 4).map((url, idx) => (
                      <View key={idx} style={s.imgThumbWrap}>
                        <Image source={{ uri: url! }} style={s.imgThumb} resizeMode="cover" />
                        {idx === 3 && imgs.length > 4 && (
                          <View style={s.imgMore}>
                            <Text style={s.imgMoreText}>+{imgs.length - 4}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                    <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 10 }}>
                      <Text style={s.imgStripNames} numberOfLines={2}>
                        {names.slice(0, 2).join(', ')}{names.length > 2 ? ` +${names.length - 2} more` : ''}
                      </Text>
                      <Text style={s.imgStripCount}>{totalItems} item{totalItems !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                )}
                {imgs.length === 0 && (
                  <View style={s.noImgRow}>
                    <Ionicons name="cube-outline" size={18} color={COLORS.grayLight} style={{ marginRight: 6 }} />
                    <Text style={s.imgStripNames} numberOfLines={1}>
                      {names.slice(0, 2).join(', ')}{names.length > 2 ? ` +${names.length - 2}` : ''}
                    </Text>
                  </View>
                )}

                {/* ── Bottom row ── */}
                <View style={s.cardBottom}>
                  <View>
                    <Text style={s.totalLabel}>Order Total</Text>
                    <Text style={s.totalValue}>Rs.{Number(item.total).toFixed(0)}</Text>
                  </View>
                  {tab === 'upcoming' ? (
                    <TouchableOpacity style={s.trackBtn} activeOpacity={0.85}>
                      <Ionicons name="navigate-outline" size={14} color={COLORS.primary} style={{ marginRight: 5 }} />
                      <Text style={s.trackBtnText}>Track Order</Text>
                    </TouchableOpacity>
                  ) : item.status === 'delivered' ? (
                    <TouchableOpacity
                      style={s.reviewOrderBtn}
                      activeOpacity={0.85}
                      onPress={() => {
                        const firstItem = item.order_items?.[0];
                        if (firstItem) {
                          setCurrentReview({
                            product_id: firstItem.product_id ?? '',
                            order_id: item.id,
                            product_name: firstItem.name ?? 'Product',
                            image_url: firstItem.image_url ?? null,
                          });
                          setRating(5);
                          setReviewText('');
                          setReviewModal(true);
                        }
                      }}
                    >
                      <Ionicons name="star" size={14} color={COLORS.amber} style={{ marginRight: 5 }} />
                      <Text style={s.reviewOrderBtnText}>Rate & Review</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Review Modal */}
      <Modal visible={reviewModal} transparent animationType="slide" onRequestClose={() => setReviewModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            {/* Decorative top bar */}
            <View style={s.modalTopBar} />

            {/* Close button */}
            <TouchableOpacity style={s.modalClose} onPress={() => setReviewModal(false)}>
              <Ionicons name="close" size={20} color={COLORS.gray} />
            </TouchableOpacity>

            {currentReview && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Product image + name */}
                <View style={s.productRow}>
                  <View style={s.productImgWrap}>
                    {currentReview.image_url
                      ? <Image source={{ uri: currentReview.image_url }} style={s.productImg} resizeMode="cover" />
                      : <Ionicons name="cube-outline" size={36} color={COLORS.primary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalEyebrow}>Tell us what you think</Text>
                    <Text style={s.modalProductName} numberOfLines={2}>{currentReview.product_name}</Text>
                  </View>
                </View>

                {/* Stars */}
                <Text style={s.modalSubtext}>How would you rate this product?</Text>
                <View style={s.starsRow}>
                  {[1,2,3,4,5].map(star => (
                    <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7} style={s.starBtn}>
                      <Ionicons
                        name={rating >= star ? 'star' : 'star-outline'}
                        size={42}
                        color={rating >= star ? COLORS.amber : '#D1D5DB'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={[s.ratingPill, { backgroundColor: COLORS.amber + '20' }]}>
                  <Ionicons name="star" size={13} color={COLORS.amber} style={{ marginRight: 5 }} />
                  <Text style={s.ratingLabel}>{['','Poor','Fair','Good','Very Good','Excellent'][rating]}</Text>
                </View>

                {/* Text input */}
                <TextInput
                  style={s.reviewInput}
                  placeholder="Share your experience (optional)..."
                  placeholderTextColor={COLORS.grayLight}
                  value={reviewText}
                  onChangeText={setReviewText}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                {pendingReviews.length > 1 && (
                  <View style={s.moreReviewsRow}>
                    <Ionicons name="layers-outline" size={14} color={COLORS.grayLight} style={{ marginRight: 4 }} />
                    <Text style={s.moreReviews}>{pendingReviews.length - 1} more product{pendingReviews.length > 2 ? 's' : ''} to review after this</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.submitReviewBtn, submitting && { opacity: 0.7 }]}
                  onPress={handleSubmitReview}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <>
                        <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 7 }} />
                        <Text style={s.submitReviewBtnText}>Submit Review</Text>
                      </>}
                </TouchableOpacity>

                <TouchableOpacity style={s.skipBtn} onPress={() => setReviewModal(false)}>
                  <Text style={s.skipBtnText}>Maybe later</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, backgroundColor: COLORS.white },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.dark },
  reviewBell: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.amber + '20', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  reviewBellText: { fontSize: 12, fontWeight: '800', color: COLORS.amber },
  tabRow: { flexDirection: 'row', backgroundColor: COLORS.white, paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: COLORS.bg, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border },
  tabActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.gray },
  tabTextActive: { color: COLORS.primary, fontWeight: '800' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 14, gap: 14 },
  // Card
  card: { backgroundColor: COLORS.white, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  orderNo: { fontSize: 13, fontWeight: '800', color: COLORS.dark, letterSpacing: 0.2 },
  orderDate: { fontSize: 12, color: COLORS.grayLight, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  // Image strip
  imgStrip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  imgThumbWrap: { width: 58, height: 58, borderRadius: 12, overflow: 'hidden', marginRight: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, position: 'relative' },
  imgThumb: { width: '100%', height: '100%' },
  imgMore: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  imgMoreText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  imgStripNames: { fontSize: 13, fontWeight: '600', color: COLORS.dark, lineHeight: 18 },
  imgStripCount: { fontSize: 12, color: COLORS.grayLight, marginTop: 2 },
  noImgRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  // Bottom
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.border },
  totalLabel: { fontSize: 11, color: COLORS.grayLight, marginBottom: 2 },
  totalValue: { fontSize: 16, fontWeight: '900', color: COLORS.dark },
  trackBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: COLORS.primary },
  trackBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  reviewOrderBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.amber + '18', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: COLORS.amber },
  reviewOrderBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.amber },
  emptyWrap: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark, marginBottom: 6 },
  emptySub: { fontSize: 14, color: COLORS.grayLight },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 22, paddingBottom: 32, paddingTop: 10, maxHeight: '90%' },
  modalTopBar: { width: 44, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  modalClose: { position: 'absolute', top: 18, right: 20, width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20, backgroundColor: COLORS.bg, borderRadius: 18, padding: 14 },
  productImgWrap: { width: 72, height: 72, borderRadius: 14, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  productImg: { width: 72, height: 72 },
  modalEyebrow: { fontSize: 11, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  modalProductName: { fontSize: 16, fontWeight: '800', color: COLORS.dark, lineHeight: 22 },
  modalSubtext: { fontSize: 14, color: COLORS.gray, marginBottom: 16, textAlign: 'center' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12, gap: 6 },
  starBtn: { padding: 4 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 20 },
  ratingLabel: { fontSize: 14, fontWeight: '800', color: COLORS.amber },
  reviewInput: { backgroundColor: COLORS.bg, borderRadius: 14, padding: 14, fontSize: 14, color: COLORS.dark, minHeight: 80, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  moreReviewsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  moreReviews: { fontSize: 12, color: COLORS.grayLight },
  submitReviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, marginBottom: 12 },
  submitReviewBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  skipBtn: { alignItems: 'center', paddingVertical: 6 },
  skipBtnText: { fontSize: 13, color: COLORS.grayLight },
});
