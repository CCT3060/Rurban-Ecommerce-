/**
 * GET /api/coupons/validate?code=RURBAN10&subtotal=1000
 *
 * Public endpoint — authenticated users can validate a coupon code.
 * Returns the discount amount if the coupon is valid, or an error otherwise.
 */
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();
  const subtotal = Number(searchParams.get("subtotal") ?? "0");

  if (!code) {
    return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
  }
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return NextResponse.json({ error: "Invalid subtotal" }, { status: 400 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: coupon, error } = await (admin as any)
    .from("coupons")
    .select("id, code, discount_type, discount_value, min_order_value, max_uses, used_count, expiry_date, status")
    .eq("code", code)
    .eq("status", "active")
    .maybeSingle() as { data: { id: string; code: string; discount_type: string; discount_value: number; min_order_value: number | null; max_uses: number | null; used_count: number; expiry_date: string | null; status: string } | null; error: unknown };

  if (error) {
    return NextResponse.json({ error: "Failed to validate coupon" }, { status: 500 });
  }

  if (!coupon) {
    return NextResponse.json({ error: "Invalid or inactive coupon code" }, { status: 400 });
  }

  // Check expiry
  if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
    return NextResponse.json({ error: "Coupon has expired" }, { status: 400 });
  }

  // Check usage limit
  if (coupon.max_uses !== null && Number(coupon.used_count) >= Number(coupon.max_uses)) {
    return NextResponse.json({ error: "Coupon usage limit has been reached" }, { status: 400 });
  }

  // Check minimum order value
  if (coupon.min_order_value && subtotal < Number(coupon.min_order_value)) {
    return NextResponse.json(
      {
        error: `Minimum order value of ₹${Number(coupon.min_order_value).toFixed(0)} required for this coupon`,
      },
      { status: 400 }
    );
  }

  // Calculate discount
  const discountAmount =
    coupon.discount_type === "percentage"
      ? Number((subtotal * (Number(coupon.discount_value) / 100)).toFixed(2))
      : Math.min(Number(coupon.discount_value), subtotal);

  return NextResponse.json({
    data: {
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_amount: discountAmount,
    },
  });
}
