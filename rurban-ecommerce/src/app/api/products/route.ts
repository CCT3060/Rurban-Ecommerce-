import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids");

  const admin = createAdminClient();
  let query = admin
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (ids) {
    const list = ids
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (list.length > 0) {
      query = query.in("id", list);
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}
