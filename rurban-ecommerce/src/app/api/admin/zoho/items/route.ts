/**
 * GET /api/admin/zoho/items
 *
 * Fetches all items directly from Zoho Books and returns them with the
 * fields required for the admin products Zoho Items view.
 *
 * Fields returned per item:
 *   Item ID, Item Name, SKU, HSN/SAC, Product Type, Category Name,
 *   Intra State Tax Name/Rate/Type, Inter State Tax Name/Rate/Type,
 *   Status, Usage unit, Item Type
 */
import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/auth/request-context";
import { zohoGet } from "@/lib/zoho/client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ── Zoho API types ────────────────────────────────────────────────────────────

interface ZohoTaxPreference {
  tax_id?: string | number;
  tax_name?: string;
  tax_type?: string;          // legacy — some responses still include this
  tax_specification?: string; // "intra" | "inter" — the canonical Zoho India field
  tax_percentage?: number | string;
}

/** A tax record returned by GET /settings/taxes */
interface ZohoTax {
  tax_id: string | number;
  tax_name: string;
  tax_percentage: number | string;
  tax_type?: string;
  tax_specific_type?: string; // "igst" | "cgst" | "sgst" | "nil" | "cess"
}

interface ZohoTaxesResponse {
  code: number;
  message: string;
  taxes: ZohoTax[];
}

interface ZohoItemFull {
  item_id: string;
  name: string;
  sku?: string;
  hsn_or_sac?: string;
  product_type?: string;
  category_id?: string;
  category_name?: string;
  status: string;
  unit?: string;
  item_type?: string;
  // Top-level tax fields (tax_percentage may be a string like "18%")
  tax_name?: string;
  tax_percentage?: number | string;
  // Direct intra/inter fields (present in some Zoho India detail responses)
  intrastate_rate?: number;
  intrastate_tax_name?: string;
  intrastate_tax_type?: string;
  interstate_rate?: number;
  interstate_tax_name?: string;
  interstate_tax_type?: string;
  item_tax_preferences?: ZohoTaxPreference[];
  [key: string]: unknown;
}

interface ZohoItemsResponse {
  code: number;
  message: string;
  items: ZohoItemFull[];
  page_context?: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
  };
}

interface ZohoItemDetailResponse {
  code: number;
  message: string;
  item: ZohoItemFull;
}

// ── Public shape returned to the client ──────────────────────────────────────

