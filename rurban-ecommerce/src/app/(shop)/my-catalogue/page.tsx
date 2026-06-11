import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product } from "@/types";
import MyCatalogueContent from "./my-catalogue-content";

type PriceRecord = {
  custom_price: number;
  start_date: string | null;
  end_date: string | null;
  product: (Product & {
    category: { id: string; name: string; slug: string } | null;
    images: { image_url: string; is_primary: boolean }[];
    variants: unknown[];
  }) | null;
};

type CategoryGroup = {
  id: string;
  name: string;
  slug: string;
  products: (Product & { custom_price: number })[];
};

export default async function MyCataloguePage() {
  noStore();

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/my-catalogue");
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

  const { data: rows } = await admin
    .from("user_product_prices")
    .select(
      `custom_price, start_date, end_date,
       product:products!product_id(
         id, name, slug, description, price, sale_price, stock, status,
         is_featured, is_trending, is_new_arrival, sku, category_id,
         category:categories!category_id(id, name, slug),
         images:product_images(image_url, is_primary),
         variants:product_variants(*)
       )`
    )
    .eq("user_id", user.id)
    .eq("status", "active");

  // Filter by active date range in JS (handles nulls cleanly)
  const active = ((rows ?? []) as PriceRecord[]).filter((r) => {
    if (!r.product || r.product.status !== "active") return false;
    const startOk = !r.start_date || r.start_date <= today;
    const endOk = !r.end_date || r.end_date >= today;
    return startOk && endOk;
  });

  // Group by category
  const catMap = new Map<string, CategoryGroup>();
  for (const r of active) {
    const cat = r.product!.category;
    if (!cat) continue;
    if (!catMap.has(cat.id)) {
      catMap.set(cat.id, { id: cat.id, name: cat.name, slug: cat.slug, products: [] });
    }
    catMap.get(cat.id)!.products.push({
      ...(r.product as unknown as Product),
      // Override displayed price with the custom price
      sale_price: r.custom_price,
      custom_price: r.custom_price,
    } as Product & { custom_price: number });
  }

  const categories = Array.from(catMap.values());

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="font-medium text-foreground">My Catalogue</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            My Catalogue
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Products available to you at your special prices.
          </p>
        </div>

        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No products assigned yet.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your warehouse manager will assign products once available.
            </p>
            <Link
              href="/"
              className="mt-6 text-sm font-medium text-primary underline underline-offset-4"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <MyCatalogueContent categories={categories} />
        )}
      </div>
    </div>
  );
}
