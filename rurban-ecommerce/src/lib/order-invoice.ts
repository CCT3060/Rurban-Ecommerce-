/**
 * Sync a Zoho Books invoice onto a Rurban order.
 *
 * Given an order and either a Zoho invoice_id (from the webhook / custom button)
 * or an invoice_number (typed by the manager), this:
 *   1. resolves the invoice in Zoho Books,
 *   2. downloads its PDF and stores a copy in the private 'invoices' bucket,
 *   3. records the invoice id/number/status + PDF path on the order.
 *
 * The stored PDF is what the customer downloads in the app (via a signed URL),
 * so we don't hit Zoho on every customer view and don't expose Zoho tokens.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findInvoiceByNumber,
  getInvoice,
  getInvoicePdf,
  type ZohoInvoiceSummary,
} from "@/lib/zoho/invoices";

export interface SyncInvoiceResult {
  invoice_id: string;
  invoice_number: string;
  status: string | null;
}

export async function syncInvoiceToOrder(
  orderId: string,
  opts: { invoiceId?: string; invoiceNumber?: string }
): Promise<SyncInvoiceResult> {
  let summary: ZohoInvoiceSummary | null = null;
  if (opts.invoiceId) {
    summary = await getInvoice(opts.invoiceId);
  } else if (opts.invoiceNumber) {
    summary = await findInvoiceByNumber(opts.invoiceNumber);
  }
  if (!summary) {
    throw new Error("Invoice not found in Zoho Books. Check the invoice number.");
  }

  const pdf = await getInvoicePdf(summary.invoice_id);

  const admin = createAdminClient();
  const path = `${orderId}.pdf`;
  const { error: uploadError } = await admin.storage
    .from("invoices")
    .upload(path, new Blob([pdf], { type: "application/pdf" }), {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "3600",
    });
  if (uploadError) {
    throw new Error(`Failed to store invoice PDF: ${uploadError.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { error: updateError } = await db
    .from("orders")
    .update({
      zoho_invoice_id: summary.invoice_id,
      zoho_invoice_number: summary.invoice_number,
      zoho_invoice_status: summary.status ?? null,
      invoice_pdf_path: path,
      invoice_synced_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    invoice_id: summary.invoice_id,
    invoice_number: summary.invoice_number,
    status: summary.status ?? null,
  };
}
