import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '../lib/api';

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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Restore cart from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(CART_STORAGE_KEY)
      .then(stored => {
        if (stored) {
          const parsed = JSON.parse(stored) as CartItem[];
          if (Array.isArray(parsed)) setItems(parsed);
        }
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
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev; // already at stock limit
        return prev.map(i =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
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
      const clamped = Math.max(0, Math.min(qty, product.stock));
      if (clamped === 0) return prev.filter(i => i.product.id !== productId);
      const existing = prev.find(i => i.product.id === productId);
      if (existing) return prev.map(i => i.product.id === productId ? { ...i, quantity: clamped } : i);
      return [...prev, { product, quantity: clamped }];
    });
  }, []);

  const getQty = useCallback((productId: string) =>
    items.find(i => i.product.id === productId)?.quantity ?? 0, [items]);

  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => {
    const price = i.product.sale_price ? Number(i.product.sale_price) : Number(i.product.price);
    return sum + price * i.quantity;
  }, 0);
  // GST total — mirrors the backend: line price × qty × gst_rate%.
  // Falls back to intra_state_tax_rate (raw DB column) for products cached
  // before gst_rate was added to the API response.
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
