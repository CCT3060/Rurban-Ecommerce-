import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCustomerToken } from "@/lib/b2b-customer";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  // Verify HMAC signature — rejects unsigned plain-base64 tokens (prevents UUID enumeration)
  const userId = verifyCustomerToken(token);

  if (!userId) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  type ProfileRow = { id: string; full_name: string | null; email: string; phone: string | null; is_active: boolean; created_at: string; user_type: string };
  const { data: profile, error } = await db.from("profiles").select("id, full_name, email, phone, is_active, created_at, user_type").eq("id", userId).eq("user_type", "b2b").maybeSingle() as { data: ProfileRow | null; error: unknown };

  if (error || !profile) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const { data: details } = await db.from("b2b_customer_details")
    .select(
      "display_name, customer_number, company_name, contact_name, payment_terms, gst_treatment, gstin, billing_attention, billing_address, billing_street2, billing_city, billing_state, billing_country, billing_county, billing_phone, shipping_attention, shipping_address, shipping_street2, shipping_city, shipping_state, shipping_country, shipping_code, shipping_phone"
    )
    .eq("user_id", userId)
    .maybeSingle() as { data: Record<string, string | null> | null; error: unknown };

  return NextResponse.json({
    data: {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      is_active: profile.is_active,
      created_at: profile.created_at,
      details: details ?? null,
    },
  });
}

// PUT /api/b2b-customer/[token]  — customer self-fills their B2B details
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  // Verify HMAC signature before reading any customer data
  const userId = verifyCustomerToken(token);

  if (!userId) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileError } = await (db.from("profiles").select("id, user_type").eq("id", userId).eq("user_type", "b2b").maybeSingle() as unknown as Promise<{ data: { id: string } | null; error: unknown }>);

  if (profileError || !profile) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);

  const details = {
    user_id: userId,
    display_name:       str(body.display_name),
    customer_number:    str(body.customer_number),
    company_name:       str(body.company_name),
    contact_name:       str(body.contact_name),
    payment_terms:      str(body.payment_terms),
    gst_treatment:      str(body.gst_treatment),
    gstin:              str(body.gstin),
    billing_attention:  str(body.billing_attention),
    billing_address:    str(body.billing_address),
    billing_street2:    str(body.billing_street2),
    billing_city:       str(body.billing_city),
    billing_state:      str(body.billing_state),
    billing_country:    str(body.billing_country) ?? "India",
    billing_county:     str(body.billing_county),
    billing_phone:      str(body.billing_phone),
    shipping_attention: str(body.shipping_attention),
    shipping_address:   str(body.shipping_address),
    shipping_street2:   str(body.shipping_street2),
    shipping_city:      str(body.shipping_city),
    shipping_state:     str(body.shipping_state),
    shipping_country:   str(body.shipping_country) ?? "India",
    shipping_code:      str(body.shipping_code),
    shipping_phone:     str(body.shipping_phone),
  };

  // Also update the profile name/phone if customer provided them
  const profileUpdates: Record<string, string | null> = {};
  if (str(body.full_name)) profileUpdates.full_name = str(body.full_name);
  if (str(body.phone)) profileUpdates.phone = str(body.phone);
  if (Object.keys(profileUpdates).length > 0) {
    await db.from("profiles").update(profileUpdates).eq("id", userId);
  }

  // Upsert details
  const { error: upsertError } = await db.from("b2b_customer_details").upsert(details, { onConflict: "user_id" }) as { error: unknown };

  if (upsertError) {
    console.error("[b2b-customer PUT]", upsertError);
    return NextResponse.json({ error: "Failed to save details" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
