"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Category } from "@/types";

type CategoryTreeNodeWithImage = Omit<Category, "subcategories"> & {
  _resolvedImage: string;
  subcategories: CategoryTreeNodeWithImage[];
};

interface CategoriesBrowserContentProps {
  categories: CategoryTreeNodeWithImage[];
}

export default function CategoriesBrowserContent({
  categories,
}: CategoriesBrowserContentProps) {
  const [activeParentId, setActiveParentId] = useState<string | null>(
    categories[0]?.id ?? null,
  );
  const [openSubcategoryIds, setOpenSubcategoryIds] = useState<string[]>([]);

  const activeParent = useMemo(
    () =>
      categories.find((category) => category.id === activeParentId) ??
      categories[0] ??
      null,
    [activeParentId, categories],
  );

  const toggleSubcategory = (subcategoryId: string) => {
    setOpenSubcategoryIds((current) =>
      current.includes(subcategoryId)
        ? current.filter((value) => value !== subcategoryId)
        : [...current, subcategoryId],
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground">All Categories</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            All Categories
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse every department and jump into the category you want.
          </p>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <aside className="shrink-0 lg:w-[148px]">
            <div className="hide-scrollbar flex gap-2 overflow-x-auto rounded-[26px] border border-border bg-white p-3 shadow-sm lg:sticky lg:top-24 lg:block lg:space-y-2 lg:overflow-visible">
              {categories.map((category) => {
                const isActive = activeParent?.id === category.id;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setActiveParentId(category.id);
                      setOpenSubcategoryIds([]);
                    }}
                    className={`flex shrink-0 items-center gap-3 rounded-[20px] px-3 py-3 text-left transition-colors lg:w-full lg:flex-col lg:justify-center lg:px-2 ${
                      isActive
                        ? "bg-sky-50 text-foreground"
                        : "text-foreground/80 hover:bg-muted/60"
                    }`}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                      <Image
                        src={category._resolvedImage}
                        alt={category.name}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                    <span className="text-xs font-medium leading-snug lg:text-center">
                      {category.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {activeParent ? (
              <div className="space-y-4">
                {activeParent.subcategories.length > 0 ? (
                  activeParent.subcategories.map((subcategory) => {
                    const isOpen = openSubcategoryIds.includes(subcategory.id);
                    const subcategoryHref = `/category/${encodeURIComponent(
                      subcategory.slug || subcategory.id,
                    )}`;
                    const hasNestedSubcategories =
                      subcategory.subcategories.length > 0;

                    return (
                      <section
                        key={subcategory.id}
                        className="overflow-hidden rounded-[22px] border border-border bg-white shadow-sm"
                      >
                        <div className="flex items-center gap-4 px-4 py-4 md:px-5">
                          <Link
                            href={subcategoryHref}
                            className="flex min-w-0 flex-1 items-center gap-4"
                          >
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                              <Image
                                src={subcategory._resolvedImage}
                                alt={subcategory.name}
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            </div>
                            <span className="truncate text-sm font-semibold text-foreground md:text-lg">
                              {subcategory.name}
                            </span>
                          </Link>

                          {hasNestedSubcategories ? (
                            <button
                              type="button"
                              aria-label={
                                isOpen
                                  ? `Collapse ${subcategory.name}`
                                  : `Expand ${subcategory.name}`
                              }
                              onClick={() => toggleSubcategory(subcategory.id)}
                              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  isOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          ) : (
                            <Link
                              href={subcategoryHref}
                              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              aria-label={`Open ${subcategory.name}`}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          )}
                        </div>

                        {hasNestedSubcategories && isOpen && (
                          <div className="border-t border-border px-4 pb-5 pt-4 md:px-5">
                            <div className="flex flex-wrap gap-2">
                              {subcategory.subcategories.map((child) => (
                                <Link
                                  key={child.id}
                                  href={`/category/${encodeURIComponent(
                                    child.slug || child.id,
                                  )}`}
                                  className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-slate-200 transition-colors hover:text-primary"
                                >
                                  {child.name}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </section>
                    );
                  })
                ) : (
                  <div className="rounded-[22px] border border-border bg-white p-6 text-sm text-muted-foreground shadow-sm">
                    No subcategories available for {activeParent.name} yet.
                  </div>
                )}

                <div>
                  <Link
                    href={`/category/${encodeURIComponent(
                      activeParent.slug || activeParent.id,
                    )}`}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Shop {activeParent.name}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-[22px] border border-border bg-white p-6 text-sm text-muted-foreground shadow-sm">
                No categories available yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
