import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

interface CreateCouponBody {
  code?: string;
  description?: string | null;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  min_order_value?: number;
  max_uses?: number | null;
  expiry_date?: string;
  status?: "active" | "inactive";
}

export async function GET() {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as CreateCouponBody;
  const code = body.code?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
  }

  if (!body.expiry_date) {
    return NextResponse.json({ error: "Expiry date is required" }, { status: 400 });
  }

  const payload = {
    code,
    description: body.description?.trim() || null,
    discount_type: body.discount_type ?? "percentage",
    discount_value: Number(body.discount_value ?? 0),
    min_order_value: Number(body.min_order_value ?? 0),
    max_uses: body.max_uses === null || body.max_uses === undefined ? null : Number(body.max_uses),
    expiry_date: body.expiry_date,
    status: body.status ?? "active",
  };

  const admin = createAdminClient();
  const { data, error } = await admin.from("coupons").insert(payload).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
