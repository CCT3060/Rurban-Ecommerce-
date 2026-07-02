/**
 * GET /api/admin/zoho/warehouses
 * Fetches all warehouses/stores from Zoho Books (GET /settings/warehouses).
 * Admin-only. Results are cached in-process for 5 minutes to avoid rate limits.
 *
 * Add ?refresh=1 to force a fresh fetch bypassing the cache.
 */
import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/auth/request-context";
import { zohoGet } from "@/lib/zoho/client";

export const dynamic = "force-dynamic";

// ── In-process cache (survives across requests in same server process) ────────
type CachedWarehouse = {
  warehouse_id: string;
  warehouse_name: string;
  email: string | null;
  is_primary: boolean;
  status: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  address_line: string | null;
  created_time: string | null;
};

let warehouseCache: CachedWarehouse[] | null = null;
let cacheExpiresAt = 0; // unix ms
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ZohoWarehouseAddress {
  attention?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

interface ZohoWarehouse {
  warehouse_id: string;
  warehouse_name: string;
  email?: string;
  is_primary?: boolean;
  status?: string;
  created_time?: string;
  address?: ZohoWarehouseAddress;
  // some Zoho regions expose these at top level
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

interface ZohoWarehousesResponse {
  code: number;
  message: string;
  warehouses?: ZohoWarehouse[];
}

export async function GET(request: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  if (
    !process.env.ZOHO_CLIENT_ID ||
    !process.env.ZOHO_CLIENT_SECRET ||
    !process.env.ZOHO_REFRESH_TOKEN ||
    !process.env.ZOHO_ORG_ID
  ) {
    return NextResponse.json(
      { error: "Zoho Books is not configured. Add ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, and ZOHO_ORG_ID to your environment variables." },
      { status: 422 }
    );
  }

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  // Return cached result if still valid
  if (!forceRefresh && warehouseCache && Date.now() < cacheExpiresAt) {
    return NextResponse.json({ data: warehouseCache, cached: true });
  }

  try {
    const res = await zohoGet<ZohoWarehousesResponse>("/settings/warehouses");

    if (res.code !== 0) {
      // If rate-limited and we have a stale cache, return it rather than an error
      if (warehouseCache) {
        return NextResponse.json({ data: warehouseCache, cached: true, stale: true });
      }
      return NextResponse.json(
        { error: `Zoho API error: ${res.message}` },
        { status: 502 }
      );
    }

    const warehouses: CachedWarehouse[] = (res.warehouses ?? []).map((w) => ({
      warehouse_id: w.warehouse_id,
      warehouse_name: w.warehouse_name,
      email: w.email ?? null,
      is_primary: w.is_primary ?? false,
      status: w.status ?? "active",
      phone: w.address?.phone ?? w.phone ?? null,
      city: w.address?.city ?? w.city ?? null,
      state: w.address?.state ?? w.state ?? null,
      zip: w.address?.zip ?? w.zip ?? null,
      country: w.address?.country ?? w.country ?? null,
      address_line: w.address?.address ?? null,
      created_time: w.created_time ?? null,
    }));

    // Store in cache
    warehouseCache = warehouses;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    return NextResponse.json({ data: warehouses });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // On rate-limit errors, serve stale cache if available
    if (warehouseCache && msg.includes("429")) {
      return NextResponse.json({ data: warehouseCache, cached: true, stale: true });
    }

    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

