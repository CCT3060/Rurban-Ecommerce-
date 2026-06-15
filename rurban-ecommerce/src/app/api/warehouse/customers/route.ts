import { NextResponse } from "next/server";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── GET /api/warehouse/customers ────────────────────────────────────────────
export async function GET() {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, email, phone")
    .eq("role", "user")
    .eq("user_type", "b2b")
    .eq("warehouse_id", auth.context.warehouseId!)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

// ─── POST /api/warehouse/customers ───────────────────────────────────────────
export async function POST(request: Request) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    full_name?: string;
    email?: string;
    phone?: string;
    password?: string;
    display_name?: string;
    customer_number?: string;
    company_name?: string;
    contact_name?: string;
    payment_terms?: string;
    gst_treatment?: string;
    gstin?: string;
    billing_attention?: string;
    billing_address?: string;
    billing_street2?: string;
    billing_city?: string;
    billing_state?: string;
    billing_country?: string;
    billing_county?: string;
    billing_phone?: string;
    shipping_attention?: string;
    shipping_address?: string;
    shipping_street2?: string;
    shipping_city?: string;
    shipping_state?: string;
    shipping_country?: string;
    shipping_code?: string;
    shipping_phone?: string;
  };

  const full_name = String(body.full_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim() || null;
  const password = String(body.password ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, phone },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const userId = authData.user.id;

  // Tag user with the warehouse and mark as B2B
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin
    .from("profiles")
    .update({
      full_name: full_name || null,
      phone,
      warehouse_id: auth.context.warehouseId,
      user_type: "b2b",
    } as unknown as never) as any)
    .eq("id", userId);

  // Set app_metadata so user_type is available in the JWT without a DB query
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { user_type: "b2b" },
  });

  // Save extended B2B details
  const details = {
    user_id: userId,
    display_name: body.display_name?.trim() || full_name || null,
    customer_number: body.customer_number?.trim() || null,
    company_name: body.company_name?.trim() || null,
    contact_name: body.contact_name?.trim() || null,
    payment_terms: body.payment_terms?.trim() || "Advance Payment",
    gst_treatment: body.gst_treatment?.trim() || "Business - Registered",
    gstin: body.gstin?.trim() || null,
    billing_attention: body.billing_attention?.trim() || null,
    billing_address: body.billing_address?.trim() || null,
    billing_street2: body.billing_street2?.trim() || null,
    billing_city: body.billing_city?.trim() || null,
    billing_state: body.billing_state?.trim() || null,
    billing_country: body.billing_country?.trim() || "India",
    billing_county: body.billing_county?.trim() || null,
    billing_phone: body.billing_phone?.trim() || null,
    shipping_attention: body.shipping_attention?.trim() || null,
    shipping_address: body.shipping_address?.trim() || null,
    shipping_street2: body.shipping_street2?.trim() || null,
    shipping_city: body.shipping_city?.trim() || null,
    shipping_state: body.shipping_state?.trim() || null,
    shipping_country: body.shipping_country?.trim() || "India",
    shipping_code: body.shipping_code?.trim() || null,
    shipping_phone: body.shipping_phone?.trim() || null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("b2b_customer_details").insert(details as unknown as never) as any);

  return NextResponse.json({ data: { id: userId, email, full_name } }, { status: 201 });
}
