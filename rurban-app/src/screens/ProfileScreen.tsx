import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { fetchProfile, updateProfile, UserProfile } from '../lib/api';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const { user, token, logout, updateUser } = useAuth();
  const { ids: wishlistIds } = useWishlist();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchProfile(token);
      if (res.data) setProfile(res.data);
    } catch (e) {
      console.error('Failed to load profile', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleOpenEdit = () => {
    setEditName(profile?.full_name ?? user?.full_name ?? '');
    setEditPhone(profile?.phone ?? user?.phone ?? '');
    setEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await updateProfile(token, { full_name: editName.trim(), phone: editPhone.trim() });
      if (res.data) {
        setProfile(res.data);
        updateUser({ full_name: res.data.full_name, phone: res.data.phone });
        setEditModal(false);
      } else {
        Alert.alert('Error', res.error ?? 'Failed to update profile');
      }
    } catch {
      Alert.alert('Error', 'Could not save profile. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const displayName = profile?.full_name || user?.full_name || 'User';
  const displayEmail = profile?.email || user?.email || '';
  const displayPhone = profile?.phone || user?.phone || '';
  const orderCount = profile?.order_count ?? 0;
  const savedAmount = profile?.total_saved ?? 0;

  const MENU_ITEMS: { icon: IoniconName; label: string; sub: string; color: string; onPress?: () => void }[] = [
    { icon: 'cube-outline',             label: 'My Orders',          sub: 'Track and reorder',       color: COLORS.primaryLight, onPress: () => navigation.navigate('Orders') },
    { icon: 'heart-outline',            label: 'Wishlist',            sub: 'Saved for later',         color: '#fee2e2',           onPress: () => navigation.navigate('Home', { screen: 'Wishlist' }) },
    { icon: 'location-outline',         label: 'Saved Addresses',     sub: 'Home, Work...',           color: '#fef9c3' },
    { icon: 'card-outline',             label: 'Payment Methods',     sub: 'Cards, UPI, Wallets',     color: '#f0fdf4' },
    { icon: 'pricetag-outline',         label: 'Coupons & Offers',    sub: 'Save more on orders',     color: '#fef3c7' },
    { icon: 'notifications-outline',    label: 'Notifications',       sub: 'Order updates & offers',  color: '#e0f2fe' },
    { icon: 'shield-checkmark-outline', label: 'Privacy & Security',  sub: 'Manage your data',        color: '#f5f3ff' },
    { icon: 'help-circle-outline',      label: 'Help & Support',      sub: 'FAQs, chat with us',      color: '#fff7ed' },
  ];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 90 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProfile(); }} colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }
      >
        {/* -- Profile Card -- */}
        <View style={s.profileCard}>
          <View style={s.avatarWrap}>
            {loading
              ? <ActivityIndicator color={COLORS.primary} />
              : <Text style={s.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>}
          </View>
          <View style={s.profileInfo}>
            <Text style={s.name}>{displayName}</Text>
            {displayPhone ? <Text style={s.phone}>{displayPhone}</Text> : null}
            <Text style={s.email} numberOfLines={1}>{displayEmail}</Text>
          </View>
          <TouchableOpacity style={s.editBtn} activeOpacity={0.8} onPress={handleOpenEdit}>
            <Ionicons name="create-outline" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={s.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* -- Stats Row -- */}
        <View style={s.statsRow}>
          {[
            [String(orderCount), 'Orders', 'cube-outline'],
            [String(wishlistIds.size), 'Wishlist', 'heart-outline'],
            [`Rs.${savedAmount}`, 'Saved', 'wallet-outline'],
          ].map(([val, lbl, icon], idx) => (
            <View key={lbl} style={[s.statBox, idx < 2 && s.statBorder]}>
              <Ionicons name={icon as IoniconName} size={18} color={COLORS.primary} style={{ marginBottom: 4 }} />
              <Text style={s.statValue}>{val}</Text>
              <Text style={s.statLabel}>{lbl}</Text>
            </View>
          ))}
        </View>

        {/* -- Menu -- */}
        <View style={s.menuCard}>
          {MENU_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              style={[s.menuItem, idx < MENU_ITEMS.length - 1 && s.menuBorder]}
              activeOpacity={0.72}
              onPress={item.onPress}
            >
              <View style={[s.menuIconWrap, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon} size={20} color={COLORS.primary} />
              </View>
              <View style={s.menuText}>
                <Text style={s.menuLabel}>{item.label}</Text>
                <Text style={s.menuSub}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.grayLight} />
            </TouchableOpacity>
          ))}
        </View>

        {/* -- Logout -- */}
        <TouchableOpacity style={s.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.red} style={{ marginRight: 8 }} />
          <Text style={s.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={s.version}>Rurban v1.0.0</Text>
      </ScrollView>

      {/* -- Edit Profile Modal -- */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            <Text style={s.inputLabel}>Full Name</Text>
            <View style={s.inputWrap}>
              <Ionicons name="person-outline" size={18} color={COLORS.grayLight} style={{ marginRight: 10 }} />
              <TextInput
                style={s.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={COLORS.grayLight}
                autoCapitalize="words"
              />
            </View>
            <Text style={s.inputLabel}>Phone Number</Text>
            <View style={s.inputWrap}>
              <Ionicons name="call-outline" size={18} color={COLORS.grayLight} style={{ marginRight: 10 }} />
              <TextInput
                style={s.input}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="+91 XXXXX XXXXX"
                placeholderTextColor={COLORS.grayLight}
                keyboardType="phone-pad"
              />
            </View>
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSaveProfile}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  avatarWrap: { width: 66, height: 66, borderRadius: 33, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  avatarInitial: { fontSize: 28, fontWeight: '900', color: COLORS.primary },
  profileInfo: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: COLORS.dark, marginBottom: 2 },
  phone: { fontSize: 13, color: COLORS.gray, marginBottom: 2 },
  email: { fontSize: 12, color: COLORS.grayLight },
  editBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  editBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 20, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statBorder: { borderRightWidth: 1, borderRightColor: COLORS.border },
  statValue: { fontSize: 18, fontWeight: '900', color: COLORS.primary, marginBottom: 2 },
  statLabel: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  menuCard: { backgroundColor: COLORS.white, borderRadius: 20, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.bg },
  menuIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: COLORS.dark, marginBottom: 2 },
  menuSub: { fontSize: 12, color: COLORS.grayLight },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, borderRadius: 16, paddingVertical: 15, marginBottom: 14, borderWidth: 1, borderColor: '#fecdd3' },
  logoutText: { color: COLORS.red, fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, color: COLORS.grayLight },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: COLORS.dark },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.gray, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, fontSize: 15, color: COLORS.dark },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
