/**
 * Zoho Books → Supabase product sync service
 *
 * Fetches all items from Zoho Books and upserts them into the `products`
 * table (matched on `zoho_item_id`, falling back to `sku`).
 *
 * Also auto-creates/matches Supabase `categories` from Zoho's category_name so
 * that the user-facing shop shows the correct category hierarchy.
 *
 * Fields mapped (all columns — requires migration 20260602_zoho_extended_fields.sql):
 *   item_id        → products.zoho_item_id
 *   name           → products.name / slug
 *   rate           → products.price
 *   stock_on_hand  → products.stock
 *   sku            → products.sku
 *   status         → products.status
 *   description    → products.description
 *   category_name  → products.zoho_category_name + auto-matched category_id
 *   hsn_or_sac     → products.hsn_or_sac
 *   product_type   → products.product_type
 *   unit           → products.zoho_unit
 *   item_type      → products.zoho_item_type
 *   intra/inter tax → products.intra_state_tax_* / inter_state_tax_*
 */

import { zohoGet } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Zoho types ────────────────────────────────────────────────────────────────

/**
 * Each entry in item_tax_preferences contains a tax_id and tax_specification
 * ("intra" | "inter"). The actual rate is NOT embedded here — it must be
 * looked up from the /settings/taxes endpoint by tax_id.
 */
interface ZohoTaxPreference {
  tax_id?: string | number;
  tax_name?: string;          // populated only in some Zoho responses
  tax_type?: string;          // legacy — some responses still include this
  tax_specification?: string; // "intra" | "inter" — the canonical Zoho India field
  tax_percentage?: number | string; // may be present in some responses
}

/** A tax record returned by GET /settings/taxes */
interface ZohoTax {
  tax_id: string | number;
  tax_name: string;
  tax_percentage: number | string; // Zoho sometimes returns "18%" as a string
  tax_type?: string;
  tax_specific_type?: string; // "igst" | "cgst" | "sgst" | "nil" | "cess" (India only)
}

interface ZohoTaxesResponse {
  code: number;
  message: string;
  taxes: ZohoTax[];
}

interface ZohoItem {
  item_id: string;
  name: string;
  rate: number;
  purchase_rate?: number;
  description?: string;
  sku?: string;
  stock_on_hand?: number;
  status: "active" | "inactive";
  item_type?: string; // "inventory" | "service" | "non_inventory"
  unit?: string;
  hsn_or_sac?: string;
  product_type?: string; // "goods" | "service"
  category_id?: string;
  category_name?: string;
  // Top-level GST tax fields (summary values — tax_percentage may be a string like "18%")
  tax_name?: string;
  tax_percentage?: number | string;
  // Direct intra/inter fields (present in some Zoho India responses)
  intrastate_rate?: number;
  intrastate_tax_name?: string;
  intrastate_tax_type?: string;
  interstate_rate?: number;
  interstate_tax_name?: string;
  interstate_tax_type?: string;
  item_tax_preferences?: ZohoTaxPreference[];
  // custom fields
  custom_field_hash?: Record<string, unknown>;
  image_document_id?: string;
}

interface ZohoItemsResponse {
  code: number;
  message: string;
  items: ZohoItem[];
  page_context?: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
    sort_column: string;
    sort_order: string;
  };
}

export interface ZohoSyncResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  durationMs: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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
 * Extract intra/inter-state tax info.
 *
 * Root cause of previous bug:
 *  1. Zoho's item_tax_preferences uses `tax_specification` ("intra"/"inter"),
 *     NOT `tax_type` — we were checking the wrong field.
 *  2. Rates are NOT embedded in item_tax_preferences; they live in the taxes
 *     list (/settings/taxes) and must be looked up by tax_id.
 *  3. The top-level `tax_percentage` field is a string like "18%", not a number.
 */
