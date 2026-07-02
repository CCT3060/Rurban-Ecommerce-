"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Heart, ShoppingCart, Star, Minus, Plus, Truck, Shield, RotateCcw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import ProductCard from "@/components/product/product-card";
import { formatPrice, IMAGE_PLACEHOLDER } from "@/lib/constants";
import { normalizeSupabaseImageUrl } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import DOMPurify from "isomorphic-dompurify";
import type { Product } from "@/types";

type ProductResponse = {
  data?: Product;
  related?: Product[];
  error?: string;
};

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [userCustomPrice, setUserCustomPrice] = useState<number | null>(null);

  const addToCart = useCartStore((state) => state.addItem);
  const { toggleItem, isInWishlist } = useWishlistStore();

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const response = await fetch(`/api/products/${slug}`, { cache: "no-store" });
        const json = (await response.json()) as ProductResponse;
        if (!response.ok) throw new Error(json.error || "Failed to load product");
        const loadedProduct = json.data ?? null;
        setProduct(loadedProduct);
        setRelatedProducts(json.related ?? []);

        // Fetch custom price for logged-in user
        if (loadedProduct) {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const priceRes = await fetch(
              `/api/user-prices?productId=${loadedProduct.id}`,
              { cache: "no-store" }
            );
            if (priceRes.ok) {
              const priceJson = (await priceRes.json()) as { data?: Record<string, number> };
              const cp = priceJson.data?.[loadedProduct.id];
              setUserCustomPrice(cp !== undefined ? cp : null);
            }
          }
        }
      } catch {
        setProduct(null);
        setRelatedProducts([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [slug]);

  const quantityVariants = useMemo(() => {
    const variants = product?.variants ?? [];
    const filtered = variants.filter((variant) =>
      ["weight", "size", "pack_size", "volume", "quantity", "unit"].includes(
        (variant.type || "").toLowerCase()
      )
    );
    return filtered.length > 0 ? filtered : variants;
  }, [product?.variants]);

  useEffect(() => {
    if (!product) {
      setSelectedVariantId(null);
      return;
    }

    setSelectedVariantId(quantityVariants[0]?.id ?? null);
  }, [product, quantityVariants]);

  const selectedVariant = quantityVariants.find((variant) => variant.id === selectedVariantId) ?? null;
  const effectiveStock = selectedVariant?.stock ?? product?.stock ?? 0;

  useEffect(() => {
    if (!product) return;

    if (effectiveStock <= 0) {
      setQuantity(1);
      return;
    }

    setQuantity((current) => Math.min(Math.max(1, current), effectiveStock));
  }, [product, effectiveStock]);

  if (loading) {
    return <div className="container mx-auto px-4 py-12 text-muted-foreground">Loading product...</div>;
  }

  if (!product) {
    return <div className="container mx-auto px-4 py-12 text-muted-foreground">Product not found.</div>;
  }

  const inWishlist = isInWishlist(product.id);
  const discount = product.sale_price ? Math.round(((product.price - product.sale_price) / product.price) * 100) : 0;
  const priceModifier = selectedVariant?.price_modifier ?? 0;
  const displayMrp = Math.max(0, product.price + priceModifier);
  const displaySale = product.sale_price !== null ? Math.max(0, product.sale_price + priceModifier) : null;

  // Use custom price if available for this user (overrides default pricing)
  const effectiveDisplayPrice = userCustomPrice !== null ? userCustomPrice : (displaySale ?? displayMrp);
  const hasCustomPrice = userCustomPrice !== null;

  const handleAddToCart = () => {
    addToCart({
      productId: product.id,
      variantId: selectedVariant?.id ?? null,
      quantity,
      name: product.name,
      price: hasCustomPrice ? effectiveDisplayPrice : displayMrp,
      salePrice: hasCustomPrice ? null : displaySale,
      image: normalizeSupabaseImageUrl(product.images?.[0]?.image_url) || IMAGE_PLACEHOLDER,
      stock: effectiveStock,
      variantInfo: selectedVariant?.value,
    });
    toast.success("Added to cart", {
      description: selectedVariant?.value
        ? `${quantity}x ${product.name} (${selectedVariant.value})`
        : `${quantity}x ${product.name}`,
    });
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="h-3 w-3" />
            {product.category && (
              <>
                <Link href={`/category/${product.category.slug}`} className="hover:text-primary">{product.category.name}</Link>
                <ChevronRight className="h-3 w-3" />
              </>
            )}
            <span className="text-foreground font-medium truncate">{product.name}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-8 lg:gap-12 xl:gap-16 items-start">
          <div className="space-y-4">
            <div className="rounded-3xl border border-border/60 bg-gradient-to-b from-white to-muted/20 p-4 md:p-6 shadow-sm transition-all duration-500 hover:shadow-md">
              <div className="relative mx-auto w-full max-w-[360px] md:max-w-[420px] aspect-[4/5] rounded-2xl overflow-hidden bg-white border border-border/40 transition-transform duration-500 hover:scale-[1.02]">
              <Image src={normalizeSupabaseImageUrl(product.images?.[selectedImage]?.image_url) || IMAGE_PLACEHOLDER} alt={product.name} fill className="object-cover" priority sizes="(max-width: 1024px) 100vw, 50vw" />
              {discount > 0 && <Badge className="absolute top-4 left-4 bg-cta text-white border-0 text-sm px-3 py-1">-{discount}% OFF</Badge>}
              </div>
            </div>
            {!!product.images?.length && product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.images.map((image, index) => (
                  <button key={image.id} onClick={() => setSelectedImage(index)} className={`relative w-16 h-16 md:w-18 md:h-18 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${selectedImage === index ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"}`}>
                    <Image src={normalizeSupabaseImageUrl(image.image_url) || IMAGE_PLACEHOLDER} alt="" fill className="object-cover" sizes="80px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5 rounded-3xl border border-border/60 bg-white/70 backdrop-blur p-5 md:p-7 shadow-sm transition-all duration-500 hover:-translate-y-0.5 hover:shadow-md">
            {product.brand && <p className="text-sm font-medium text-primary uppercase tracking-wider">{product.brand}</p>}
            <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">{product.name}</h1>

            <div className="flex items-center gap-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, index) => (
                  <Star key={index} className={`h-4 w-4 ${index < Math.round(product.avg_rating) ? "text-cta fill-cta" : "text-muted-foreground/30"}`} />
                ))}
              </div>
              <span className="text-sm font-medium">{product.avg_rating}</span>
              <span className="text-sm text-muted-foreground">({product.review_count} reviews)</span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-foreground">{formatPrice(effectiveDisplayPrice)}</span>
              {!hasCustomPrice && displaySale !== null && (
                <span className="text-lg text-muted-foreground line-through">{formatPrice(displayMrp)}</span>
              )}
              {hasCustomPrice && (
                <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  Special Price
                </span>
              )}
            </div>

            {product.short_description && <p className="text-muted-foreground leading-relaxed">{product.short_description}</p>}
            <Separator />

            {quantityVariants.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Available Quantity</p>
                <div className="flex flex-wrap gap-2">
                  {quantityVariants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        selectedVariantId === variant.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:border-primary/50"
                      }`}
                    >
                      {variant.value}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold mb-2">Quantity</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center border rounded-lg">
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-r-none" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="h-4 w-4" /></Button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-l-none" onClick={() => setQuantity(Math.min(effectiveStock || 1, quantity + 1))}><Plus className="h-4 w-4" /></Button>
                </div>
                <span className="text-sm text-muted-foreground">{effectiveStock > 0 ? `${effectiveStock} in stock` : "Out of stock"}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <Button onClick={handleAddToCart} size="lg" className="flex-1 gap-2 rounded-full" disabled={effectiveStock <= 0}><ShoppingCart className="h-5 w-5" /> Add to Cart</Button>
              <Button variant="outline" size="lg" className={`rounded-full ${inWishlist ? "text-red-500 border-red-200 hover:bg-red-50" : ""}`} onClick={() => { toggleItem(product.id); toast.success(inWishlist ? "Removed from wishlist" : "Added to wishlist"); }}><Heart className="h-5 w-5" fill={inWishlist ? "currentColor" : "none"} /></Button>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-3">
              {[{ icon: Truck, text: "Free Delivery" }, { icon: Shield, text: "Genuine Product" }, { icon: RotateCcw, text: "7 Day Return" }].map((item) => (
                <div key={item.text} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/50 text-center">
                  <item.icon className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12">
          <Tabs defaultValue="description">
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent px-0">
              <TabsTrigger value="description" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">Description</TabsTrigger>
            </TabsList>
            <TabsContent value="description" className="mt-6">
              <div className="prose max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description || "No description available.") }} />
            </TabsContent>
          </Tabs>
        </div>

        {relatedProducts.length > 0 && (
          <section className="mt-12 md:mt-16">
            <h2 className="text-xl md:text-2xl font-bold mb-6">Related Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
              {relatedProducts.map((item) => <ProductCard key={item.id} product={item} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