export interface ZohoItemRow {
  item_id: string;
  name: string;
  sku: string;
  hsn_or_sac: string;
  product_type: string;
  category_name: string;
  intra_state_tax_name: string;
  intra_state_tax_rate: string;
  intra_state_tax_type: string;
  inter_state_tax_name: string;
  inter_state_tax_rate: string;
  inter_state_tax_type: string;
  status: string;
  unit: string;
  item_type: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BATCH_SIZE = 10;

/** Parse Zoho's tax_percentage which may be a number (18) or a string ("18%") */
function parseTaxPct(value: unknown): number | null {
  if (typeof value === "number" && isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value.replace("%", "").trim());
    return isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Fetch the full detail for a single item.
 * The /items/{id} endpoint returns intrastate_rate, interstate_rate,
 * item_tax_preferences, etc. that the list endpoint omits.
 */
async function fetchItemDetail(itemId: string): Promise<ZohoItemFull | null> {
  try {
    const response = await zohoGet<ZohoItemDetailResponse>(`/items/${itemId}`);
    if (response.code !== 0) {
      console.warn(`[zoho/items] detail fetch failed for ${itemId}: ${response.message}`);
      return null;
    }
    return response.item;
  } catch (err) {
    console.warn(`[zoho/items] detail fetch threw for ${itemId}:`, err);
    return null;
  }
}

/** Fetch all taxes and build a lookup map: tax_id → ZohoTax */
async function fetchTaxMap(): Promise<Map<string, ZohoTax>> {
  const taxMap = new Map<string, ZohoTax>();
  try {
    const response = await zohoGet<ZohoTaxesResponse>("/settings/taxes");
    if (response.code === 0 && Array.isArray(response.taxes)) {
      for (const tax of response.taxes) {
        taxMap.set(String(tax.tax_id), tax);
      }
    }
  } catch (err) {
    console.warn("[zoho/items] Could not fetch taxes list:", err);
  }
  return taxMap;
}

/**
 * Page through /items to collect every active goods/inventory item,
 * then enrich each one by fetching its detail endpoint in batches.
 */
async function fetchAllZohoItemsFull(): Promise<ZohoItemFull[]> {
  const summaries: ZohoItemFull[] = [];
  let page = 1;

  while (true) {
    const response = await zohoGet<ZohoItemsResponse>("/items", {
      page,
      per_page: 200,
      filter_by: "Status.Active",
      item_type: "inventory",
      product_type: "goods",
    });

    if (response.code !== 0) {
      throw new Error(`Zoho Books error ${response.code}: ${response.message}`);
    }

    const filtered = (response.items ?? []).filter(
      (item) =>
        item.status === "active" &&
        item.product_type === "goods" &&
        item.item_type === "inventory"
    );

    summaries.push(...filtered);

    if (!response.page_context?.has_more_page) break;
    page++;
  }

  console.log(`[zoho/items] ${summaries.length} items found — fetching details in batches of ${BATCH_SIZE}`);

  const detailed: ZohoItemFull[] = [];
  for (let i = 0; i < summaries.length; i += BATCH_SIZE) {
    const batch = summaries.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((summary) => fetchItemDetail(summary.item_id)));
    for (let j = 0; j < results.length; j++) {
      detailed.push(results[j] ?? batch[j]);
    }
  }

  return detailed;
}

/**
 * Extract intra/inter-state tax info.
 *
 * Bugs fixed vs previous version:
 *  1. Zoho uses `tax_specification` ("intra"/"inter"), not `tax_type`.
 *  2. Rates must be looked up from the taxes map by tax_id — they are not
 *     embedded in item_tax_preferences entries.
 *  3. top-level tax_percentage is a string like "18%", not a number.
 */
function extractTaxInfo(item: ZohoItemFull, taxMap: Map<string, ZohoTax>) {
  const prefs = Array.isArray(item.item_tax_preferences) ? item.item_tax_preferences : [];

  const fmt = (rate: number | null) =>
    rate != null && rate !== 0 ? `${rate}%` : "-";

  let intraRate = 0;
  let intraName: string | null = null;
  let interRate = 0;
  let interName: string | null = null;

  for (const pref of prefs) {
    const spec = (
      typeof pref.tax_specification === "string" ? pref.tax_specification :
      typeof pref.tax_type === "string" ? pref.tax_type : ""
    ).toLowerCase();

    const taxRecord = pref.tax_id != null ? taxMap.get(String(pref.tax_id)) : undefined;
    const rate = taxRecord
      ? parseTaxPct(taxRecord.tax_percentage)
      : parseTaxPct(pref.tax_percentage);
    const name = taxRecord?.tax_name ?? pref.tax_name ?? null;

    if (spec.includes("intra")) {
      intraRate += rate ?? 0;
      if (!intraName && name) intraName = name;
    } else if (spec.includes("inter")) {
      interRate += rate ?? 0;
      if (!interName && name) interName = name;
    }
  }

  const fallbackName = item.tax_name ?? null;
  const fallbackRate = parseTaxPct(item.tax_percentage);

  const finalIntraRate: number | null =
    item.intrastate_rate != null ? item.intrastate_rate :
    intraRate > 0 ? intraRate :
    interRate > 0 ? null :
    fallbackRate;

  const finalInterRate: number | null =
    item.interstate_rate != null ? item.interstate_rate :
    interRate > 0 ? interRate :
    intraRate > 0 ? null :
    fallbackRate;

  const resolvedIntraName =
    item.intrastate_tax_name ?? intraName ?? (finalIntraRate != null ? fallbackName : null) ?? "-";
  const resolvedInterName =
    item.interstate_tax_name ?? interName ?? (finalInterRate != null ? fallbackName : null) ?? "-";

  return {
    intra_state_tax_name: resolvedIntraName,
    intra_state_tax_rate: fmt(finalIntraRate),
    intra_state_tax_type: item.intrastate_tax_type ?? (resolvedIntraName !== "-" ? "intrastate" : "-"),
    inter_state_tax_name: resolvedInterName,
    inter_state_tax_rate: fmt(finalInterRate),
    inter_state_tax_type: item.interstate_tax_type ?? (resolvedInterName !== "-" ? "interstate" : "-"),
  };
}

function mapToRow(item: ZohoItemFull, taxMap: Map<string, ZohoTax>): ZohoItemRow {
  const tax = extractTaxInfo(item, taxMap);
  return {
    item_id: item.item_id,
    name: item.name?.trim() ?? "-",
    sku: item.sku?.trim() || "-",
    hsn_or_sac: item.hsn_or_sac?.trim() || "-",
    product_type: item.product_type ?? "-",
    category_name: item.category_name?.trim() || "Uncategorized",
    intra_state_tax_name: tax.intra_state_tax_name,
    intra_state_tax_rate: tax.intra_state_tax_rate,
    intra_state_tax_type: tax.intra_state_tax_type,
    inter_state_tax_name: tax.inter_state_tax_name,
    inter_state_tax_rate: tax.inter_state_tax_rate,
    inter_state_tax_type: tax.inter_state_tax_type,
    status: item.status,
    unit: item.unit ?? "-",
    item_type: item.item_type ?? "-",
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const auth = await requireAdminContext();
    if (!auth.ok) return auth.response;

    if (
      !process.env.ZOHO_CLIENT_ID ||
      !process.env.ZOHO_CLIENT_SECRET ||
      !process.env.ZOHO_REFRESH_TOKEN ||
      !process.env.ZOHO_ORG_ID
    ) {
      return NextResponse.json(
        { error: "Zoho Books is not configured." },
        { status: 422 }
      );
    }

    const [items, taxMap] = await Promise.all([
      fetchAllZohoItemsFull(),
      fetchTaxMap(),
    ]);
    const rows = items.map((item) => mapToRow(item, taxMap));

    return NextResponse.json({ data: rows, total: rows.length });
  } catch (err) {
    console.error("[zoho/items GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Zoho items", detail: String(err) },
      { status: 500 }
    );
  }
}