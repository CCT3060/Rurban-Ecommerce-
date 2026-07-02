/**
 * POST /api/admin/customers/[id]/zoho-sync
 *
 * Admin-triggered: syncs a B2B customer to Zoho Books, then saves the
 * Zoho-generated contact_id (and customer_code) back to b2b_customer_details.
 */
import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncContactToZoho } from "@/lib/b2b-customer";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdminContext();
  if (!ctx.ok) {
    return ctx.response;
  }

  const { id } = await params;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  // Fetch profile
  type ProfileRow = { id: string; full_name: string | null; email: string; phone: string | null };
  const { data: profile } = await db
    .from("profiles")
    .select("id, full_name, email, phone")
    .eq("id", id)
    .eq("user_type", "b2b")
    .maybeSingle() as { data: ProfileRow | null };

  if (!profile) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // Fetch B2B details
  type DetailsRow = {
    display_name: string | null; company_name: string | null; contact_name: string | null;
    customer_number: string | null; payment_terms: string | null; gst_treatment: string | null;
    gstin: string | null; billing_attention: string | null; billing_address: string | null;
    billing_street2: string | null; billing_city: string | null; billing_state: string | null;
    billing_country: string | null; billing_county: string | null; billing_phone: string | null;
    shipping_attention: string | null; shipping_address: string | null; shipping_street2: string | null;
    shipping_city: string | null; shipping_state: string | null; shipping_country: string | null;
    shipping_code: string | null; shipping_phone: string | null;
  };
  const { data: details } = await db
    .from("b2b_customer_details")
    .select("*")
    .eq("user_id", id)
    .maybeSingle() as { data: DetailsRow | null };

  if (!details) {
    return NextResponse.json({ error: "Customer has no B2B details yet. Ask them to fill the onboarding form first." }, { status: 422 });
  }

  // Sync to Zoho Books
  const result = await syncContactToZoho(
    profile.email,
    profile.full_name,
    profile.phone,
    details
  );

  if (!result.ok) {
    return NextResponse.json({ error: `Zoho sync failed: ${result.error ?? "unknown error"}` }, { status: 502 });
  }

  // Save zoho_contact_id back to b2b_customer_details
  if (result.zohoContactId) {
    console.log("[zoho-sync] Storing customer_id from Zoho:", result.zohoContactId);
    await db
      .from("b2b_customer_details")
      .update({ zoho_contact_id: result.zohoContactId })
      .eq("user_id", id);
  }

  return NextResponse.json({
    success: true,
    zohoContactId: result.zohoContactId ?? null,
  });
}
