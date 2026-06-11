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

interface ZohoTaxPreference {
  tax_id?: string;
  tax_name?: string;
  tax_type?: string;
  tax_percentage?: number;
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
  // GST tax fields
  tax_name?: string;
  tax_percentage?: number;
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

/** Extract intra/inter state tax info with multi-level fallbacks */
function extractTaxInfo(item: ZohoItem) {
  const prefs = Array.isArray(item.item_tax_preferences) ? item.item_tax_preferences : [];

  const intraPref = prefs.find(
    (p) => typeof p.tax_type === "string" && p.tax_type.toLowerCase().includes("intra")
  );
  const interPref = prefs.find(
    (p) => typeof p.tax_type === "string" && p.tax_type.toLowerCase().includes("inter")
  );
  const singleTax = prefs.length === 1 ? prefs[0] : undefined;

  const fallbackTaxName = typeof item.tax_name === "string" ? item.tax_name : undefined;
  const fallbackTaxPct = typeof item.tax_percentage === "number" ? item.tax_percentage : undefined;

  const intraName = item.intrastate_tax_name ?? intraPref?.tax_name ?? singleTax?.tax_name ?? fallbackTaxName ?? null;
  const intraRate = item.intrastate_rate ?? intraPref?.tax_percentage ?? singleTax?.tax_percentage ?? fallbackTaxPct ?? null;
  const intraType = item.intrastate_tax_type ?? (typeof intraPref?.tax_type === "string" ? intraPref.tax_type : null) ?? null;

  const interName = item.interstate_tax_name ?? interPref?.tax_name ?? singleTax?.tax_name ?? fallbackTaxName ?? null;
  const interRate = item.interstate_rate ?? interPref?.tax_percentage ?? singleTax?.tax_percentage ?? fallbackTaxPct ?? null;

  return {
    intra_state_tax_name: intraName,
    intra_state_tax_rate: intraRate,
    intra_state_tax_type: intraType,
    inter_state_tax_name: interName,
    inter_state_tax_rate: interRate,
  };
}

/** Fetch ALL pages from Zoho Books /items */
async function fetchAllZohoItems(): Promise<ZohoItem[]> {
  const all: ZohoItem[] = [];
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
    all.push(...filtered);

    if (!response.page_context?.has_more_page) break;
    page++;
  }

  return all;
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

  // ① Fetch all items from Zoho
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

      const tax = extractTaxInfo(item);

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

