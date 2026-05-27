"use client";

import { useEffect, useState } from "react";
import SectionHeader from "@/components/shared/section-header";
import ProductCard from "@/components/product/product-card";
import { useWishlistStore } from "@/stores/wishlist-store";
import type { Product } from "@/types";

export default function WishlistProductsRail() {
  const { items } = useWishlistStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (items.length === 0) {
        setProducts([]);
        return;
      }

      setLoading(true);
      try {
        const query = encodeURIComponent(items.join(","));
        const response = await fetch(`/api/products?ids=${query}`, { cache: "no-store" });
        const json = (await response.json()) as { data?: Product[] };
        setProducts(json.data ?? []);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [items]);

  if (items.length === 0 && !loading) return null;

  return (
    <section className="border-t border-border/25 bg-white py-7 md:py-9">
      <div className="container mx-auto px-3 md:px-4 lg:px-6">
        <SectionHeader
          title="Wishlist Products"
          subtitle="Products wished by you"
          href="/wishlist"
          linkText="View Wishlist"
        />

        {loading ? (
          <div className="mt-4 rounded-2xl border border-border/50 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
            Loading your wishlist products...
          </div>
        ) : products.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-border/50 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
            No wishlist products available yet.
          </div>
        ) : (
          <div className="mt-5 flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory hide-scrollbar md:gap-4">
            {products.map((product) => (
              <div
                key={`wishlist-${product.id}`}
                className="min-w-[160px] max-w-[220px] shrink-0 snap-start sm:min-w-[190px]"
              >
                <ProductCard product={product} compact />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

