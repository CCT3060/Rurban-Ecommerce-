import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, API_BASE } from '../lib/api';

const CART_STORAGE_KEY = '@rurban_cart';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  totalQty: number;
  totalPrice: number;
  totalGst: number;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  setQty: (productId: string, qty: number, product: Product) => void;
  clearCart: () => void;
  getQty: (productId: string) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Merge GST rate from whichever field the API returned (gst_rate or raw DB column) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withGstRate(product: Product): Product {
  const rate = product.gst_rate ?? (product as any).intra_state_tax_rate ?? null;
  return rate === product.gst_rate ? product : { ...product, gst_rate: rate != null ? Number(rate) : null };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Restore cart from storage on mount, normalising gst_rate immediately so the
  // GST line is correct on the very first render for items that already carry a
  // tax field. Items missing tax data entirely are healed by the effect below.
  useEffect(() => {
    AsyncStorage.getItem(CART_STORAGE_KEY)
      .then(stored => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as CartItem[];
        if (!Array.isArray(parsed) || parsed.length === 0) return;
        setItems(parsed.map(item => ({ ...item, product: withGstRate(item.product) })));
      })
      .catch(() => { });
  }, []);

  // Persist cart to storage whenever it changes
  useEffect(() => {
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)).catch(() => { });
  }, [items]);

  // ── Self-healing GST ────────────────────────────────────────────────────────
  // Any item whose GST rate is still unknown — neither gst_rate nor
  // intra_state_tax_rate present (e.g. products cached before tax data existed) —
  // gets its rate fetched fresh from the server and patched in. Runs on every
  // cart change, so it works regardless of WHEN the stale item was added, not
  // just at app start. The ref tracks attempted ids to avoid refetch loops, and
  // products that genuinely have no GST simply stay at 0.
  const gstHealAttempted = useRef<Set<string>>(new Set());
  useEffect(() => {
    const missingIds = items
      .filter(i => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = i.product as any;
        const rateKnown = p.gst_rate != null || p.intra_state_tax_rate != null;
        return !rateKnown && !gstHealAttempted.current.has(i.product.id);
      })
      .map(i => i.product.id);

    if (missingIds.length === 0) return;
    missingIds.forEach(id => gstHealAttempted.current.add(id));

    fetch(`${API_BASE}/api/products?ids=${encodeURIComponent(missingIds.join(','))}`)
      .then(r => r.json())
      .then((data: { data?: unknown[] }) => {
        const fresh = (data.data ?? []) as unknown[];
        if (fresh.length === 0) return;
        const rateById = new Map<string, number>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (fresh as any[]).forEach((p: any) => {
          const rate = p.gst_rate ?? p.intra_state_tax_rate;
          if (rate != null) rateById.set(p.id, Number(rate));
        });
        if (rateById.size === 0) return;
        setItems(prev => prev.map(item => {
          const rate = rateById.get(item.product.id);
          if (rate == null) return item;
          return { ...item, product: { ...item.product, gst_rate: rate } };
        }));
      })
      .catch(() => {
        // Offline / error — un-mark so a later cart change retries the fetch.
        missingIds.forEach(id => gstHealAttempted.current.delete(id));
      });
  }, [items]);

  const addItem = useCallback((product: Product) => {
    setItems(prev => {
      if (product.stock <= 0) return prev; // out of stock
      const p = withGstRate(product); // normalise gst_rate from whichever field is present
      const existing = prev.find(i => i.product.id === p.id);
      if (existing) {
        if (existing.quantity >= p.stock) return prev; // already at stock limit
        return prev.map(i =>
          i.product.id === p.id ? { ...i, product: p, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product: p, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === productId);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter(i => i.product.id !== productId);
      return prev.map(i =>
        i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i
      );
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    AsyncStorage.removeItem(CART_STORAGE_KEY).catch(() => { });
  }, []);

  const setQty = useCallback((productId: string, qty: number, product: Product) => {
    setItems(prev => {
      const p = withGstRate(product);
      const clamped = Math.max(0, Math.min(qty, p.stock));
      if (clamped === 0) return prev.filter(i => i.product.id !== productId);
      const existing = prev.find(i => i.product.id === productId);
      if (existing) return prev.map(i => i.product.id === productId ? { ...i, product: p, quantity: clamped } : i);
      return [...prev, { product: p, quantity: clamped }];
    });
  }, []);

  const getQty = useCallback((productId: string) =>
    items.find(i => i.product.id === productId)?.quantity ?? 0, [items]);

  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => {
    const price = i.product.sale_price ? Number(i.product.sale_price) : Number(i.product.price);
    return sum + price * i.quantity;
  }, 0);
  // GST total — line price × qty × gst_rate%.
  // withGstRate() normalises on load/add/setQty, but keep intra_state_tax_rate
  // as a last-resort fallback for any item that bypassed normalisation.
  const totalGst = items.reduce((sum, i) => {
    const price = i.product.sale_price ? Number(i.product.sale_price) : Number(i.product.price);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rate = Number(i.product.gst_rate ?? (i.product as any).intra_state_tax_rate ?? 0);
    return sum + (price * i.quantity * rate) / 100;
  }, 0);

  return (
    <CartContext.Provider value={{ items, totalQty, totalPrice, totalGst, addItem, removeItem, setQty, clearCart, getQty }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
