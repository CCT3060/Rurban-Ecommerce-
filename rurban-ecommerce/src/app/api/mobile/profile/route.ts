import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id,full_name,email,phone,avatar_url,role,user_type,created_at")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Fetch order stats
  const { count: orderCount } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: wishlistCount } = await admin
    .from("wishlist_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Total saved (discount amount across delivered orders)
  const { data: orders } = await admin
    .from("orders")
    .select("discount")
    .eq("user_id", user.id)
    .eq("status", "delivered");

  const totalSaved = (orders ?? []).reduce((sum: number, o: { discount: number }) => sum + Number(o.discount ?? 0), 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileRow = profile as any;

  // For B2B users, also return their shipping details
  let b2bDetails = null;
  if (profileRow.user_type === "b2b") {
    const { data: details } = await admin
      .from("b2b_customer_details")
      .select("shipping_address,shipping_street2,shipping_city,shipping_state,shipping_code,shipping_phone,shipping_attention,payment_terms")
      .eq("user_id", user.id)
      .maybeSingle();
    b2bDetails = details ?? null;
  }

  return NextResponse.json({
    data: {
      ...profileRow,
      order_count: orderCount ?? 0,
      wishlist_count: wishlistCount ?? 0,
      total_saved: Math.round(totalSaved),
      b2b_details: b2bDetails,
    },
  });
}

export async function PUT(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { full_name?: unknown; phone?: unknown; avatar_url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (body.full_name !== undefined) updates.full_name = String(body.full_name).trim();
  if (body.phone !== undefined) updates.phone = String(body.phone).trim();
  if (body.avatar_url !== undefined) updates.avatar_url = String(body.avatar_url).trim();

  const { data: profile, error } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("id,full_name,email,phone,avatar_url,role")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: profile });
}
