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
  tax_id?: string;
  tax_name?: string;
  tax_type?: string; // "intrastate" | "interstate"
  tax_percentage?: number;
}

interface ZohoItemFull {
  item_id: string;
  name: string;
  sku?: string;
  hsn_or_sac?: string;
  product_type?: "goods"; // "goods" | "service"
  category_id?: string;
  category_name?: string;
  status: "active";
  unit?: string;
  item_type?: "inventory"; // "inventory" | "service" | "non_inventory"
  // Single-tax fields (fallback — Zoho list endpoint often returns these)
  tax_name?: string;
  tax_percentage?: number;
  // GST India — detailed intra/inter breakdown
  intrastate_rate?: number;
  intrastate_tax_name?: string;
  intrastate_tax_type?: string;
  interstate_rate?: number;
  interstate_tax_name?: string;
  interstate_tax_type?: string;
  // Tax preferences array (returned on item detail or in some list responses)
  item_tax_preferences?: ZohoTaxPreference[];
  // Catch-all for unknown extra fields from Zoho
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
  status: string;
  unit: string;
  item_type: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchAllZohoItemsFull(): Promise<ZohoItemFull[]> {
  const all: ZohoItemFull[] = [];
  let page = 1;
  let debugLogged = false;

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

    // Log the first item once so we can see the raw Zoho field names
    if (!debugLogged && response.items?.length) {
      console.log("[zoho/items] RAW first item sample:", JSON.stringify(response.items[0], null, 2));
      debugLogged = true;
    }

    // Defensive post-fetch filter — only show goods/inventory/active items
    const filtered = (response.items ?? []).filter(
      (item) =>
        item.status === "active" &&
        item.product_type === "goods" &&
        item.item_type === "inventory"
    );
    all.push(...filtered);
    if (!response.page_context?.has_more_page) break;
    page++;
  }

  return all;
}

function extractTaxInfo(item: ZohoItemFull) {
  const prefs = Array.isArray(item.item_tax_preferences) ? item.item_tax_preferences : [];

  const fmt = (rate?: number | null) =>
    rate != null && rate !== 0 ? `${rate}%` : "-";

  // Match intra / inter from item_tax_preferences
  const intraPref = prefs.find(
    (p) => typeof p.tax_type === "string" && p.tax_type.toLowerCase().includes("intra")
  );
  const interPref = prefs.find(
    (p) => typeof p.tax_type === "string" && p.tax_type.toLowerCase().includes("inter")
  );
  // Some Zoho setups use a single tax entry (not split intra/inter)
  const singleTax = prefs.length === 1 ? prefs[0] : undefined;

  // Fallback: top-level tax_name / tax_percentage (Zoho list endpoint often returns these)
  const fallbackTaxName = typeof item.tax_name === "string" ? item.tax_name : undefined;
  const fallbackTaxPct  = typeof item.tax_percentage === "number" ? item.tax_percentage : undefined;

  const intraName = item.intrastate_tax_name ?? intraPref?.tax_name ?? singleTax?.tax_name ?? fallbackTaxName ?? "-";
  const intraRate = item.intrastate_rate ?? intraPref?.tax_percentage ?? singleTax?.tax_percentage ?? fallbackTaxPct;
  const intraType = item.intrastate_tax_type ?? (typeof intraPref?.tax_type === "string" ? intraPref.tax_type : undefined) ?? "intrastate";

  const interName = item.interstate_tax_name ?? interPref?.tax_name ?? singleTax?.tax_name ?? fallbackTaxName ?? "-";
  const interRate = item.interstate_rate ?? interPref?.tax_percentage ?? singleTax?.tax_percentage ?? fallbackTaxPct;
  const interType = item.interstate_tax_type ?? (typeof interPref?.tax_type === "string" ? interPref.tax_type : undefined) ?? "interstate";

  return {
    intra_state_tax_name: intraName,
    intra_state_tax_rate: fmt(intraRate),
    intra_state_tax_type: intraName !== "-" ? intraType : "-",
    inter_state_tax_name: interName,
    inter_state_tax_rate: fmt(interRate),
    inter_state_tax_type: interName !== "-" ? interType : "-",
  };
}

function mapToRow(item: ZohoItemFull): ZohoItemRow {
  const tax = extractTaxInfo(item);
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

    const items = await fetchAllZohoItemsFull();
    const rows = items.map(mapToRow);

    return NextResponse.json({ data: rows, total: rows.length });
  } catch (err) {
    console.error("[zoho/items GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Zoho items", detail: String(err) },
      { status: 500 }
    );
  }
}
