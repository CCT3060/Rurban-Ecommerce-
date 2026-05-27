"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Grid3X3,
  LayoutList,
  SlidersHorizontal,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import ProductCard from "@/components/product/product-card";
import { IMAGE_PLACEHOLDER } from "@/lib/constants";
import { formatCurrency, normalizeSupabaseImageUrl } from "@/lib/utils";
import type { Banner, Category, Product } from "@/types";

type RootCategoryNavItem = Omit<Category, "subcategories">;

type CategoryTreeNodeWithImage = Omit<Category, "subcategories"> & {
  _resolvedImage: string;
  subcategories: CategoryTreeNodeWithImage[];
};

interface CategoryPageContentProps {
  category: Category;
  rootCategories: RootCategoryNavItem[];
  subcategories: CategoryTreeNodeWithImage[];
  allProducts: Product[];
  banners: Banner[];
  initialSelectedCategoryId: string | null;
}

function parseSliderRange(
  value: number | readonly number[],
  fallbackMin: number,
): [number, number] {
  if (Array.isArray(value)) {
    const left = Number(value[0] ?? fallbackMin);
    const right = Number(value[1] ?? left);
    return [Math.min(left, right), Math.max(left, right)];
  }

  return [fallbackMin, Number(value)];
}

function getProductDiscountPercent(product: Product): number {
  const mrp = Number(product.price);
  const sellingPrice = Number(product.sale_price ?? product.price);

  if (!Number.isFinite(mrp) || mrp <= 0 || sellingPrice >= mrp) return 0;

  return Math.round(((mrp - sellingPrice) / mrp) * 100);
}

