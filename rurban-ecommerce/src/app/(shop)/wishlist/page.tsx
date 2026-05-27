"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWishlistStore } from "@/stores/wishlist-store";
import ProductCard from "@/components/product/product-card";
import type { Product } from "@/types";

export default function WishlistPage() {
  const { items } = useWishlistStore();
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);

  useEffect(() => {
    const load = async () => {
      if (items.length === 0) {
        setWishlistProducts([]);
        return;
      }

      const query = encodeURIComponent(items.join(","));
      const response = await fetch(`/api/products?ids=${query}`, { cache: "no-store" });
      const json = (await response.json()) as { data?: Product[] };
      setWishlistProducts(json.data ?? []);
    };

    void load();
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-20 text-center">
          <Heart className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Your wishlist is empty</h1>
          <p className="text-muted-foreground mb-6">Save items you love to buy later.</p>
          <Link href="/">
            <Button className="rounded-full px-8 gap-2">
              Explore Products <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">Home</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Wishlist ({items.length})</span>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-6 md:py-10">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">My Wishlist</h1>
        {wishlistProducts.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">Wishlist items not found in catalog.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
            {wishlistProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </div>
    </div>
  );
}
