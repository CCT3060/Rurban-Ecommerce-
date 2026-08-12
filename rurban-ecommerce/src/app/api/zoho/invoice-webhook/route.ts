/**
 * POST /api/zoho/invoice-webhook
 *
 * Called by a Zoho Books Custom Button / Custom Function (Deluge `invokeUrl`)
 * when the manager posts an invoice to our site. Authenticated by a shared
 * secret (ZOHO_WEBHOOK_SECRET) — NOT by a logged-in session.
 *
 * Expected JSON body from the Deluge function:
 *   { "secret": "...", "invoice_id": "...",
 *     "order_number": "RIPL-..." | "salesorder_number": "SO-..." }
 *
 * NOTE: Zoho calls this from its cloud, so the endpoint must be reachable at a
 * public HTTPS URL. Until the server has HTTPS, use the manual "Link Invoice"
 * button on the order page instead.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncInvoiceToOrder } from "@/lib/order-invoice";
import { getInvoice } from "@/lib/zoho/invoices";

export async function POST(request: Request) {
  const secret = process.env.ZOHO_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  let body: {
    secret?: string;
    invoice_id?: string;
    order_number?: string;
    reference_number?: string;
    salesorder_number?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const provided = String(body.secret ?? request.headers.get("x-zoho-webhook-secret") ?? "");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invoiceId = String(body.invoice_id ?? "").trim();
  if (!invoiceId) {
    return NextResponse.json({ error: "invoice_id is required" }, { status: 400 });
  }

  const orderNumber = String(body.order_number ?? body.reference_number ?? "").trim();
  const salesorderNumber = String(body.salesorder_number ?? "").trim();

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const findByOrderNumber = async (num: string): Promise<string | null> => {
    if (!num) return null;
    const { data } = await db.from("orders").select("id").eq("order_number", num).maybeSingle();
    return data?.id ?? null;
  };
  const findBySalesorderNumber = async (num: string): Promise<string | null> => {
    if (!num) return null;
    const { data } = await db.from("orders").select("id").eq("zoho_salesorder_number", num).maybeSingle();
    return data?.id ?? null;
  };

  // 1) Match on what the Deluge function sent.
  let orderId = (await findByOrderNumber(orderNumber)) ?? (await findBySalesorderNumber(salesorderNumber));

  // 2) Fallback: read the invoice from Zoho and match on its ACTUAL reference
  //    number — this doesn't depend on the Deluge argument mapping being right.
  let invoiceRef = "";
  if (!orderId) {
    try {
      const inv = await getInvoice(invoiceId);
      invoiceRef = String(inv?.reference_number ?? "").trim();
      if (invoiceRef) orderId = await findByOrderNumber(invoiceRef);
    } catch {
      // ignore — reported below
    }
  }

  if (!orderId) {
    return NextResponse.json(
      {
        error:
          "Could not match the invoice to an order. The invoice's Reference# must be the order's PO number (e.g. RIPL-Ecom-...).",
        tried: {
          order_number: orderNumber || null,
          salesorder_number: salesorderNumber || null,
          invoice_reference: invoiceRef || null,
        },
      },
      { status: 404 }
    );
  }

  try {
    const result = await syncInvoiceToOrder(orderId, { invoiceId });
    return NextResponse.json({ data: result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 400 }
    );
  }
}
