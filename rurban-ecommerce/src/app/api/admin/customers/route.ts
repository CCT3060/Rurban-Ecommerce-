import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail, buildCustomerLink, generateNextCustomerNumber } from "@/lib/b2b-customer";

export async function GET(request: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const userType = searchParams.get("user_type") ?? "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (admin as any).from("profiles").select("*").eq("role", "user").order("created_at", { ascending: false });
  if (userType) q = q.eq("user_type", userType);
  const { data, error } = await q;
  if (error) {
    console.error("[GET /api/admin/customers] profiles query failed:", error.message, error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids: string[] = ((data ?? []) as any[]).map((row: any) => row.id as string);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders, error: ordersError } = ids.length > 0
    ? await (admin as any).from("orders").select("user_id,total").in("user_id", ids)
    : { data: [] as Array<{ user_id: string; total: unknown }>, error: null };
  if (ordersError) console.error("[GET /api/admin/customers] orders query failed:", (ordersError as { message: string }).message);

  const { data: details, error: detailsError } = ids.length > 0
    ? await admin
      .from("b2b_customer_details")
      .select(
        "user_id, display_name, customer_number, company_name, contact_name, payment_terms, gst_treatment, gstin, billing_attention, billing_address, billing_street2, billing_city, billing_state, billing_country, billing_county, billing_phone, shipping_attention, shipping_address, shipping_street2, shipping_city, shipping_state, shipping_country, shipping_code, shipping_phone, zoho_contact_id"
      )
      .in("user_id", ids)
    : { data: [] as Array<Record<string, unknown>>, error: null };
  if (detailsError) console.error("[GET /api/admin/customers] b2b_customer_details query failed:", detailsError.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userPrices } = ids.length > 0
    ? await (admin as any).from("user_product_prices").select("user_id,status").in("user_id", ids)
    : { data: [] as Array<{ user_id: string; status: string }> };

  const metrics = new Map<string, { orders: number; spent: number }>();
  for (const id of ids) metrics.set(id, { orders: 0, spent: 0 });
  for (const row of ((orders ?? []) as Array<{ user_id: string; total: unknown }>)) {
    const metric = metrics.get(row.user_id);
    if (!metric) continue;
    metric.orders += 1;
    metric.spent += Number(row.total ?? 0);
  }

  const detailsByUser = new Map((details ?? []).map((d) => [d.user_id as string, d]));
  const priceCountByUser = new Map<string, { active: number; inactive: number }>();
  for (const id of ids) priceCountByUser.set(id, { active: 0, inactive: 0 });
  for (const row of ((userPrices ?? []) as Array<{ user_id: string; status: string }>)) {
    const metric = priceCountByUser.get(row.user_id);
    if (!metric) continue;
    if (row.status === "inactive") metric.inactive += 1;
    else metric.active += 1;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged = ((data ?? []) as any[]).map((row: any) => ({
    ...row,
    details: detailsByUser.get(row.id) ?? null,
    orders_count: metrics.get(row.id)?.orders ?? 0,
    spent_total: metrics.get(row.id)?.spent ?? 0,
    active_price_count: priceCountByUser.get(row.id)?.active ?? 0,
    inactive_price_count: priceCountByUser.get(row.id)?.inactive ?? 0,
  }));
  return NextResponse.json({ data: merged });
}

export async function POST(request: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    // Account
    full_name?: string;
    email?: string;
    phone?: string;
    password?: string;
    // Company
    display_name?: string;
    customer_number?: string;
    company_name?: string;
    contact_name?: string;
    payment_terms?: string;
    gst_treatment?: string;
    gstin?: string;
    // Billing
    billing_attention?: string;
    billing_address?: string;
    billing_street2?: string;
    billing_city?: string;
    billing_state?: string;
    billing_country?: string;
    billing_county?: string;
    billing_phone?: string;
    // Shipping
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

  // Update profile: set full_name, phone, and mark as B2B
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin
    .from("profiles")
    .update({ full_name: full_name || null, phone, user_type: "b2b" } as unknown as never) as any)
    .eq("id", userId);

  // Set app_metadata so user_type is available in the JWT without a DB query
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { user_type: "b2b" },
  });

  // Save extended B2B details
  const customerNumber = await generateNextCustomerNumber();
  const details = {
    user_id: userId,
    display_name: body.display_name?.trim() || full_name || null,
    customer_number: customerNumber,
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

  const detailsLink = buildCustomerLink(userId);
  void sendWelcomeEmail(email, full_name, password, detailsLink, body.company_name?.trim() ?? null);

  return NextResponse.json({ data: { id: userId, email, full_name, details_link: detailsLink } }, { status: 201 });
}
