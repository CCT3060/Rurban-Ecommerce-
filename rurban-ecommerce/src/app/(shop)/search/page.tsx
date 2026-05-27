"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import ProductCard from "@/components/product/product-card";
import type { Product } from "@/types";

const allProducts: Product[] = [
  { id: "p1", name: "Wireless Noise-Cancelling Headphones", slug: "wireless-nc-headphones", description: null, short_description: null, price: 4999, sale_price: 3499, sku: "WH-001", stock: 25, brand: "AudioTech", tags: [], category_id: "1", status: "active", is_featured: true, is_trending: true, is_new_arrival: false, avg_rating: 4.5, review_count: 128, created_at: "", updated_at: "", category: { id: "1", name: "Electronics", slug: "electronics", image_url: null, banner_url: null, description: null, parent_id: null, status: "active", sort_order: 1, created_at: "", updated_at: "" }, images: [{ id: "i1", product_id: "p1", image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop", alt_text: null, sort_order: 1, is_primary: true, created_at: "" }] },
  { id: "p2", name: "Premium Cotton T-Shirt", slug: "premium-cotton-tshirt", description: null, short_description: null, price: 1299, sale_price: 799, sku: "TS-002", stock: 50, brand: "UrbanWear", tags: [], category_id: "2", status: "active", is_featured: true, is_trending: false, is_new_arrival: true, avg_rating: 4.2, review_count: 85, created_at: "", updated_at: "", category: { id: "2", name: "Fashion", slug: "fashion", image_url: null, banner_url: null, description: null, parent_id: null, status: "active", sort_order: 2, created_at: "", updated_at: "" }, images: [{ id: "i2", product_id: "p2", image_url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop", alt_text: null, sort_order: 1, is_primary: true, created_at: "" }] },
  { id: "p3", name: "Smart Watch Pro", slug: "smart-watch-pro", description: null, short_description: null, price: 8999, sale_price: 6999, sku: "SW-003", stock: 15, brand: "TechFit", tags: [], category_id: "1", status: "active", is_featured: true, is_trending: true, is_new_arrival: true, avg_rating: 4.7, review_count: 256, created_at: "", updated_at: "", category: { id: "1", name: "Electronics", slug: "electronics", image_url: null, banner_url: null, description: null, parent_id: null, status: "active", sort_order: 1, created_at: "", updated_at: "" }, images: [{ id: "i3", product_id: "p3", image_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop", alt_text: null, sort_order: 1, is_primary: true, created_at: "" }] },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const results = query.trim()
    ? allProducts.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.brand?.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-6 md:py-10">
          <h1 className="text-2xl md:text-3xl font-bold mb-4">Search Products</h1>
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products, brands, categories..."
              className="pl-10 pr-10 h-12 text-base"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-10">
        {query.trim() ? (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              {results.length} results for &ldquo;{query}&rdquo;
            </p>
            {results.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                {results.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            ) : (
              <div className="text-center py-16">
                <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium">No products found</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different search term</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium">Start typing to search</p>
            <p className="text-sm text-muted-foreground mt-1">Find products, brands, and more</p>
          </div>
        )}
      </div>
    </div>
  );
}
