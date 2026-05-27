/**
 * Zoho Books → Supabase product sync service
 *
 * Fetches all items from Zoho Books and upserts them into the `products`
 * table (matched on `sku`, falling back to `zoho_item_id`).
 *
 * Fields mapped:
 *   Zoho item_id  → products.zoho_item_id  (needs column — see migration below)
 *   name          → products.name / slug
 *   rate          → products.price
 *   description   → products.description
 *   stock_on_hand → products.stock
 *   sku           → products.sku
 *   status        → products.status  ("active" / "inactive")
 *   item_type     → skipped (inventory items only)
 *
 * Returns a SyncResult with counts of created / updated / skipped records.
 */

import { zohoGet } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Zoho types ────────────────────────────────────────────────────────────────

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
  image_document_id?: string;
  custom_field_hash?: Record<string, unknown>;
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

/** Fetch ALL pages from Zoho Books /items */
async function fetchAllZohoItems(): Promise<ZohoItem[]> {
  const all: ZohoItem[] = [];
  let page = 1;

  while (true) {
    const response = await zohoGet<ZohoItemsResponse>("/items", {
      page,
      per_page: 200,
    });

    if (response.code !== 0) {
      throw new Error(`Zoho Books returned error code ${response.code}: ${response.message}`);
    }

    all.push(...(response.items ?? []));

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

  // ② Load existing products keyed by zoho_item_id and sku
  const { data: existingProducts } = await admin
    .from("products")
    .select("id, sku, zoho_item_id");

  const byZohoId = new Map<string, string>(); // zoho_item_id → product.id
  const bySku = new Map<string, string>();     // sku          → product.id

  for (const row of existingProducts ?? []) {
    if (row.zoho_item_id) byZohoId.set(row.zoho_item_id, row.id);
    if (row.sku) bySku.set(row.sku, row.id);
  }

  // ③ Upsert each Zoho item
  for (const item of zohoItems) {
    // Skip service/non-inventory items that have no stock concept
    if (item.item_type === "service") {
      result.skipped++;
      continue;
    }

    try {
      const slug = generateSlug(item.name);
      const stock = Math.max(0, Math.floor(Number(item.stock_on_hand ?? 0)));
      const price = Math.max(0, Number(item.rate ?? 0));
      const status: "active" | "inactive" = item.status === "active" ? "active" : "inactive";

      // Extract custom fields for extra mappings
      const customFields = item.custom_field_hash ?? {};
      const salePrice = customFields["cf_sale_price"]
        ? Number(customFields["cf_sale_price"])
        : null;
      const brand = customFields["cf_brand"]
        ? String(customFields["cf_brand"])
        : null;
      const categoryId = customFields["cf_category_id"]
        ? String(customFields["cf_category_id"])
        : null;
      const isFeatured = customFields["cf_is_featured"] === true || customFields["cf_is_featured"] === "true";
      const isTrending = customFields["cf_is_trending"] === true || customFields["cf_is_trending"] === "true";
      const isNewArrival = customFields["cf_is_new_arrival"] === true || customFields["cf_is_new_arrival"] === "true";

      const payload = {
        name: item.name.trim(),
        slug,
        description: item.description?.trim() || null,
        price,
        sale_price: salePrice && salePrice > 0 ? salePrice : null,
        sku: item.sku?.trim() || null,
        stock,
        status,
        brand,
        category_id: categoryId || null,
        is_featured: isFeatured,
        is_trending: isTrending,
        is_new_arrival: isNewArrival,
        zoho_item_id: item.item_id,
        zoho_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Find existing record
      const existingId =
        byZohoId.get(item.item_id) ??
        (item.sku ? bySku.get(item.sku) : undefined);

      if (existingId) {
        // UPDATE existing product
        const { error } = await admin
          .from("products")
          .update(payload)
          .eq("id", existingId);

        if (error) {
          result.errors.push(`Update failed for "${item.name}": ${error.message}`);
        } else {
          result.updated++;
          // Update local maps
          byZohoId.set(item.item_id, existingId);
          if (item.sku) bySku.set(item.sku, existingId);
        }
      } else {
        // INSERT new product — ensure unique slug
        let finalSlug = slug;
        const { count } = await admin
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("slug", slug);

        if ((count ?? 0) > 0) {
          finalSlug = `${slug}-${item.item_id.slice(-6)}`;
        }

        const { data: created, error } = await admin
          .from("products")
          .insert({ ...payload, slug: finalSlug })
          .select("id")
          .single();

        if (error || !created) {
          result.errors.push(`Insert failed for "${item.name}": ${error?.message ?? "unknown"}`);
        } else {
          result.created++;
          byZohoId.set(item.item_id, created.id);
          if (item.sku) bySku.set(item.sku, created.id);
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
