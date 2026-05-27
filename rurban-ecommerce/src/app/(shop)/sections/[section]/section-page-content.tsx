"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Grid3X3, LayoutList, SlidersHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import ProductCard from "@/components/product/product-card";
import { formatCurrency } from "@/lib/utils";
import type { Category, Product } from "@/types";

type ParentCategoryWithSubs = Category & {
  subcategories: Category[];
};

interface SectionPageContentProps {
  title: string;
  subtitle: string;
  products: Product[];
  parentCategories: ParentCategoryWithSubs[];
}

function parseSliderRange(value: number | readonly number[], fallbackMin: number): [number, number] {
  if (Array.isArray(value)) {
    const left = Number(value[0] ?? fallbackMin);
    const right = Number(value[1] ?? left);
    return [Math.min(left, right), Math.max(left, right)];
  }
  return [fallbackMin, Number(value)];
}

export default function SectionPageContent({
  title,
  subtitle,
  products,
  parentCategories,
}: SectionPageContentProps) {
  const [gridView, setGridView] = useState<"grid" | "list">("grid");
  const [includeOutOfStock, setIncludeOutOfStock] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);

  const countByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      const categoryId = product.category_id;
      if (!categoryId) continue;
      map.set(categoryId, (map.get(categoryId) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const categoryFilteredProducts = useMemo(() => {
    if (selectedCategoryIds.length === 0) return products;
    const selected = new Set(selectedCategoryIds);
    return products.filter((product) => selected.has(product.category_id));
  }, [products, selectedCategoryIds]);

  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    for (const product of categoryFilteredProducts) {
      const brand = product.brand?.trim();
      if (brand) brands.add(brand);
    }
    return [...brands].sort((a, b) => a.localeCompare(b));
  }, [categoryFilteredProducts]);

  const priceBounds = useMemo(() => {
    if (categoryFilteredProducts.length === 0) return { min: 0, max: 0 };
    const prices = categoryFilteredProducts.map((product) =>
      Number(product.sale_price ?? product.price),
    );
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [categoryFilteredProducts]);

  const effectiveSelectedBrands = useMemo(
    () => selectedBrands.filter((brand) => availableBrands.includes(brand)),
    [availableBrands, selectedBrands],
  );

  const effectivePriceRange = useMemo<[number, number]>(
    () => priceRange ?? [priceBounds.min, priceBounds.max],
    [priceBounds.max, priceBounds.min, priceRange],
  );

  const filteredProducts = useMemo(
    () =>
      categoryFilteredProducts.filter((product) => {
        const sellingPrice = Number(product.sale_price ?? product.price);
        if (!includeOutOfStock && product.stock <= 0) return false;

        if (effectiveSelectedBrands.length > 0) {
          const brand = product.brand?.trim() ?? "";
          if (!effectiveSelectedBrands.includes(brand)) return false;
        }

        if (sellingPrice < effectivePriceRange[0] || sellingPrice > effectivePriceRange[1]) {
          return false;
        }

        return true;
      }),
    [
      categoryFilteredProducts,
      includeOutOfStock,
      effectiveSelectedBrands,
      effectivePriceRange,
    ],
  );

  const toggleBrand = (brand: string, checked: boolean) => {
    setSelectedBrands((current) =>
      checked ? [...current, brand] : current.filter((value) => value !== brand),
    );
  };

  const toggleCategory = (categoryId: string, checked: boolean) => {
    setSelectedCategoryIds((current) => {
      const set = new Set(current);
      if (checked) {
        set.add(categoryId);
      } else {
        set.delete(categoryId);
      }
      return [...set];
    });
  };

  const toggleCategoryGroup = (categoryIds: string[], checked: boolean) => {
    setSelectedCategoryIds((current) => {
      const set = new Set(current);
      for (const id of categoryIds) {
        if (checked) {
          set.add(id);
        } else {
          set.delete(id);
        }
      }
      return [...set];
    });
  };

  const resetFilters = () => {
    setIncludeOutOfStock(false);
    setSelectedBrands([]);
    setSelectedCategoryIds([]);
    setPriceRange(null);
  };

  const getBrandInputId = (brand: string) =>
    `section-brand-${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground">{title}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <aside className="shrink-0 lg:w-72">
            <div className="rounded-2xl border bg-white p-4">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </h3>

              <div className="space-y-6">
                <div>
                  <p className="mb-2 text-sm font-semibold">Availability</p>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="section-availability"
                      checked={includeOutOfStock}
                      onCheckedChange={(checked) => setIncludeOutOfStock(checked === true)}
                    />
                    <label htmlFor="section-availability" className="text-sm text-foreground">
                      Include Out of Stock
                    </label>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold">Categories</p>
                  <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="section-cat-all"
                          checked={selectedCategoryIds.length === 0}
                          onCheckedChange={() => setSelectedCategoryIds([])}
                        />
                        <label htmlFor="section-cat-all" className="text-sm font-medium">
                          All Products ({products.length})
                        </label>
                      </div>
                    </div>

                    {parentCategories.map((parent) => {
                      const childIds = parent.subcategories.map((sub) => sub.id);
                      const groupedIds = [parent.id, ...childIds];
                      const groupCount = groupedIds.reduce(
                        (sum, id) => sum + (countByCategoryId.get(id) ?? 0),
                        0,
                      );
                      const isGroupChecked =
                        groupedIds.length > 0 &&
                        groupedIds.every((id) => selectedCategoryIds.includes(id));

                      return (
                        <div
                          key={parent.id}
                          className="rounded-lg border border-border/60 bg-white p-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`parent-${parent.id}`}
                              checked={isGroupChecked}
                              onCheckedChange={(checked) =>
                                toggleCategoryGroup(groupedIds, checked === true)
                              }
                            />
                            <label
                              htmlFor={`parent-${parent.id}`}
                              className="flex-1 text-sm font-semibold"
                            >
                              {parent.name}
                            </label>
                            <span className="text-xs text-muted-foreground">{groupCount}</span>
                          </div>

                          {parent.subcategories.length > 0 && (
                            <div className="mt-2 space-y-1.5 pl-6">
                              {parent.subcategories.map((sub) => {
                                const count = countByCategoryId.get(sub.id) ?? 0;
                                const checked = selectedCategoryIds.includes(sub.id);
                                return (
                                  <div key={sub.id} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`sub-${sub.id}`}
                                      checked={checked}
                                      onCheckedChange={(next) =>
                                        toggleCategory(sub.id, next === true)
                                      }
                                    />
                                    <label htmlFor={`sub-${sub.id}`} className="flex-1 text-sm">
                                      {sub.name}
                                    </label>
                                    <span className="text-xs text-muted-foreground">{count}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {availableBrands.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-semibold">Brand</p>
                    <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                      {availableBrands.map((brand) => {
                        const inputId = getBrandInputId(brand);
                        return (
                          <div key={brand} className="flex items-center gap-2">
                            <Checkbox
                              id={inputId}
                              checked={effectiveSelectedBrands.includes(brand)}
                              onCheckedChange={(checked) => toggleBrand(brand, checked === true)}
                            />
                            <label htmlFor={inputId} className="text-sm text-foreground">
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
                    <p className="text-sm font-semibold">Price</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(effectivePriceRange[0])} - {formatCurrency(effectivePriceRange[1])}
                    </p>
                  </div>
                  <Slider
                    min={priceBounds.min}
                    max={priceBounds.max}
                    step={1}
                    value={effectivePriceRange}
                    onValueChange={(value) => {
                      setPriceRange(parseSliderRange(value, priceBounds.min));
                    }}
                    disabled={priceBounds.max <= priceBounds.min}
                  />
                </div>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Products</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
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
                  Try changing your filters.
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

