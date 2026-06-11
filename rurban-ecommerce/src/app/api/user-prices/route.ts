import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/user-prices
// Returns a map of { productId: customPrice } for the logged-in user.
// Only returns active custom prices.
// Optionally filter by ?productId=xxx (single product lookup).
export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId") ?? "";

  const admin = createAdminClient();

  let query = admin
    .from("user_product_prices")
    .select("product_id, custom_price, start_date, end_date")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (productId) {
    query = query.eq("product_id", productId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Filter to prices whose date range is currently active
  const today = new Date().toISOString().split("T")[0];
  const activePrices = (data ?? []).filter((row) => {
    const startOk = !row.start_date || row.start_date <= today;
    const endOk = !row.end_date || row.end_date >= today;
    return startOk && endOk;
  });

  // Return as a flat map: { [productId]: customPrice }
  const priceMap: Record<string, number> = {};
  for (const row of activePrices) {
    priceMap[row.product_id as string] = Number(row.custom_price);
  }

  return NextResponse.json({ data: priceMap });
}
