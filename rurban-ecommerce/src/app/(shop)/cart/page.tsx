"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cart-store";
import { formatPrice, IMAGE_PLACEHOLDER } from "@/lib/constants";
import { useState } from "react";
import { toast } from "sonner";

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, getSubtotal, couponCode, couponDiscount, setCoupon, clearCoupon } = useCartStore();
  const [couponInput, setCouponInput] = useState(couponCode ?? "");
  const [couponLoading, setCouponLoading] = useState(false);

  const subtotal = getSubtotal();
  const shipping = subtotal >= 999 ? 0 : 49;
  const discount = couponDiscount;
  const total = subtotal - discount + shipping;

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      toast.error("Please enter a coupon code");
      return;
    }
    setCouponLoading(true);
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(code)}&subtotal=${subtotal}`);
      const json = (await res.json()) as { data?: { code: string; discount_amount: number }; error?: string };
      if (!res.ok || !json.data) {
        clearCoupon();
        toast.error(json.error ?? "Invalid coupon code");
        return;
      }
      setCoupon(json.data.code, json.data.discount_amount);
      toast.success(`Coupon applied! ${formatPrice(json.data.discount_amount)} discount added.`);
    } catch {
      toast.error("Failed to validate coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    clearCoupon();
    setCouponInput("");
    toast.info("Coupon removed");
  };

  if (items.length === 0) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-20 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-6">Looks like you haven&apos;t added anything yet.</p>
          <Link href="/">
            <Button className="rounded-full px-8 gap-2">
              Continue Shopping <ArrowRight className="h-4 w-4" />
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
            <span className="text-foreground font-medium">Cart ({items.length})</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-10">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <Card key={`${item.productId}-${item.variantId}`} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted/30 shrink-0">
                      <Image
                        src={item.image || IMAGE_PLACEHOLDER}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm sm:text-base line-clamp-2">{item.name}</h3>
                          {item.variantInfo && (
                            <p className="text-xs text-muted-foreground mt-0.5">Variant: {item.variantInfo}</p>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => removeItem(item.productId, item.variantId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center border rounded-lg">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-r-none" onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none" onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatPrice((item.salePrice ?? item.price) * item.quantity)}</p>
                          {item.salePrice && (
                            <p className="text-xs text-muted-foreground line-through">{formatPrice(item.price * item.quantity)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="ghost" className="text-destructive" onClick={clearCart}>Clear Cart</Button>
          </div>

          {/* Order summary */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Coupon */}
                {couponCode ? (
                  <div className="flex items-center justify-between bg-success/10 rounded-lg px-3 py-2">
                    <p className="text-xs text-success font-medium flex items-center gap-1">
                      <Tag className="h-3 w-3" /> {couponCode} applied — {formatPrice(couponDiscount)} off
                    </p>
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-destructive px-2" onClick={handleRemoveCoupon}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Coupon code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      className="text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApplyCoupon(); } }}
                    />
                    <Button variant="outline" size="sm" onClick={handleApplyCoupon} disabled={couponLoading}>
                      <Tag className="h-4 w-4 mr-1" /> {couponLoading ? "..." : "Apply"}
                    </Button>
                  </div>
                )}

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatPrice(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Coupon Discount</span>
                      <span>-{formatPrice(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className={shipping === 0 ? "text-success font-medium" : "font-medium"}>
                      {shipping === 0 ? "Free" : formatPrice(shipping)}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold text-primary">{formatPrice(total)}</span>
                </div>

                {shipping > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Add {formatPrice(999 - subtotal)} more for free shipping
                  </p>
                )}

                <Link href="/checkout" className="block">
                  <Button className="w-full rounded-full gap-2" size="lg">
                    Proceed to Checkout <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>

                <Link href="/" className="block">
                  <Button variant="outline" className="w-full rounded-full" size="sm">
                    Continue Shopping
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
