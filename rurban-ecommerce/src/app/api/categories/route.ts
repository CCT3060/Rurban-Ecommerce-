import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data: categories, error } = await admin
    .from("categories")
    .select("*")
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Count by zoho_category_name so it matches the Zoho-sourced Products page
  const { data: productRows, error: productError } = await admin
    .from("products")
    .select("category_id, zoho_category_name")
    .eq("status", "active")
    .not("zoho_item_id", "is", null);

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 400 });
  }

  // Build category name → count (for Zoho-synced products that have zoho_category_name)
  const nameCount = new Map<string, number>();
  // Also keep a direct category_id count as fallback for non-Zoho products
  const idCount = new Map<string, number>();
  for (const row of productRows ?? []) {
    const name = String(row.zoho_category_name ?? "").trim().toLowerCase();
    if (name) nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
    const id = row.category_id as string | null;
    if (id && !name) idCount.set(id, (idCount.get(id) ?? 0) + 1);
  }

  const data = (categories ?? []).map((category) => {
    const byName = nameCount.get(String(category.name ?? "").trim().toLowerCase()) ?? 0;
    const byId = idCount.get(category.id as string) ?? 0;
    return {
      ...category,
      product_count: byName + byId,
    };
  });

  return NextResponse.json({ data });
}
