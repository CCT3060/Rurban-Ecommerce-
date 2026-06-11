import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";
import { generateSlug } from "@/lib/constants";
import { normalizeSupabaseImageUrl } from "@/lib/utils";

interface CreateProductBody {
  name?: string;
  slug?: string;
  description?: string | null;
  short_description?: string | null;
  price?: number;
  sale_price?: number | null;
  sku?: string | null;
  stock?: number;
  brand?: string | null;
  tags?: string[];
  category_id?: string | null;
  status?: "active" | "inactive" | "draft";
  is_featured?: boolean;
  is_trending?: boolean;
  is_new_arrival?: boolean;
  image_url?: string | null;
  variants?: Array<{
    name?: string;
    type?: string;
    value?: string;
    price_modifier?: number;
    stock?: number;
    sku?: string | null;
  }>;
}

export async function GET() {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  // Paginate through all rows — Supabase caps a single .select() at 1000 rows.
  // Use a secondary sort on `id` to guarantee a stable order across pages.
  const PAGE = 1000;
  let page = 0;
  const seen = new Set<string>();
  const all: unknown[] = [];

  while (true) {
    const { data, error } = await admin
      .from("products")
      .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
      .or(`warehouse_id.eq.${auth.context.warehouseId},warehouse_id.is.null`)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    for (const row of data ?? []) {
      const id = (row as { id: string }).id;
      if (!seen.has(id)) { seen.add(id); all.push(row); }
    }
    if ((data ?? []).length < PAGE) break;
    page++;
  }

  return NextResponse.json({ data: all });
}

export async function POST(request: Request) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as CreateProductBody;
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 });

  const price = Number(body.price ?? 0);
  const stock = Number(body.stock ?? 0);
  if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  if (!Number.isFinite(stock) || stock < 0) return NextResponse.json({ error: "Invalid stock" }, { status: 400 });

  const admin = createAdminClient();
  const payload = {
    name,
    slug: (body.slug?.trim() || generateSlug(name)).toLowerCase(),
    description: body.description?.trim() || null,
    short_description: body.short_description?.trim() || null,
    price,
    sale_price: body.sale_price === null || body.sale_price === undefined || body.sale_price === 0 ? null : Number(body.sale_price),
    sku: body.sku?.trim() || null,
    stock,
    brand: body.brand?.trim() || null,
    tags: Array.isArray(body.tags) ? body.tags : [],
    category_id: body.category_id || null,
    status: body.status ?? "active",
    is_featured: Boolean(body.is_featured),
    is_trending: Boolean(body.is_trending),
    is_new_arrival: Boolean(body.is_new_arrival),
    warehouse_id: auth.context.warehouseId,
  };

  const { data: created, error } = await admin
    .from("products")
    .insert(payload)
    .select("*")
    .single();

  if (error || !created) return NextResponse.json({ error: error?.message || "Failed to create product" }, { status: 400 });

  if (body.image_url) {
    const { error: imageError } = await admin.from("product_images").insert({
      product_id: created.id,
      image_url: normalizeSupabaseImageUrl(body.image_url),
      is_primary: true,
      sort_order: 0,
    });
    if (imageError) return NextResponse.json({ error: imageError.message }, { status: 400 });
  }

  const variants = (body.variants ?? [])
    .map((variant) => ({
      product_id: created.id,
      name: variant.name?.trim() || "",
      type: variant.type?.trim() || "",
      value: variant.value?.trim() || "",
      price_modifier: Number(variant.price_modifier ?? 0),
      stock: Number(variant.stock ?? 0),
      sku: variant.sku?.trim() || null,
    }))
    .filter((variant) => variant.name && variant.type && variant.value);

  if (variants.length > 0) {
    const { error: variantError } = await admin.from("product_variants").insert(variants);
    if (variantError) return NextResponse.json({ error: variantError.message }, { status: 400 });
  }

  const { data: fullProduct, error: fetchError } = await admin
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("id", created.id)
    .single();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });
  return NextResponse.json({ data: fullProduct }, { status: 201 });
}
