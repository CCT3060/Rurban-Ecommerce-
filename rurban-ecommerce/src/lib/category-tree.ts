import type { Category } from "@/types";

export type CategoryTreeNode = Omit<Category, "subcategories"> & {
  subcategories: CategoryTreeNode[];
};

export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const childrenByParentId = new Map<string | null, Category[]>();

  for (const category of categories) {
    const siblings = childrenByParentId.get(category.parent_id) ?? [];
    siblings.push(category);
    childrenByParentId.set(category.parent_id, siblings);
  }

  const buildNode = (category: Category): CategoryTreeNode => ({
    ...category,
    subcategories: (childrenByParentId.get(category.id) ?? []).map(buildNode),
  });

  return (childrenByParentId.get(null) ?? []).map(buildNode);
}

export function findCategoryPathBySlug(
  nodes: CategoryTreeNode[],
  slug: string,
): CategoryTreeNode[] | null {
  for (const node of nodes) {
    if (node.slug === slug) return [node];

    const nestedPath = findCategoryPathBySlug(node.subcategories, slug);
    if (nestedPath) return [node, ...nestedPath];
  }

  return null;
}

export function collectCategoryIds(node: CategoryTreeNode): string[] {
  return [node.id, ...node.subcategories.flatMap(collectCategoryIds)];
}

export function flattenCategoryTree(
  nodes: CategoryTreeNode[],
  depth = 0,
): Array<{ node: CategoryTreeNode; depth: number }> {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenCategoryTree(node.subcategories, depth + 1),
  ]);
}
