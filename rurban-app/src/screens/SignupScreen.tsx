import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';
import { useAuth } from '../context/AuthContext';

export default function SignupScreen({ navigation }: { navigation: any }) {
  const { register } = useAuth();
  const [fullName, setFullName]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const handleRegister = async () => {
    setError('');
    if (!fullName.trim()) { setError('Full name is required'); return; }
    if (!email.trim())    { setError('Email is required'); return; }
    if (!password)        { setError('Password is required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    const result = await register(email.trim(), password, fullName.trim());
    setLoading(false);

    if (result.error) { setError(result.error); return; }
    // On success, App.tsx re-renders automatically to main tabs
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.dark} />
          </TouchableOpacity>

          <View style={s.header}>
            <Text style={s.title}>Create Account</Text>
            <Text style={s.sub}>Join Rurban for fresh deals</Text>
          </View>

          <View style={s.card}>
            {!!error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.red} style={{ marginRight: 6 }} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <Text style={s.label}>Full Name</Text>
            <View style={s.inputWrap}>
              <Ionicons name="person-outline" size={18} color={COLORS.grayLight} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Archit Kumar"
                placeholderTextColor={COLORS.grayLight}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            <Text style={s.label}>Email</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={COLORS.grayLight} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.grayLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={s.label}>Password</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.grayLight} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Min. 6 characters"
                placeholderTextColor={COLORS.grayLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.grayLight} />
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Confirm Password</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.grayLight} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Re-enter password"
                placeholderTextColor={COLORS.grayLight}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showPass}
              />
            </View>

            <TouchableOpacity style={s.registerBtn} onPress={handleRegister} activeOpacity={0.85} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.registerBtnText}>Create Account</Text>}
            </TouchableOpacity>
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={s.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center',
    marginBottom: 24, alignSelf: 'flex-start',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  header: { marginBottom: 28 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.dark },
  sub: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  errorText: { fontSize: 13, color: COLORS.red, flex: 1 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    paddingHorizontal: 14, height: 52, backgroundColor: COLORS.bg, marginBottom: 16,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.dark },
  eyeBtn: { padding: 4 },
  registerBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, height: 54,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  registerBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14, color: COLORS.gray },
  loginLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
});
