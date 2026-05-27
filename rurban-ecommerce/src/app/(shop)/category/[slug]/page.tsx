import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import CategoryPageContent from "./category-page-content";
import { IMAGE_PLACEHOLDER } from "@/lib/constants";
import {
  buildCategoryTree,
  collectCategoryIds,
  findCategoryPathBySlug,
  type CategoryTreeNode,
} from "@/lib/category-tree";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSupabaseImageUrl } from "@/lib/utils";
import type { Banner, Category, Product } from "@/types";

type CategoryTreeNodeWithImage = CategoryTreeNode & {
  _resolvedImage: string;
  subcategories: CategoryTreeNodeWithImage[];
};

function attachResolvedImages(
  nodes: CategoryTreeNode[],
): CategoryTreeNodeWithImage[] {
  return nodes.map((node) => ({
    ...node,
    _resolvedImage: normalizeSupabaseImageUrl(node.image_url) || IMAGE_PLACEHOLDER,
    subcategories: attachResolvedImages(node.subcategories),
  }));
}

async function getCategoryData(slug: string) {
  const supabase = createAdminClient();

  const [{ data: categoriesRaw }, { data: bannersRaw }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("status", "active")
      .order("sort_order", { ascending: true }),
    supabase
      .from("banners")
      .select("*")
      .eq("status", "active")
      .eq("section", "category")
      .order("sort_order", { ascending: true }),
  ]);

  const categoryTree = buildCategoryTree((categoriesRaw ?? []) as Category[]);
  const categoryPath = findCategoryPathBySlug(categoryTree, slug);

  if (!categoryPath) return null;

  const rootCategory = categoryPath[0];
  const matchedCategory = categoryPath[categoryPath.length - 1];
  const allCategoryIds = collectCategoryIds(rootCategory);

  const { data: allProductsRaw } = await supabase
    .from("products")
    .select("*, category:categories(*), images:product_images(*)")
    .eq("status", "active")
    .in("category_id", allCategoryIds)
    .order("created_at", { ascending: false });

  return {
    category: rootCategory,
    rootCategories: categoryTree.map((node) => ({
      id: node.id,
      name: node.name,
      slug: node.slug,
      description: node.description,
      image_url: node.image_url,
      banner_url: node.banner_url,
      parent_id: node.parent_id,
      warehouse_id: node.warehouse_id,
      status: node.status,
      sort_order: node.sort_order,
      created_at: node.created_at,
      updated_at: node.updated_at,
      parent: node.parent,
      product_count: node.product_count,
    })),
    subcategories: rootCategory.subcategories,
    allProducts: (allProductsRaw ?? []) as Product[],
    banners: (bannersRaw ?? []) as Banner[],
    initialSelectedCategoryId:
      matchedCategory.id === rootCategory.id ? null : matchedCategory.id,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  noStore();

  const { slug } = await params;
  const data = await getCategoryData(slug);

  if (!data) notFound();

  return (
    <CategoryPageContent
      category={data.category}
      rootCategories={data.rootCategories}
      subcategories={attachResolvedImages(data.subcategories)}
      allProducts={data.allProducts}
      banners={data.banners}
      initialSelectedCategoryId={data.initialSelectedCategoryId}
    />
  );
}
