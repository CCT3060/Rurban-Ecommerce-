import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = (user.app_metadata?.role as string | undefined) ?? (user.user_metadata?.role as string | undefined);
  if (role !== "admin") return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true as const };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, email, phone, is_active, created_at")
    .eq("id", id)
    .eq("role", "user")
    .maybeSingle() as unknown as {
    data: { id: string; full_name: string | null; email: string; phone: string | null; is_active: boolean; created_at: string } | null;
    error: { message: string } | null;
  };

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  if (!profile) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const { data: details } = await admin
    .from("b2b_customer_details")
    .select("*")
    .eq("user_id", id)
    .maybeSingle() as unknown as { data: Record<string, unknown> | null };

  return NextResponse.json({ data: { ...profile, details: details ?? null } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
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

  const admin = createAdminClient();

  const profilePayload: Record<string, unknown> = {};
  if (body.is_active !== undefined) profilePayload.is_active = Boolean(body.is_active);
  if (body.full_name !== undefined) profilePayload.full_name = body.full_name;
  if (body.phone !== undefined) profilePayload.phone = body.phone;

  let profile: Record<string, unknown> | null = null;
  if (Object.keys(profilePayload).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin
      .from("profiles")
      .update(profilePayload as unknown as never) as any)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 400 });
    profile = data as Record<string, unknown>;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: detailsError } = await (admin
      .from("b2b_customer_details")
      .upsert(detailsPayload as unknown as never, { onConflict: "user_id" }) as any);

    if (detailsError) return NextResponse.json({ error: (detailsError as { message: string }).message }, { status: 400 });
  }

  if (!profile) {
    const { data } = await admin
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle() as unknown as { data: Record<string, unknown> | null };
    profile = (data ?? null) as Record<string, unknown> | null;
  }

  const { data: details } = await admin
    .from("b2b_customer_details")
    .select("*")
    .eq("user_id", id)
    .maybeSingle() as unknown as { data: Record<string, unknown> | null };

  return NextResponse.json({ data: { ...(profile ?? {}), details: details ?? null } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  // deleteUser removes from auth.users which cascades to profiles and user_product_prices
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
