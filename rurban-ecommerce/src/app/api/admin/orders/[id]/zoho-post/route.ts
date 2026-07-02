/**
 * POST /api/admin/orders/[id]/zoho-post
 *
 * Creates a Zoho Books Sales Order from a Rurban order.
 * The customer must already be synced to Zoho (have a zoho_contact_id).
 */
import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { zohoPost, getAccessToken, ZOHO_API_BASE } from "@/lib/zoho/client";
import { generateOrderSummaryPdf } from "@/lib/order-pdf";

interface ZohoSalesOrderResponse {
  code: number;
  message: string;
  salesorder?: {
    salesorder_id: string;
    salesorder_number: string;
  };
}

/** Parse "Requested delivery date: 31 Jul 2026" → "2026-07-31" */
function parseDeliveryDate(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/Requested delivery date:\s*(.+)/i);
  if (!match) return null;
  const raw = match[1].trim();
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

/** Format JS Date → "YYYY-MM-DD" */
function toYMD(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Allow both admin and warehouse_admin roles
  const auth = await getRequestContext();
  if (!auth.ok) return auth.response;
  if (auth.context.role !== "admin" && auth.context.role !== "warehouse_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  console.log("[zoho-post] Called for order id:", id);
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  // ── 1. Fetch order ────────────────────────────────────────────────────────
  const { data: order, error: orderErr } = await db
    .from("orders")
    .select("*, user:profiles(id, full_name, email, phone), order_items(*)")
    .eq("id", id)
    .single();

  if (orderErr || !order) {
    console.log("[zoho-post] Order not found:", orderErr?.message);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  console.log("[zoho-post] Order found:", order.order_number, "zoho_salesorder_id:", order.zoho_salesorder_id);

  if (order.zoho_salesorder_id) {
    console.log("[zoho-post] Already posted, returning 409");
    return NextResponse.json(
      { error: `Already posted to Zoho (${order.zoho_salesorder_number ?? order.zoho_salesorder_id})` },
      { status: 409 }
    );
  }

  // ── 2. Fetch B2B customer details (for zoho_contact_id + payment_terms) ──
  const userId = order.user_id;
  const { data: b2b } = await db
    .from("b2b_customer_details")
    .select("zoho_contact_id, payment_terms")
    .eq("user_id", userId)
    .maybeSingle();

  if (!b2b?.zoho_contact_id) {
    return NextResponse.json(
      { error: "Customer has not been synced to Zoho Books yet. Please sync the customer first from the B2B Users page." },
      { status: 422 }
    );
  }

  // ── 3. Fetch zoho_item_id for each product ────────────────────────────────
  const productIds: string[] = (order.order_items as any[])
    .map((i: any) => i.product_id)
    .filter(Boolean);

  const { data: productRows } = await db
    .from("products")
    .select("id, zoho_item_id, zoho_unit")
    .in("id", productIds);

  const productMap = new Map<string, { zoho_item_id: string | null; zoho_unit: string | null }>(
    ((productRows ?? []) as any[]).map((p: any) => [p.id, { zoho_item_id: p.zoho_item_id, zoho_unit: p.zoho_unit }])
  );

  // ── 4. Build line items ───────────────────────────────────────────────────
  const lineItems = (order.order_items as any[]).map((item: any) => {
    const prod = item.product_id ? productMap.get(item.product_id) : null;
    const entry: Record<string, unknown> = {
      name: item.name,
      quantity: item.quantity,
      rate: Number(item.price),
    };
    if (prod?.zoho_item_id) entry.item_id = prod.zoho_item_id;
    if (item.zoho_unit || prod?.zoho_unit) entry.unit = item.zoho_unit ?? prod?.zoho_unit;
    // Tax rate — Zoho India uses line-level tax_id; we pass the tax_name instead
    // and let Zoho match it. Skip if 0.
    if (item.intra_state_tax_rate && Number(item.intra_state_tax_rate) > 0) {
      // Use tax_name string so Zoho Books auto-resolves the tax; this works when
      // the item already has the tax configured in Zoho.
      entry.tax_name = `GST${Number(item.intra_state_tax_rate)}`;
    }
    return entry;
  });

  // ── 5. Build Sales Order payload ──────────────────────────────────────────
  const orderDate = toYMD(new Date(order.created_at));
  const deliveryDate = parseDeliveryDate(order.notes);

  const payload: Record<string, unknown> = {
    customer_id: b2b.zoho_contact_id,
    reference_number: order.order_number,   // stored as a reference, not the SO number
    date: orderDate,
    line_items: lineItems,
  };

  if (deliveryDate) payload.delivery_date = deliveryDate;
  if (b2b.payment_terms?.trim()) payload.payment_terms_label = b2b.payment_terms.trim();
  if (order.notes) payload.notes = order.notes;

  // ── 6. Post to Zoho Books ─────────────────────────────────────────────────
  let zohoResult: ZohoSalesOrderResponse;
  try {
    zohoResult = await zohoPost<ZohoSalesOrderResponse>("/salesorders", payload);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Zoho API error" },
      { status: 502 }
    );
  }

  if (zohoResult.code !== 0 || !zohoResult.salesorder) {
    return NextResponse.json(
      { error: `Zoho returned error ${zohoResult.code}: ${zohoResult.message}` },
      { status: 502 }
    );
  }

  // ── 7. Save Zoho IDs back to the order ───────────────────────────────────
  await db
    .from("orders")
    .update({
      zoho_salesorder_id: zohoResult.salesorder.salesorder_id,
      zoho_salesorder_number: zohoResult.salesorder.salesorder_number,
    })
    .eq("id", id);

  // ── 8. Generate PDF and attach to the Zoho SO ────────────────────────────
  let pdfResult: { ok: boolean; status?: number; body?: unknown; error?: string } = { ok: false };
  try {
    console.log("[zoho-post] Starting PDF generation for order:", order.order_number);
    const addr = order.shipping_address ?? {};
    const pdfBuffer = await generateOrderSummaryPdf({
      order_number: order.order_number,
      created_at: order.created_at,
      notes: order.notes,
      shipping_address: addr,
      b2b_payment_terms: order.b2b_payment_terms ?? b2b.payment_terms,
      payment_method: order.payment_method,
      subtotal: Number(order.subtotal),
      shipping_cost: Number(order.shipping_cost ?? 0),
      discount: Number(order.discount ?? 0),
      customer_name: order.user?.full_name,
      customer_email: order.user?.email,
      customer_phone: order.user?.phone,
      order_items: (order.order_items as any[]).map((i: any) => ({
        name: i.name,
        hsn_or_sac: i.hsn_or_sac,
        quantity: i.quantity,
        price: Number(i.price),
        intra_state_tax_rate: i.intra_state_tax_rate,
        zoho_unit: i.zoho_unit,
      })),
    });
    console.log("[zoho-post] PDF generated, size (bytes):", pdfBuffer.length);

    const orgId = process.env.ZOHO_ORG_ID!;
    const token = await getAccessToken();
    const soId = zohoResult.salesorder.salesorder_id;
    console.log("[zoho-post] Attaching PDF to SO:", soId);

    const form = new FormData();
    form.append(
      "attachment",
      new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }),
      `order-${order.order_number}.pdf`
    );

    const attachUrl = `${ZOHO_API_BASE}/salesorders/${soId}/attachment?organization_id=${orgId}`;
    console.log("[zoho-post] POST", attachUrl);
    const attachRes = await fetch(attachUrl, {
      method: "POST",
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      body: form,
    });
    const attachJson = await attachRes.json().catch(() => null);
    console.log("[zoho-post] Attachment response status:", attachRes.status, "body:", JSON.stringify(attachJson));
    pdfResult = { ok: attachRes.ok, status: attachRes.status, body: attachJson };
  } catch (pdfErr) {
    const msg = pdfErr instanceof Error ? pdfErr.stack ?? pdfErr.message : String(pdfErr);
    console.error("[zoho-post] PDF attachment failed:", msg);
    pdfResult = { ok: false, error: msg };
  }

  return NextResponse.json({
    success: true,
    zohoSalesorderId: zohoResult.salesorder.salesorder_id,
    zohoSalesorderNumber: zohoResult.salesorder.salesorder_number,
    pdfAttachment: pdfResult,
  });
}
