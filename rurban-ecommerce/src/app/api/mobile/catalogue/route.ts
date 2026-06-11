import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

type PriceRow = {
  custom_price: number;
  start_date: string | null;
  end_date: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    sale_price: number | null;
    stock: number;
    status: string;
    sku: string | null;
    brand: string | null;
    avg_rating: number;
    review_count: number;
    category_id: string;
    category: { id: string; name: string; slug: string } | null;
    images: { image_url: string; is_primary: boolean }[];
  } | null;
};

export type CatalogueCategory = {
  id: string;
  name: string;
  slug: string;
  products: Array<{
    id: string;
    name: string;
    slug: string;
    price: number;
    sale_price: number;
    custom_price: number;
    stock: number;
    sku: string | null;
    brand: string | null;
    avg_rating: number;
    review_count: number;
    image_url: string | null;
  }>;
};

// GET /api/mobile/catalogue
// Returns the B2B product catalogue for the authenticated user,
// grouped by category with custom prices applied.
export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: rows, error } = await admin
    .from("user_product_prices")
    .select(
      `custom_price, start_date, end_date,
       product:products!product_id(
         id, name, slug, price, sale_price, stock, status, sku, brand,
         avg_rating, review_count, category_id,
         category:categories!category_id(id, name, slug),
         images:product_images(image_url, is_primary)
       )`
    )
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Filter active date range and active products
  const active = ((rows ?? []) as PriceRow[]).filter((r) => {
    if (!r.product || r.product.status !== "active") return false;
    const startOk = !r.start_date || r.start_date <= today;
    const endOk = !r.end_date || r.end_date >= today;
    return startOk && endOk;
  });

  // Group by category
  const catMap = new Map<
    string,
    { id: string; name: string; slug: string; products: CatalogueCategory["products"] }
  >();

  for (const r of active) {
    const p = r.product!;
    const cat = p.category;
    if (!cat) continue;

    if (!catMap.has(cat.id)) {
      catMap.set(cat.id, { id: cat.id, name: cat.name, slug: cat.slug, products: [] });
    }

    const primaryImage =
      p.images?.find((img) => img.is_primary)?.image_url ?? p.images?.[0]?.image_url ?? null;

    catMap.get(cat.id)!.products.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      sale_price: r.custom_price,
      custom_price: r.custom_price,
      stock: Number(p.stock),
      sku: p.sku ?? null,
      brand: p.brand ?? null,
      avg_rating: Number(p.avg_rating ?? 0),
      review_count: Number(p.review_count ?? 0),
      image_url: primaryImage,
    });
  }

  const categories = Array.from(catMap.values());

  return NextResponse.json({ data: categories });
}
