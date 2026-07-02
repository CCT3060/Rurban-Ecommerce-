/**
 * GET /api/cron/warehouse-stock-sync
 *
 * Daily cron job that snapshots warehouse-wise stock-in-hand into the
 * `settings` table so dashboards can read it without hitting the DB heavily.
 *
 * Secured via CRON_SECRET environment variable (same as zoho-sync).
 * Vercel Cron sets the Authorization header automatically when CRON_SECRET
 * is configured as an environment variable.
 *
 * Schedule: once per day at midnight UTC (configured in vercel.json).
 *
 * What it does:
 *  1. Fetches all active warehouses.
 *  2. For each warehouse, queries products grouped to get:
 *       - total products count
 *       - total stock units
 *       - low-stock count (stock > 0 and stock <= 10)
 *       - out-of-stock count (stock = 0)
 *       - estimated stock value (using sale_price ?? price)
 *  3. Upserts the snapshot into settings with key = "warehouse_stock_snapshot".
 *  4. Also upserts per-warehouse rows with key = "warehouse_stock_{id}" for
 *     fine-grained access.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type WarehouseStockRow = {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  estimatedStockValue: number;
  snapshotAt: string;
};

export async function GET(request: Request) {
  // Require cron secret — fail closed if not configured.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET env var is not configured" }, { status: 500 });
  }
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const snapshotAt = new Date().toISOString();

  // 1. Fetch all warehouses
  const { data: warehouses, error: whError } = await admin
    .from("warehouses")
    .select("id, name, code")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (whError) {
    return NextResponse.json({ error: whError.message }, { status: 500 });
  }

  if (!warehouses || warehouses.length === 0) {
    return NextResponse.json({ data: { warehouses: [], snapshotAt } });
  }

  // 2. Build per-warehouse stock snapshots
  const results: WarehouseStockRow[] = [];

  for (const wh of warehouses) {
    const { data: products, error: pError } = await admin
      .from("products")
      .select("stock, price, sale_price")
      .eq("warehouse_id", wh.id);

    if (pError) {
      console.error(`[warehouse-stock-sync] Error fetching products for ${wh.id}: ${pError.message}`);
      continue;
    }

    const rows = products ?? [];
    const totalProducts = rows.length;
    const totalStock = rows.reduce((sum, p) => sum + (p.stock ?? 0), 0);
    const lowStockCount = rows.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 10).length;
    const outOfStockCount = rows.filter((p) => (p.stock ?? 0) === 0).length;
    const estimatedStockValue = rows.reduce(
      (sum, p) => sum + (Number(p.sale_price ?? p.price) * (p.stock ?? 0)),
      0
    );

    const row: WarehouseStockRow = {
      warehouseId: wh.id as string,
      warehouseName: wh.name as string,
      warehouseCode: wh.code as string,
      totalProducts,
      totalStock,
      lowStockCount,
      outOfStockCount,
      estimatedStockValue: Math.round(estimatedStockValue * 100) / 100,
      snapshotAt,
    };

    results.push(row);

    // Upsert per-warehouse key
    await admin.from("settings").upsert(
      {
        key: `warehouse_stock_${wh.id}`,
        value: JSON.stringify(row),
        type: "json",
        group: "warehouse_stock",
      },
      { onConflict: "key" }
    );
  }

  // 3. Upsert global snapshot
  const globalSnapshot = { warehouses: results, snapshotAt };
  await admin.from("settings").upsert(
    {
      key: "warehouse_stock_snapshot",
      value: JSON.stringify(globalSnapshot),
      type: "json",
      group: "warehouse_stock",
    },
    { onConflict: "key" }
  );

  return NextResponse.json({
    data: {
      warehouses: results,
      snapshotAt,
      summary: {
        warehousesProcessed: results.length,
        totalProductsAcrossAll: results.reduce((s, r) => s + r.totalProducts, 0),
        totalStockUnitsAcrossAll: results.reduce((s, r) => s + r.totalStock, 0),
        totalStockValueAcrossAll: results.reduce((s, r) => s + r.estimatedStockValue, 0),
      },
    },
  });
}
