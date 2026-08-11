/**
 * POST /api/admin/orders/[id]/link-invoice
 *
 * Manager-triggered: after creating the invoice in Zoho Books, they paste the
 * Zoho invoice number here. We fetch that invoice + its PDF and attach it to
 * the order. Works without any Zoho-side configuration.
 */
import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/auth/request-context";
import { syncInvoiceToOrder } from "@/lib/order-invoice";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getRequestContext();
  if (!auth.ok) return auth.response;
  if (auth.context.role !== "admin" && auth.context.role !== "warehouse_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { invoice_number?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const invoiceNumber = String(body.invoice_number ?? "").trim();
  if (!invoiceNumber) {
    return NextResponse.json({ error: "invoice_number is required" }, { status: 400 });
  }

  try {
    const result = await syncInvoiceToOrder(id, { invoiceNumber });
    return NextResponse.json({ data: result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to link invoice" },
      { status: 400 }
    );
  }
}
