import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category, Product } from "@/types";
import SectionPageContent from "./section-page-content";

type SectionKey =
  | "all-products"
  | "featured-products"
  | "trending-products"
  | "new-arrivals"
  | "most-popular-products";

const SECTION_META: Record<
  SectionKey,
  {
    title: string;
    subtitle: string;
  }
> = {
  "all-products": {
    title: "All Products",
    subtitle: "Browse all available products",
  },
  "featured-products": {
    title: "Featured Products",
    subtitle: "Products marked as featured by admin",
  },
  "trending-products": {
    title: "Trending Products",
    subtitle: "Products marked as trending by admin",
  },
  "new-arrivals": {
    title: "New Arrivals",
    subtitle: "Latest products marked as new arrival by admin",
  },
  "most-popular-products": {
    title: "Most Popular Products",
    subtitle: "Products ordered the most by customers",
  },
};

function parseSectionKey(value: string): SectionKey | null {
  if (value in SECTION_META) return value as SectionKey;
  return null;
}

async function getMostPopularProducts(admin: ReturnType<typeof createAdminClient>) {
  const { data: orderItemsData } = await admin
    .from("order_items")
    .select("product_id, quantity")
    .not("product_id", "is", null);

  const qtyByProductId = new Map<string, number>();

  for (const row of
    (orderItemsData ?? []) as Array<{ product_id: string | null; quantity: number | null }>) {
    if (!row.product_id) continue;
    const quantity = Number(row.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    qtyByProductId.set(row.product_id, (qtyByProductId.get(row.product_id) ?? 0) + quantity);
  }

  const rankedPopularIds = [...qtyByProductId.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  if (rankedPopularIds.length === 0) return [];

  const popularIdsForQuery = rankedPopularIds.slice(0, 300);
  const { data: productsData } = await admin
    .from("products")
    .select("*, category:categories(*), images:product_images(*)")
    .eq("status", "active")
    .in("id", popularIdsForQuery);

  const productsById = new Map(((productsData ?? []) as Product[]).map((item) => [item.id, item]));

  return popularIdsForQuery
    .map((id) => productsById.get(id))
    .filter((item): item is Product => Boolean(item));
}

async function getSectionData(sectionKey: SectionKey) {
  const admin = createAdminClient();

  const [parentsRes, subcategoriesRes] = await Promise.all([
    admin
      .from("categories")
      .select("*")
      .eq("status", "active")
      .is("parent_id", null)
      .order("sort_order", { ascending: true }),
    admin
      .from("categories")
      .select("*")
      .eq("status", "active")
      .not("parent_id", "is", null)
      .order("sort_order", { ascending: true }),
  ]);

  const parentCategories = (parentsRes.data ?? []) as Category[];
  const subcategories = (subcategoriesRes.data ?? []) as Category[];

  let products: Product[] = [];

  if (sectionKey === "most-popular-products") {
    products = await getMostPopularProducts(admin);
  } else {
    let query = admin
      .from("products")
      .select("*, category:categories(*), images:product_images(*)")
      .eq("status", "active")
      .limit(300);

    if (sectionKey === "featured-products") {
      query = query.eq("is_featured", true).order("updated_at", { ascending: false });
    } else if (sectionKey === "trending-products") {
      query = query.eq("is_trending", true).order("updated_at", { ascending: false });
    } else if (sectionKey === "new-arrivals") {
      query = query.eq("is_new_arrival", true).order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data } = await query;
    products = (data ?? []) as Product[];
  }

  const parentCategoriesWithSubs = parentCategories.map((parent) => ({
    ...parent,
    subcategories: subcategories.filter((sub) => sub.parent_id === parent.id),
  }));

  return {
    products,
    parentCategoriesWithSubs,
  };
}

export default async function SectionProductsPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  noStore();
  const { section } = await params;
  const sectionKey = parseSectionKey(section);
  if (!sectionKey) notFound();

  const meta = SECTION_META[sectionKey];
  const data = await getSectionData(sectionKey);

  return (
    <SectionPageContent
      title={meta.title}
      subtitle={meta.subtitle}
      products={data.products}
      parentCategories={data.parentCategoriesWithSubs}
    />
  );
}

