/**
 * GET /api/admin/zoho/product-by-item?zoho_item_id=xxx
 *
 * Looks up the Supabase product row that was synced from a given Zoho item ID.
 * Returns full product data including images and category.
 */
import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const zohoItemId = searchParams.get("zoho_item_id");

  if (!zohoItemId) {
    return NextResponse.json({ error: "zoho_item_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select("*, category:categories(*), images:product_images(*)")
    .eq("zoho_item_id", zohoItemId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ data: null, message: "Product not yet synced to database" });
  }

  return NextResponse.json({ data });
}