export default function CategoryPageContent({
  category,
  rootCategories,
  subcategories,
  allProducts,
  banners,
  initialSelectedCategoryId,
}: CategoryPageContentProps) {
  const [gridView, setGridView] = useState<"grid" | "list">("grid");
  const [includeOutOfStock, setIncludeOutOfStock] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    initialSelectedCategoryId ? [initialSelectedCategoryId] : [],
  );
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [discountRange, setDiscountRange] = useState<[number, number] | null>(
    null,
  );

  const categoryMetaById = useMemo(() => {
    const map = new Map<
      string,
      {
        node: CategoryTreeNodeWithImage;
        descendantIds: string[];
        depth: number;
      }
    >();

    const visit = (
      node: CategoryTreeNodeWithImage,
      depth: number,
    ): string[] => {
      const descendantIds = [
        node.id,
        ...node.subcategories.flatMap((child) => visit(child, depth + 1)),
      ];

      map.set(node.id, { node, descendantIds, depth });
      return descendantIds;
    };

    for (const node of subcategories) {
      visit(node, 0);
    }

    return map;
  }, [subcategories]);

  const categoryFilterOptions = useMemo(
    () => {
      const options: Array<{ id: string; name: string; depth: number }> = [];

      const visit = (nodes: CategoryTreeNodeWithImage[], depth: number) => {
        for (const node of nodes) {
          options.push({ id: node.id, name: node.name, depth });
          visit(node.subcategories, depth + 1);
        }
      };

      visit(subcategories, 0);
      return options;
    },
    [subcategories],
  );

  const selectedCategoryProductIds = useMemo(() => {
    if (selectedCategoryIds.length === 0) return null;

    const ids = new Set<string>();
    for (const categoryId of selectedCategoryIds) {
      for (const id of categoryMetaById.get(categoryId)?.descendantIds ?? [
        categoryId,
      ]) {
        ids.add(id);
      }
    }

    return ids;
  }, [categoryMetaById, selectedCategoryIds]);

  const categoryScopedProducts = useMemo(() => {
    if (!selectedCategoryProductIds) return allProducts;

    return allProducts.filter((product) =>
      selectedCategoryProductIds.has(product.category_id),
    );
  }, [allProducts, selectedCategoryProductIds]);

  const availableBrands = useMemo(() => {
    const values = new Set<string>();

    for (const product of categoryScopedProducts) {
      const brand = product.brand?.trim();
      if (brand) values.add(brand);
    }

    return [...values].sort((left, right) => left.localeCompare(right));
  }, [categoryScopedProducts]);

  const priceBounds = useMemo(() => {
    if (categoryScopedProducts.length === 0) return { min: 0, max: 0 };

    const prices = categoryScopedProducts.map((product) =>
      Number(product.sale_price ?? product.price),
    );

    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [categoryScopedProducts]);

  const effectiveSelectedBrands = useMemo(
    () => selectedBrands.filter((brand) => availableBrands.includes(brand)),
    [availableBrands, selectedBrands],
  );

  const effectivePriceRange = useMemo<[number, number]>(
    () => priceRange ?? [priceBounds.min, priceBounds.max],
    [priceBounds.max, priceBounds.min, priceRange],
  );

  const effectiveDiscountRange = useMemo<[number, number]>(
    () => discountRange ?? [0, 100],
    [discountRange],
  );

  const filteredProducts = useMemo(
    () =>
      categoryScopedProducts.filter((product) => {
        const sellingPrice = Number(product.sale_price ?? product.price);
        const discountPercent = getProductDiscountPercent(product);

        if (!includeOutOfStock && product.stock <= 0) return false;

        if (effectiveSelectedBrands.length > 0) {
          const brand = product.brand?.trim() ?? "";
          if (!effectiveSelectedBrands.includes(brand)) return false;
        }

        if (
          sellingPrice < effectivePriceRange[0] ||
          sellingPrice > effectivePriceRange[1]
        ) {
          return false;
        }

        if (
          discountPercent < effectiveDiscountRange[0] ||
          discountPercent > effectiveDiscountRange[1]
        ) {
          return false;
        }

        return true;
      }),
    [
      categoryScopedProducts,
      effectiveDiscountRange,
      effectivePriceRange,
      effectiveSelectedBrands,
      includeOutOfStock,
    ],
  );

  const selectedCategoryLabel =
    selectedCategoryIds.length === 1
      ? categoryMetaById.get(selectedCategoryIds[0])?.node.name ?? category.name
      : selectedCategoryIds.length > 1
        ? "Selected Categories"
        : category.name;

  const toggleCategoryFilter = (categoryId: string, checked: boolean) => {
    setSelectedCategoryIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(categoryId);
      } else {
        next.delete(categoryId);
      }
      return [...next];
    });
  };

  const toggleBrand = (brand: string, checked: boolean) => {
    setSelectedBrands((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(brand);
      } else {
        next.delete(brand);
      }
      return [...next];
    });
  };

  const resetFilters = () => {
    setIncludeOutOfStock(false);
    setSelectedBrands([]);
    setSelectedCategoryIds(
      initialSelectedCategoryId ? [initialSelectedCategoryId] : [],
    );
    setPriceRange(null);
    setDiscountRange(null);
  };

  const getBrandInputId = (brand: string) =>
    `brand-${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/categories" className="hover:text-primary">
              All Categories
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground">{category.name}</span>
          </div>
        </div>
      </div>

      {banners.length > 0 && (
        <section className="container mx-auto px-4 py-5 md:py-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4">
            {banners.map((banner) => (
              <Link
                key={banner.id}
                href={banner.cta_link?.trim() || "#"}
                className="group block w-full overflow-hidden rounded-[28px] border border-border/50 bg-white shadow-sm transition-shadow hover:shadow-lg"
              >
                <div className="relative aspect-[21/8] w-full overflow-hidden sm:aspect-[18/6] lg:aspect-[24/7]">
                  <Image
                    src={
                      normalizeSupabaseImageUrl(banner.image_url) ||
                      IMAGE_PLACEHOLDER
                    }
                    alt={banner.title || "Banner"}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(min-width: 1280px) 1152px, (min-width: 768px) 92vw, 100vw"
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <aside className="shrink-0 lg:w-[295px]">
            <div className="lg:sticky lg:top-24 lg:space-y-4">
              <div className="rounded-[22px] border border-border bg-white shadow-sm">
                <div className="border-b border-border px-4 py-3.5">
                  <h3 className="text-base font-bold text-foreground">Category</h3>
                </div>
                <div className="divide-y divide-border px-4">
                  {rootCategories.map((rootCategory) => {
                    const href = `/category/${encodeURIComponent(
                      rootCategory.slug || rootCategory.id,
                    )}`;
                    const isActive = rootCategory.id === category.id;

                    return (
                      <Link
                        key={rootCategory.id}
                        href={href}
                        className={`flex items-center justify-between gap-3 py-3 text-sm transition-colors ${
                          isActive
                            ? "font-semibold text-foreground"
                            : "text-foreground/80 hover:text-primary"
                        }`}
                      >
                        <span>{rootCategory.name}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[22px] border border-border bg-white p-4 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-foreground">
                  <SlidersHorizontal className="h-4 w-4" /> Filters
                </h3>

                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-foreground">
                      Availability
                    </p>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="availability"
                        checked={includeOutOfStock}
                        onCheckedChange={(checked) =>
                          setIncludeOutOfStock(checked === true)
                        }
                      />
                      <label
                        htmlFor="availability"
                        className="text-sm text-foreground"
                      >
                        Include out of stock
                      </label>
                    </div>
                  </div>

                  {categoryFilterOptions.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-foreground">
                        Categories
                      </p>
                      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                        {categoryFilterOptions.map((option) => {
                          const checked = selectedCategoryIds.includes(option.id);

                          return (
                            <div
                              key={option.id}
                              className="flex items-center gap-2"
                              style={{ marginLeft: option.depth * 10 }}
                            >
                              <Checkbox
                                id={`category-filter-${option.id}`}
                                checked={checked}
                                onCheckedChange={(next) =>
                                  toggleCategoryFilter(option.id, next === true)
                                }
                              />
                              <label
                                htmlFor={`category-filter-${option.id}`}
                                className="text-sm text-foreground"
                              >
                                {option.name}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {availableBrands.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-foreground">
                        Brands
                      </p>
                      <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                        {availableBrands.map((brand) => {
                          const inputId = getBrandInputId(brand);

                          return (
                            <div key={brand} className="flex items-center gap-2">
                              <Checkbox
                                id={inputId}
                                checked={effectiveSelectedBrands.includes(brand)}
                                onCheckedChange={(checked) =>
                                  toggleBrand(brand, checked === true)
                                }
                              />
                              <label
                                htmlFor={inputId}
                                className="text-sm text-foreground"
                              >
                                {brand}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Price</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(effectivePriceRange[0])} -{" "}
                        {formatCurrency(effectivePriceRange[1])}
                      </p>
                    </div>
                    <Slider
                      min={priceBounds.min}
                      max={priceBounds.max}
                      step={1}
                      value={effectivePriceRange}
                      onValueChange={(value) =>
                        setPriceRange(parseSliderRange(value, priceBounds.min))
                      }
                      disabled={priceBounds.max <= priceBounds.min}
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">
                        Discount
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {effectiveDiscountRange[0]}% - {effectiveDiscountRange[1]}%
                      </p>
                    </div>
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={effectiveDiscountRange}
                      onValueChange={(value) =>
                        setDiscountRange(parseSliderRange(value, 0))
                      }
                    />
                  </div>

                  <button
                    type="button"
                    onClick={resetFilters}
                    className="w-full rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-foreground md:text-xl">
                  {selectedCategoryLabel}
                </h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {filteredProducts.length} product
                  {filteredProducts.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="hidden rounded-md border sm:flex">
                <button
                  onClick={() => setGridView("grid")}
                  className={`flex h-9 w-9 items-center justify-center rounded-l-md transition-colors ${
                    gridView === "grid"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setGridView("list")}
                  className={`flex h-9 w-9 items-center justify-center rounded-r-md transition-colors ${
                    gridView === "list"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <LayoutList className="h-4 w-4" />
                </button>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-xl border bg-muted/10 py-16 text-center">
                <p className="text-lg font-semibold">No products found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try changing filters or selecting a different category.
                </p>
                <button
                  onClick={resetFilters}
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Reset and View All
                </button>
              </div>
            ) : (
              <div
                className={`grid gap-3 md:gap-4 ${
                  gridView === "grid"
                    ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    : "grid-cols-1"
                }`}
              >
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} compact />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