function extractTaxInfo(
  item: ZohoItem,
  taxMap: Map<string, ZohoTax>
) {
  const prefs = Array.isArray(item.item_tax_preferences) ? item.item_tax_preferences : [];

  // Accumulate intra and inter rates (sum if multiple taxes per specification)
  let intraRate = 0;
  let intraName: string | null = null;
  let interRate = 0;
  let interName: string | null = null;

  for (const pref of prefs) {
    // Zoho India uses `tax_specification` ("intra" | "inter").
    // Some legacy/other responses use `tax_type` — support both.
    const spec = (
      typeof pref.tax_specification === "string" ? pref.tax_specification :
      typeof pref.tax_type === "string" ? pref.tax_type : ""
    ).toLowerCase();

    // Look up the tax rate from the taxes map first; fall back to the
    // (rarely populated) inline tax_percentage on the preference object.
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

  // If item_tax_preferences had no matches, fall back to the direct
  // intrastate_rate / interstate_rate fields (present on some detail responses)
  // and then to the top-level tax_name / tax_percentage (which is a string).
  const fallbackName = item.tax_name ?? null;
  const fallbackRate = parseTaxPct(item.tax_percentage);

  const finalIntraRate =
    item.intrastate_rate != null ? item.intrastate_rate :
    intraRate > 0 ? intraRate :
    interRate > 0 ? null :          // if only inter was set, don't use fallback for intra
    fallbackRate;

  const finalInterRate =
    item.interstate_rate != null ? item.interstate_rate :
    interRate > 0 ? interRate :
    intraRate > 0 ? null :          // if only intra was set, don't use fallback for inter
    fallbackRate;

  return {
    intra_state_tax_name: item.intrastate_tax_name ?? intraName ?? (finalIntraRate != null ? fallbackName : null),
    intra_state_tax_rate: finalIntraRate,
    intra_state_tax_type: item.intrastate_tax_type ?? null,
    inter_state_tax_name: item.interstate_tax_name ?? interName ?? (finalInterRate != null ? fallbackName : null),
    inter_state_tax_rate: finalInterRate,
  };
}

/** Fetch all taxes from Zoho Books and build a lookup map: tax_id → ZohoTax */
async function fetchTaxMap(): Promise<Map<string, ZohoTax>> {
  const taxMap = new Map<string, ZohoTax>();
  try {
    const response = await zohoGet<ZohoTaxesResponse>("/settings/taxes");
    if (response.code === 0 && Array.isArray(response.taxes)) {
      for (const tax of response.taxes) {
        taxMap.set(String(tax.tax_id), tax);
      }
      console.log(`[sync] Loaded ${taxMap.size} taxes from Zoho Books`);
    }
  } catch (err) {
    console.warn("[sync] Could not fetch taxes list — tax rates may be missing:", err);
  }
  return taxMap;
}

interface ZohoItemDetailResponse {
  code: number;
  message: string;
  item: ZohoItem;
}

const DETAIL_BATCH_SIZE = 10; // concurrent detail requests — stays within Zoho rate limits

/** Fetch the full detail for a single item to get tax fields missing from the list endpoint. */
async function fetchItemDetail(itemId: string): Promise<ZohoItem | null> {
  try {
    const response = await zohoGet<ZohoItemDetailResponse>(`/items/${itemId}`);
    if (response.code !== 0) {
      console.warn(`[sync] detail fetch failed for ${itemId}: ${response.message}`);
      return null;
    }
    return response.item;
  } catch (err) {
    console.warn(`[sync] detail fetch threw for ${itemId}:`, err);
    return null;
  }
}

/** Fetch ALL pages from Zoho Books /items, then enrich each with detail endpoint for tax data. */
async function fetchAllZohoItems(): Promise<ZohoItem[]> {
  const summaries: ZohoItem[] = [];
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
      throw new Error(`Zoho Books returned error code ${response.code}: ${response.message}`);
    }

    // Defensive post-fetch filter — only sync goods/inventory/active items
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

  // Enrich with detail endpoint — the list endpoint omits intrastate_rate,
  // interstate_rate, item_tax_preferences, etc. that carry the tax data.
  const detailed: ZohoItem[] = [];
  for (let i = 0; i < summaries.length; i += DETAIL_BATCH_SIZE) {
    const batch = summaries.slice(i, i + DETAIL_BATCH_SIZE);
    const results = await Promise.all(batch.map((s) => fetchItemDetail(s.item_id)));
    for (let j = 0; j < results.length; j++) {
      // Fall back to summary if detail call failed so the row still syncs
      detailed.push(results[j] ?? batch[j]);
    }
  }

  return detailed;
}

// ── Main sync function ────────────────────────────────────────────────────────

