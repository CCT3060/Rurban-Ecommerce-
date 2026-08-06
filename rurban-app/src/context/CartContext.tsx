import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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

  // Restore cart from storage on mount, then refresh product data (prices + GST)
  // from the API so stale cached items always reflect the current DB values.
  useEffect(() => {
    AsyncStorage.getItem(CART_STORAGE_KEY)
      .then(stored => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as CartItem[];
        if (!Array.isArray(parsed) || parsed.length === 0) return;

        // Show cached data immediately (fast path), normalising gst_rate right away
        // so totalGst is correct even before the background refresh completes.
        setItems(parsed.map(item => ({ ...item, product: withGstRate(item.product) })));

        // Refresh product data in background to pick up current prices + GST rates
        const ids = parsed.map(i => i.product.id).join(',');
        fetch(`${API_BASE}/api/products?ids=${encodeURIComponent(ids)}`)
          .then(r => r.json())
          .then((data: { data?: unknown[] }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fresh = data.data as any[] | undefined;
            if (!fresh || fresh.length === 0) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const freshMap = new Map<string, any>(fresh.map((p: any) => [p.id, p]));
            setItems(prev => prev.map(item => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fp = freshMap.get(item.product.id) as any;
              if (!fp) return item;
              // Merge fresh data; keep cached price if fresh price is 0 (data issue)
              const freshPrice = fp.sale_price ? Number(fp.sale_price) : Number(fp.price);
              const cachedPrice = item.product.sale_price ? Number(item.product.sale_price) : Number(item.product.price);
              return {
                ...item,
                product: {
                  ...item.product,
                  ...fp,
                  // Keep cached price if fresh is 0 (avoid showing free items)
                  price: freshPrice > 0 ? fp.price : item.product.price,
                  sale_price: freshPrice > 0 ? fp.sale_price : item.product.sale_price,
                  // Ensure gst_rate is populated from either field
                  gst_rate: fp.gst_rate ?? fp.intra_state_tax_rate ?? item.product.gst_rate ?? null,
                } as Product,
              };
            }));
          })
          .catch(() => {}); // Silently ignore network errors — cached data still shown
      })
      .catch(() => {});
  }, []);

  // Persist cart to storage whenever it changes
  useEffect(() => {
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)).catch(() => {});
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
    AsyncStorage.removeItem(CART_STORAGE_KEY).catch(() => {});
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
