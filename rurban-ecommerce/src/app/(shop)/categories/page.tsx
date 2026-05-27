import { unstable_noStore as noStore } from "next/cache";
import CategoriesBrowserContent from "./categories-browser-content";
import { IMAGE_PLACEHOLDER } from "@/lib/constants";
import {
  buildCategoryTree,
  type CategoryTreeNode,
} from "@/lib/category-tree";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSupabaseImageUrl } from "@/lib/utils";
import type { Category } from "@/types";

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

async function getCategoriesPageData() {
  const admin = createAdminClient();

  const { data: categoriesRaw } = await admin
    .from("categories")
    .select("*")
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  return attachResolvedImages(
    buildCategoryTree((categoriesRaw ?? []) as Category[]),
  );
}

export default async function CategoriesPage() {
  noStore();

  const categories = await getCategoriesPageData();

  return <CategoriesBrowserContent categories={categories} />;
}
