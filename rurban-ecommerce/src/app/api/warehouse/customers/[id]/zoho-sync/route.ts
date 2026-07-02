/**
 * POST /api/warehouse/customers/[id]/zoho-sync
 *
 * Warehouse-admin triggered: syncs a B2B customer to Zoho Books
 * and saves the returned contact_id back to b2b_customer_details.
 */
import { NextResponse } from "next/server";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncContactToZoho } from "@/lib/b2b-customer";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  // Fetch profile — must belong to this warehouse
  const { data: profile } = await db
    .from("profiles")
    .select("id, full_name, email, phone, warehouse_id")
    .eq("id", id)
    .eq("user_type", "b2b")
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  if (profile.warehouse_id !== auth.context.warehouseId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Fetch B2B details
  const { data: details } = await db
    .from("b2b_customer_details")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();

  if (!details) {
    return NextResponse.json(
      { error: "Customer has no B2B details yet. Ask them to fill the onboarding form first." },
      { status: 422 }
    );
  }

  // Sync to Zoho Books
  const result = await syncContactToZoho(
    profile.email,
    profile.full_name,
    profile.phone,
    details
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: `Zoho sync failed: ${result.error ?? "unknown error"}` },
      { status: 502 }
    );
  }

  // Save zoho_contact_id back
  if (result.zohoContactId) {
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
