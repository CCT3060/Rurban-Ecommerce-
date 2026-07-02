import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminContext } from "@/lib/auth/request-context";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";

  const admin = createAdminClient();

  // Paginate through all products for this warehouse
  const PAGE = 1000;
  let page = 0;
  const all: unknown[] = [];

  while (true) {
    let query = admin
      .from("products")
      .select(
        "id, name, sku, stock, price, sale_price, status, category:categories(id, name), images:product_images(image_url, is_primary)",
        { count: "exact" }
      )
      .eq("warehouse_id", id)
      .order("name", { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    page++;
  }

  // Compute summary stats
  const products = all as Array<{
    id: string;
    name: string;
    sku: string | null;
    stock: number;
    price: number;
    sale_price: number | null;
    status: string;
    category: { id: string; name: string } | null;
    images: Array<{ image_url: string; is_primary: boolean }>;
  }>;

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + (p.stock ?? 0), 0);
  const lowStockCount = products.filter((p) => p.stock <= 10 && p.stock > 0).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;
  const totalStockValue = products.reduce(
    (sum, p) => sum + (p.sale_price ?? p.price) * (p.stock ?? 0),
    0
  );

  return NextResponse.json({
    data: products,
    summary: {
      totalProducts,
      totalStock,
      lowStockCount,
      outOfStockCount,
      totalStockValue,
    },
  });
}
