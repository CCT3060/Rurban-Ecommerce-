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

  const { data: productRows, error: productError } = await admin
    .from("products")
    .select("category_id")
    .eq("status", "active")
    .not("category_id", "is", null);

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 400 });
  }

  const counts = new Map<string, number>();
  for (const row of productRows ?? []) {
    const id = row.category_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const data = (categories ?? []).map((category) => ({
    ...category,
    product_count: counts.get(category.id) ?? 0,
  }));

  return NextResponse.json({ data });
}
