import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

// GET /api/mobile/all-products
// Returns ALL active products grouped by category.
// If the authenticated user has a custom price for a product, that price is shown instead.
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

  // Fetch all active products with their category and images
  // Fetch ALL active products using range pagination to bypass the default 1000-row limit
  const PAGE = 1000;
  let allProducts: any[] = [];
  let from = 0;
  while (true) {
    const { data: page, error: productsError } = await admin
      .from("products")
      .select(
        `id, name, slug, price, sale_price, stock, status, sku, brand,
         avg_rating, review_count, category_id,
         category:categories!category_id(id, name, slug),
         images:product_images(image_url, is_primary)`
      )
      .eq("status", "active")
      .order("name")
      .range(from, from + PAGE - 1);

    if (productsError) {
      return NextResponse.json({ error: productsError.message }, { status: 400 });
    }
    if (!page || page.length === 0) break;
    allProducts = allProducts.concat(page);
    if (page.length < PAGE) break;
    from += PAGE;
  }

  // Fetch custom prices for this user (to overlay on top of regular prices)
  const { data: userPrices } = await admin
    .from("user_product_prices")
    .select("product_id, custom_price, start_date, end_date")
    .eq("user_id", user.id)
    .eq("status", "active");

  // Build a map of active custom prices keyed by product_id
  const customPriceMap = new Map<string, number>();
  for (const row of (userPrices ?? [])) {
    const startOk = !row.start_date || row.start_date <= today;
    const endOk = !row.end_date || row.end_date >= today;
    if (startOk && endOk) {
      customPriceMap.set(row.product_id, Number(row.custom_price));
    }
  }

  // Group by category
  type ProductEntry = {
    id: string;
    name: string;
    slug: string;
    price: number;
    sale_price: number | null;
    custom_price: number | null;
    stock: number;
    sku: string | null;
    brand: string | null;
    avg_rating: number;
    review_count: number;
    image_url: string | null;
    has_custom_price: boolean;
  };
  const catMap = new Map<
    string,
    { id: string; name: string; slug: string; products: ProductEntry[] }
  >();

  for (const p of allProducts as any[]) {
    const cat = p.category;
    if (!cat) continue;

    if (!catMap.has(cat.id)) {
      catMap.set(cat.id, { id: cat.id, name: cat.name, slug: cat.slug, products: [] });
    }

    const primaryImage =
      p.images?.find((img: any) => img.is_primary)?.image_url ??
      p.images?.[0]?.image_url ??
      null;

    const customPrice = customPriceMap.get(p.id) ?? null;

    catMap.get(cat.id)!.products.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      sale_price: customPrice ?? (p.sale_price ? Number(p.sale_price) : null),
      custom_price: customPrice,
      stock: Number(p.stock),
      sku: p.sku ?? null,
      brand: p.brand ?? null,
      avg_rating: Number(p.avg_rating ?? 0),
      review_count: Number(p.review_count ?? 0),
      image_url: primaryImage,
      has_custom_price: customPrice !== null,
    });
  }

  const categories = Array.from(catMap.values());

  return NextResponse.json({ data: categories });
}
