import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../lib/api';

// Exchange a refresh token for a fresh access token. Module-level (no hooks) so
// both the launch-restore flow and the authenticated refresh path can use it.
// Returns null on any failure (network error, or an invalid/expired refresh
// token) — callers decide how to treat null.
async function requestRefresh(
  refreshToken: string,
  timeoutMs = 8000,
): Promise<{ access_token: string; refresh_token?: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${API_BASE}/api/mobile/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.access_token) return null;
    return { access_token: json.access_token, refresh_token: json.refresh_token };
  } catch {
    return null;
  }
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  avatar_url: string;
  role: string;
  user_type: 'b2c' | 'b2b';
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string, fullName: string) => Promise<{ error?: string; requires_verification?: boolean }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
  // Wraps fetch() to automatically refresh the JWT on 401 and retry once
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY_TOKEN         = 'rurban_access_token';
const STORAGE_KEY_REFRESH_TOKEN = 'rurban_refresh_token';
const STORAGE_KEY_USER          = 'rurban_user';

// Sensitive tokens → SecureStore (encrypted device keystore)
// Non-sensitive user profile → AsyncStorage (larger storage limit)
const tokenStore = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Holds current refresh token in memory to avoid repeated secure store reads
  const refreshTokenRef = useRef<string | null>(null);
  // When the access token was last refreshed (ms epoch) — throttles foreground refreshes
  const lastRefreshAtRef = useRef<number>(0);

  // Restore session on launch, proactively refreshing the access token.
  //
  // The stored access token may have expired while the app was closed (e.g.
  // opened again a day or two later). Authenticated screens fetch with whatever
  // token is in context, so if we restored a stale token they'd silently load
  // empty (no products) even though the user is still "logged in". Refreshing
  // here — before the app renders past the loading spinner — guarantees screens
  // mount with a valid token. If the refresh fails (offline, or still valid), we
  // fall back to the stored token rather than forcing a logout.
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedRefresh, storedUser] = await Promise.all([
          tokenStore.getItem(STORAGE_KEY_TOKEN),
          tokenStore.getItem(STORAGE_KEY_REFRESH_TOKEN),
          AsyncStorage.getItem(STORAGE_KEY_USER),
        ]);
        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser) as AuthUser;
          if (!parsedUser.user_type) parsedUser.user_type = 'b2c';
          setUser(parsedUser);
          if (storedRefresh) refreshTokenRef.current = storedRefresh;

          let activeToken = storedToken;
          if (storedRefresh) {
            const refreshed = await requestRefresh(storedRefresh);
            if (refreshed) {
              activeToken = refreshed.access_token;
              await tokenStore.setItem(STORAGE_KEY_TOKEN, refreshed.access_token);
              if (refreshed.refresh_token) {
                await tokenStore.setItem(STORAGE_KEY_REFRESH_TOKEN, refreshed.refresh_token);
                refreshTokenRef.current = refreshed.refresh_token;
              }
              lastRefreshAtRef.current = Date.now();
            }
          }
          setToken(activeToken);
        }
      } catch {
        // ignore storage errors
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (t: string, u: AuthUser, rt?: string) => {
    const ops: Promise<void>[] = [
      tokenStore.setItem(STORAGE_KEY_TOKEN, t),
      AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(u)),
    ];
    if (rt) ops.push(tokenStore.setItem(STORAGE_KEY_REFRESH_TOKEN, rt));
    await Promise.all(ops);
    setToken(t);
    setUser(u);
    if (rt) refreshTokenRef.current = rt;
    lastRefreshAtRef.current = Date.now();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/mobile/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error ?? 'Login failed' };
      await persist(json.access_token, json.user, json.refresh_token);
      return {};
    } catch (err) {
      console.error('[Auth] LOGIN ERROR:', err);
      return { error: 'Login failed. Please try again.' };
    }
  }, [persist]);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/mobile/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error ?? 'Registration failed' };
      if (json.requires_verification) return { requires_verification: true };
      await persist(json.access_token, json.user, json.refresh_token);
      return {};
    } catch {
      return { error: 'Network error. Please try again.' };
    }
  }, [persist]);

  const logout = useCallback(async () => {
    await Promise.all([
      tokenStore.removeItem(STORAGE_KEY_TOKEN),
      tokenStore.removeItem(STORAGE_KEY_REFRESH_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEY_USER),
    ]);
    refreshTokenRef.current = null;
    setToken(null);
    setUser(null);
  }, []);

  // Attempt a silent token refresh using the stored Supabase refresh token.
  // Returns the new access token, or null if refresh fails (forces logout).
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const rt = refreshTokenRef.current;
    if (!rt) return null;
    const refreshed = await requestRefresh(rt);
    if (!refreshed) return null;
    // Persist the new tokens; preserve current user object
    await tokenStore.setItem(STORAGE_KEY_TOKEN, refreshed.access_token);
    if (refreshed.refresh_token) {
      await tokenStore.setItem(STORAGE_KEY_REFRESH_TOKEN, refreshed.refresh_token);
      refreshTokenRef.current = refreshed.refresh_token;
    }
    setToken(refreshed.access_token);
    lastRefreshAtRef.current = Date.now();
    return refreshed.access_token;
  }, []);

  // Refresh the access token when the app returns to the foreground after being
  // backgrounded for a while (throttled to 15 min). Covers the case where the
  // app is left open across days — the token would otherwise expire in the
  // background and screens would fail their next fetch.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      if (!refreshTokenRef.current) return;
      if (Date.now() - lastRefreshAtRef.current < 15 * 60 * 1000) return;
      void refreshAccessToken();
    });
    return () => sub.remove();
  }, [refreshAccessToken]);

  // authFetch — like fetch(), but auto-refreshes JWT on 401 and retries once.
  // Use this for all authenticated API calls in the app.
  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const currentToken = token;
    const headers = new Headers(options.headers);
    if (currentToken) headers.set('Authorization', `Bearer ${currentToken}`);

    const res = await fetch(url, { ...options, headers });
    if (res.status !== 401) return res;

    // Token expired — attempt silent refresh
    const newToken = await refreshAccessToken();
    if (!newToken) {
      // Refresh failed; log the user out so they can re-authenticate
      await logout();
      return res;
    }
    headers.set('Authorization', `Bearer ${newToken}`);
    return fetch(url, { ...options, headers });
  }, [token, refreshAccessToken, logout]);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, updateUser, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
