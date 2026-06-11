"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/product/product-card";
import type { Product } from "@/types";

type CategoryGroup = {
  id: string;
  name: string;
  slug: string;
  products: (Product & { custom_price: number })[];
};

export default function MyCatalogueContent({
  categories,
}: {
  categories: CategoryGroup[];
}) {
  const [activeId, setActiveId] = useState<string>(categories[0]?.id ?? "");
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Observe which section is in view
  useEffect(() => {
    if (categories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    for (const [, el] of sectionRefs.current) {
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, [categories]);

  const scrollTo = (id: string) => {
    const el = sectionRefs.current.get(id);
    if (el) {
      const offset = 80; // account for sticky navbar height
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <div className="flex gap-8 items-start">
      {/* ── Sticky sidebar ─────────────────────────────────────────── */}
      <aside className="hidden lg:block w-52 shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-2">
          Categories
        </p>
        <nav className="space-y-0.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => scrollTo(cat.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeId === cat.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {cat.name}
              <span className="ml-1.5 text-xs font-normal opacity-60">
                ({cat.products.length})
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Product sections ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-12">
        {categories.map((cat) => (
          <section
            key={cat.id}
            id={cat.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(cat.id, el);
              else sectionRefs.current.delete(cat.id);
            }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                {cat.name}
              </h2>
              <Link
                href={`/category/${cat.slug}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                View all &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {cat.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
