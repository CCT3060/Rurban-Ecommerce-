/**
 * Zoho Books — Invoice read helpers.
 *
 * The manager creates the invoice in Zoho Books (manually, against a Sales
 * Order). We only ever READ it here: look it up by id or number, read its
 * status, and download its PDF. We never create/modify invoices in Zoho.
 */
import { zohoGet, getAccessToken, ZOHO_API_BASE } from "./client";

export interface ZohoInvoiceSummary {
  invoice_id: string;
  invoice_number: string;
  status?: string;
  reference_number?: string;
  salesorder_id?: string;
  total?: number;
}

/** Find an invoice by its Zoho invoice number (e.g. "INV-000123"). */
export async function findInvoiceByNumber(
  invoiceNumber: string
): Promise<ZohoInvoiceSummary | null> {
  const res = await zohoGet<{ invoices?: ZohoInvoiceSummary[] }>("/invoices", {
    invoice_number: invoiceNumber,
  });
  const list = res.invoices ?? [];
  // Prefer an exact match; fall back to the first result.
  return list.find((i) => i.invoice_number === invoiceNumber) ?? list[0] ?? null;
}

/** Fetch a single invoice by its Zoho invoice_id. */
export async function getInvoice(invoiceId: string): Promise<ZohoInvoiceSummary | null> {
  const res = await zohoGet<{ invoice?: ZohoInvoiceSummary }>(`/invoices/${invoiceId}`);
  return res.invoice ?? null;
}

/** Download the invoice PDF bytes from Zoho Books. */
export async function getInvoicePdf(invoiceId: string): Promise<ArrayBuffer> {
  const orgId = process.env.ZOHO_ORG_ID;
  if (!orgId) throw new Error("ZOHO_ORG_ID environment variable is not set.");

  const token = await getAccessToken();
  const url = `${ZOHO_API_BASE}/invoices/${invoiceId}?organization_id=${orgId}&accept=pdf`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      Accept: "application/pdf",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Zoho invoice PDF fetch failed (${res.status}): ${text}`);
  }

  return res.arrayBuffer();
}