export async function syncZohoProducts(): Promise<ZohoSyncResult> {
  const startedAt = Date.now();
  const result: ZohoSyncResult = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    durationMs: 0,
  };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any; // bypass strict row typing — new columns not yet in generated types

  // ① Fetch all taxes first — we need them to look up rates from item_tax_preferences
  const taxMap = await fetchTaxMap();

  // ② Fetch all items from Zoho
  let zohoItems: ZohoItem[];
  try {
    zohoItems = await fetchAllZohoItems();
  } catch (err) {
    result.errors.push(`Failed to fetch Zoho items: ${String(err)}`);
    result.durationMs = Date.now() - startedAt;
    return result;
  }

  result.total = zohoItems.length;

  // ② Build/load category map: zoho category_name → supabase category id
  //    Auto-create any Zoho category that doesn't yet exist in Supabase.
  const categoryNameToId = new Map<string, string>();

  const zohoCategories = new Set<string>();
  for (const item of zohoItems) {
    if (item.category_name?.trim()) {
      zohoCategories.add(item.category_name.trim());
    }
  }

  if (zohoCategories.size > 0) {
    // Load existing categories from DB
    const { data: existingCats } = await db
      .from("categories")
      .select("id, name");

    for (const cat of existingCats ?? []) {
      categoryNameToId.set((cat.name as string).toLowerCase(), cat.id as string);
    }

    // Create missing categories
    for (const catName of zohoCategories) {
      if (!categoryNameToId.has(catName.toLowerCase())) {
        const catSlug = generateSlug(catName);
        // Make slug unique
        let finalSlug = catSlug;
        const { count } = await db
          .from("categories")
          .select("id", { count: "exact", head: true })
          .eq("slug", catSlug);
        if ((count ?? 0) > 0) {
          finalSlug = `${catSlug}-${Date.now()}`;
        }

        const { data: newCat, error: catErr } = await db
          .from("categories")
          .insert({ name: catName, slug: finalSlug, status: "active" })
          .select("id")
          .single();

        if (catErr || !newCat) {
          result.errors.push(`Could not create category "${catName}": ${(catErr as { message?: string })?.message ?? "unknown"}`);
        } else {
          categoryNameToId.set(catName.toLowerCase(), (newCat as { id: string }).id);
        }
      }
    }
  }

  // ③ Load ALL existing products keyed by zoho_item_id and sku.
  // ⑤ Upsert each Zoho item
  // (Note: step numbers updated to reflect the new fetchTaxMap step ① above)
  //    Supabase caps plain .select() at 1000 rows — paginate to get everything.
  const byZohoId = new Map<string, string>(); // zoho_item_id → product.id
  const bySku = new Map<string, string>();     // sku          → product.id
  {
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data: page } = await db
        .from("products")
        .select("id, sku, zoho_item_id")
        .range(from, from + PAGE - 1);

      for (const row of (page ?? []) as Array<{ id: string; sku: string | null; zoho_item_id: string | null }>) {
        if (row.zoho_item_id) byZohoId.set(row.zoho_item_id, row.id);
        if (row.sku) bySku.set(row.sku, row.id);
      }

      if ((page?.length ?? 0) < PAGE) break;
      from += PAGE;
    }
  }

  // ④ Upsert each Zoho item
  for (const item of zohoItems) {
    try {
      const slug = generateSlug(item.name);
      const stock = Math.max(0, Math.floor(Number(item.stock_on_hand ?? 0)));
      const price = Math.max(0, Number(item.rate ?? 0));
      // Default all synced items to active so they appear in the store.
      // Admin can mark products inactive individually via the edit sheet.
      const status = "active" as const;

      // Resolve category_id: prefer custom field, fallback to Zoho category_name lookup
      const customFields = item.custom_field_hash ?? {};
      const customCategoryId = customFields["cf_category_id"]
        ? String(customFields["cf_category_id"])
        : null;

      let resolvedCategoryId: string | null = customCategoryId;
      if (!resolvedCategoryId && item.category_name?.trim()) {
        resolvedCategoryId = categoryNameToId.get(item.category_name.trim().toLowerCase()) ?? null;
      }

      const salePrice = customFields["cf_sale_price"]
        ? Number(customFields["cf_sale_price"])
        : null;
      const brand = customFields["cf_brand"]
        ? String(customFields["cf_brand"])
        : null;
      const isFeatured = customFields["cf_is_featured"] === true || customFields["cf_is_featured"] === "true";
      const isTrending = customFields["cf_is_trending"] === true || customFields["cf_is_trending"] === "true";
      const isNewArrival = customFields["cf_is_new_arrival"] === true || customFields["cf_is_new_arrival"] === "true";

      const tax = extractTaxInfo(item, taxMap);

      const basePayload = {
        name: item.name.trim(),
        slug,
        description: item.description?.trim() || null,
        price,
        sale_price: salePrice && salePrice > 0 ? salePrice : null,
        sku: item.sku?.trim() || null,
        stock,
        status,
        brand,
        category_id: resolvedCategoryId,
        is_featured: isFeatured,
        is_trending: isTrending,
        is_new_arrival: isNewArrival,
        zoho_item_id: item.item_id,
        zoho_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Extended fields — only included if the migration has been applied.
      // If the columns don't exist yet, the upsert will fail on these fields;
      // we catch that and fall back to basePayload so categories + products
      // still get created/linked even before the migration is run.
      const extendedPayload = {
        ...basePayload,
        zoho_category_name: item.category_name?.trim() || null,
        hsn_or_sac: item.hsn_or_sac?.trim() || null,
        product_type: item.product_type ?? null,
        zoho_unit: item.unit?.trim() || null,
        zoho_item_type: item.item_type ?? null,
        intra_state_tax_name: tax.intra_state_tax_name,
        intra_state_tax_rate: tax.intra_state_tax_rate,
        intra_state_tax_type: tax.intra_state_tax_type,
        inter_state_tax_name: tax.inter_state_tax_name,
        inter_state_tax_rate: tax.inter_state_tax_rate,
      };

      // Find existing record
      const existingId =
        byZohoId.get(item.item_id) ??
        (item.sku ? bySku.get(item.sku) : undefined);

      if (existingId) {
        // UPDATE — try extended fields first, fall back to base if columns don't exist
        let { error } = await db
          .from("products")
          .update(extendedPayload)
          .eq("id", existingId);

        if (error && (error as { message?: string }).message?.includes("column")) {
          ({ error } = await db
            .from("products")
            .update(basePayload)
            .eq("id", existingId));
        }

        if (error) {
          result.errors.push(`Update failed for "${item.name}": ${(error as { message?: string }).message}`);
        } else {
          result.updated++;
          byZohoId.set(item.item_id, existingId);
          if (item.sku) bySku.set(item.sku, existingId);
        }
      } else {
        // INSERT — ensure unique slug
        let finalSlug = slug;
        const { count } = await db
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("slug", slug);

        if ((count ?? 0) > 0) {
          finalSlug = `${slug}-${item.item_id.slice(-6)}`;
        }

        // Try with extended payload first, fall back to base if migration not yet applied
        let { data: created, error } = await db
          .from("products")
          .insert({ ...extendedPayload, slug: finalSlug })
          .select("id")
          .single();

        if (error && (error as { message?: string }).message?.includes("column")) {
          ({ data: created, error } = await db
            .from("products")
            .insert({ ...basePayload, slug: finalSlug })
            .select("id")
            .single());
        }

        // If zoho_item_id already exists (race condition / incomplete map),
        // look up the real product and update it instead.
        const errMsg = (error as { message?: string } | null)?.message ?? "";
        if (errMsg.includes("products_zoho_item_id_key") || errMsg.includes("duplicate key")) {
          const { data: existing } = await db
            .from("products")
            .select("id")
            .eq("zoho_item_id", item.item_id)
            .single();

          if (existing) {
            const existingProductId = (existing as { id: string }).id;

            let { error: updateErr } = await db
              .from("products")
              .update(extendedPayload)
              .eq("id", existingProductId);

            if (updateErr && (updateErr as { message?: string }).message?.includes("column")) {
              ({ error: updateErr } = await db
                .from("products")
                .update(basePayload)
                .eq("id", existingProductId));
            }

            if (updateErr) {
              result.errors.push(`Fallback update failed for "${item.name}": ${(updateErr as { message?: string }).message}`);
            } else {
              result.updated++;
              byZohoId.set(item.item_id, existingProductId);
              if (item.sku) bySku.set(item.sku, existingProductId);
            }
            continue;
          }
        }

        if (error || !created) {
          result.errors.push(`Insert failed for "${item.name}": ${errMsg || "unknown"}`);
        } else {
          result.created++;
          byZohoId.set(item.item_id, (created as { id: string }).id);
          if (item.sku) bySku.set(item.sku, (created as { id: string }).id);
        }
      }
    } catch (err) {
      result.errors.push(`Unexpected error for "${item.name}": ${String(err)}`);
    }
  }

  result.durationMs = Date.now() - startedAt;
  return result;
}

// ── Fetch a single Zoho item (for on-demand refresh) ─────────────────────────

export async function fetchZohoItem(zohoItemId: string): Promise<ZohoItem | null> {
  interface ZohoSingleItemResponse {
    code: number;
    message: string;
    item: ZohoItem;
  }
  try {
    const response = await zohoGet<ZohoSingleItemResponse>(`/items/${zohoItemId}`);
    return response.code === 0 ? response.item : null;
  } catch {
    return null;
  }
}

