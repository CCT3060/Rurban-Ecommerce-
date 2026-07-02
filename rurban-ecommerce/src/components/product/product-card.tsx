"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Minus, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/types";
import { normalizeSupabaseImageUrl } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { formatCurrency } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

export default function ProductCard({
  product,
  compact = false,
}: ProductCardProps) {
  const { toggleItem, isInWishlist } = useWishlistStore();
  const { items, addItem, updateQuantity, removeItem } = useCartStore();

  const isFavorited = isInWishlist(product.id);
  const cartItem = items.find(
    (item) => item.productId === product.id && item.variantId === null,
  );
  const cartQuantity = cartItem?.quantity ?? 0;

  // Find primary image or fallback
  const primaryImage =
    product.images?.find((img) => img.is_primary)?.image_url ||
    product.images?.[0]?.image_url ||
    "/images/placeholder.svg";
  const safeImageUrl = normalizeSupabaseImageUrl(primaryImage);

  const isOutOfStock = product.stock <= 0;
  const discountPercentage = product.sale_price
    ? Math.round(((product.price - product.sale_price) / product.price) * 100)
    : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) return;

    addItem({
      productId: product.id,
      variantId: null,
      quantity: 1,
      name: product.name,
      price: product.price,
      salePrice: product.sale_price,
      image: primaryImage,
      stock: product.stock,
    });
  };

  const handleIncreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) return;

    if (!cartItem) {
      handleAddToCart(e);
      return;
    }

    updateQuantity(product.id, null, cartQuantity + 1);
  };

  const handleDecreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!cartItem) return;

    if (cartQuantity <= 1) {
      removeItem(product.id, null);
      return;
    }

    updateQuantity(product.id, null, cartQuantity - 1);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem(product.id);
  };

  const canIncreaseQuantity = cartQuantity < product.stock;

  return (
    <div
      className={`group relative flex h-full flex-col bg-card overflow-hidden rounded-xl border border-border/60 transition-all duration-200 hover:shadow-sm hover:border-primary/40 ${
        compact ? "p-2" : "p-3"
      }`}
    >

      {/* Badges */}
      <div className="absolute top-0 left-0 z-10 flex flex-col">
        {discountPercentage > 0 && (
          <Badge className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-tl-xl rounded-tr-none rounded-bl-none rounded-br-lg border-0 px-1.5 py-0.5 text-[10px] shadow-none tracking-wide">
            {discountPercentage}% OFF
          </Badge>
        )}
      </div>

      {/* Wishlist Button */}
      <button
        onClick={handleToggleWishlist}
        className="absolute top-2 right-2 z-10 rounded-full border border-border/50 bg-white/80 backdrop-blur-sm p-1.5 text-muted-foreground shadow-sm transition-colors hover:bg-muted"
        aria-label={isFavorited ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart
          size={14}
          className={`${isFavorited ? "fill-red-500 text-red-500" : ""} transition-all`}
        />
      </button>

      {/* Image Area */}
      <Link
        href={`/product/${product.slug}`}
        className={`relative mb-3 block aspect-square overflow-hidden rounded-lg`}
      >
        <Image
          src={safeImageUrl}
          alt={product.name}
          fill
          className={`object-contain transition-transform duration-300 group-hover:scale-105 p-2`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center font-bold text-slate-800 tracking-wider z-10 text-[10px] uppercase backdrop-blur-[1px]">
            Out of Stock
          </div>
        )}
      </Link>

      {/* Content Area */}
      <div className="flex flex-col flex-1 text-left">
        {/* Title */}
        <Link href={`/product/${product.slug}`} className="block mb-2">
          <h3
            className={`line-clamp-2 font-semibold text-foreground transition-colors hover:text-primary ${
              compact ? "text-[13px]" : "text-sm"
            } leading-snug`}
            title={product.name}
          >
            {product.name}
          </h3>
        </Link>
        <div className="flex-1" />

        {/* Rating */}
        <div className="flex items-center gap-1 mb-2">
          <div className="flex items-center rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
            <span className="mr-0.5">{product.avg_rating > 0 ? product.avg_rating.toFixed(1) : "0"}</span>
            <Star size={8} className="fill-current" />
          </div>
          {product.review_count > 0 && (
            <span className="text-[10px] text-muted-foreground">
              ({product.review_count})
            </span>
          )}
        </div>

        {/* Price & Action */}
        <div className="mt-auto flex flex-col justify-end gap-3">
          <div className="flex flex-col">
            {product.sale_price ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[14px] font-semibold text-foreground">
                  {formatCurrency(product.sale_price)}
                </span>
                <span className="text-[11px] text-muted-foreground line-through">
                  {formatCurrency(product.price)}
                </span>
              </div>
            ) : (
              <span className="text-[14px] font-semibold text-foreground">
                {formatCurrency(product.price)}
              </span>
            )}
          </div>

          {isOutOfStock ? (
            <Button
              disabled
              variant="outline"
              className="h-8 w-full rounded-lg text-[11px] font-semibold bg-muted/50 text-muted-foreground border-border/50"
            >
              SOLD OUT
            </Button>
          ) : cartQuantity > 0 ? (
            <div
              className={`flex w-full items-center overflow-hidden rounded-lg border border-primary/20 bg-primary/5 ${
                compact ? "h-7" : "h-8"
              }`}
            >
              <button
                type="button"
                onClick={handleDecreaseQuantity}
                className="flex h-full w-9 items-center justify-center text-primary transition-colors hover:bg-primary/10"
                aria-label="Decrease quantity"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="flex flex-1 items-center justify-center text-[13px] font-semibold text-primary">
                {cartQuantity}
              </span>
              <button
                type="button"
                onClick={handleIncreaseQuantity}
                disabled={!canIncreaseQuantity}
                className="flex h-full w-9 items-center justify-center text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                aria-label="Increase quantity"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <Button
              onClick={handleAddToCart}
              variant="outline"
              className={`w-full font-semibold text-[11px] tracking-wide rounded-lg transition-colors ${
                compact ? "h-7" : "h-8"
              } border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground`}
            >
              ADD
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
