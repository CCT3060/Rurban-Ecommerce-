import { NextResponse } from "next/server";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

async function getOwnedProfile(id: string, warehouseId: string) {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, warehouse_id, role, user_type")
    .eq("id", id)
    .maybeSingle() as unknown as {
    data: { id: string; warehouse_id: string | null; role: string; user_type: string | null } | null;
    error: { message: string } | null;
  };

  if (error) return { ok: false as const, status: 400, message: error.message, admin };
  if (!profile) return { ok: false as const, status: 404, message: "User not found", admin };
  if (profile.warehouse_id !== warehouseId || profile.role !== "user" || profile.user_type !== "b2b") {
    return { ok: false as const, status: 403, message: "User does not belong to your warehouse", admin };
  }

  return { ok: true as const, admin };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const owned = await getOwnedProfile(id, auth.context.warehouseId!);
  if (!owned.ok) return NextResponse.json({ error: owned.message }, { status: owned.status });

  const { admin } = owned;
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, email, phone, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: details } = await admin
    .from("b2b_customer_details")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();

  return NextResponse.json({ data: { ...profile, details: details ?? null } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const owned = await getOwnedProfile(id, auth.context.warehouseId!);
  if (!owned.ok) return NextResponse.json({ error: owned.message }, { status: owned.status });

  const body = (await request.json()) as {
    is_active?: boolean;
    full_name?: string | null;
    phone?: string | null;
    display_name?: string | null;
    customer_number?: string | null;
    company_name?: string | null;
    contact_name?: string | null;
    payment_terms?: string | null;
    gst_treatment?: string | null;
    gstin?: string | null;
    billing_attention?: string | null;
    billing_address?: string | null;
    billing_street2?: string | null;
    billing_city?: string | null;
    billing_state?: string | null;
    billing_country?: string | null;
    billing_county?: string | null;
    billing_phone?: string | null;
    shipping_attention?: string | null;
    shipping_address?: string | null;
    shipping_street2?: string | null;
    shipping_city?: string | null;
    shipping_state?: string | null;
    shipping_country?: string | null;
    shipping_code?: string | null;
    shipping_phone?: string | null;
  };

  const { admin } = owned;

  const profilePayload: Record<string, unknown> = {};
  if (body.is_active !== undefined) profilePayload.is_active = Boolean(body.is_active);
  if (body.full_name !== undefined) profilePayload.full_name = body.full_name;
  if (body.phone !== undefined) profilePayload.phone = body.phone;

  if (Object.keys(profilePayload).length > 0) {
    const { error: profileError } = await admin
      .from("profiles")
      .update(profilePayload)
      .eq("id", id);
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const detailsPayload: Record<string, unknown> = { user_id: id };
  const detailKeys = [
    "display_name", "customer_number", "company_name", "contact_name", "payment_terms", "gst_treatment", "gstin",
    "billing_attention", "billing_address", "billing_street2", "billing_city", "billing_state", "billing_country", "billing_county", "billing_phone",
    "shipping_attention", "shipping_address", "shipping_street2", "shipping_city", "shipping_state", "shipping_country", "shipping_code", "shipping_phone",
  ] as const;

  let hasDetailsUpdate = false;
  for (const key of detailKeys) {
    if (body[key] !== undefined) {
      hasDetailsUpdate = true;
      detailsPayload[key] = body[key];
    }
  }

  if (hasDetailsUpdate) {
    const { error: detailsError } = await admin
      .from("b2b_customer_details")
      .upsert(detailsPayload, { onConflict: "user_id" });
    if (detailsError) return NextResponse.json({ error: detailsError.message }, { status: 400 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email, phone, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  const { data: details } = await admin
    .from("b2b_customer_details")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();

  return NextResponse.json({ data: { ...profile, details: details ?? null } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const owned = await getOwnedProfile(id, auth.context.warehouseId!);
  if (!owned.ok) return NextResponse.json({ error: owned.message }, { status: owned.status });

  const { admin } = owned;
  // deleteUser removes from auth.users which cascades to profiles and user_product_prices
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
