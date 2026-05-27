import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const { data: relatedData, error: relatedError } = await admin
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("status", "active")
    .eq("category_id", data.category_id)
    .neq("id", data.id)
    .limit(8);

  if (relatedError) {
    return NextResponse.json({ error: relatedError.message }, { status: 400 });
  }

  return NextResponse.json({ data, related: relatedData ?? [] });
}
