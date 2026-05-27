import React, { createContext, useContext, useState, useCallback } from 'react';
import { Product } from '../lib/api';

interface WishlistContextValue {
  items: Product[];
  ids: Set<string>;
  toggle: (product: Product) => void;
  isWishlisted: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Product[]>([]);
  const [ids, setIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((product: Product) => {
    setIds(prev => {
      const next = new Set(prev);
      if (next.has(product.id)) {
        next.delete(product.id);
        setItems(pi => pi.filter(p => p.id !== product.id));
      } else {
        next.add(product.id);
        setItems(pi => [...pi, product]);
      }
      return next;
    });
  }, []);

  const isWishlisted = useCallback((productId: string) => ids.has(productId), [ids]);

  return (
    <WishlistContext.Provider value={{ items, ids, toggle, isWishlisted }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
