"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import SectionHeader from "@/components/shared/section-header";
import { IMAGE_PLACEHOLDER } from "@/lib/constants";
import { normalizeSupabaseImageUrl } from "@/lib/utils";
import type { Category } from "@/types";

interface ShopByCategorySliderProps {
  categories: Category[];
  title: string;
  subtitle?: string | null;
  viewAllHref?: string;
}

export default function ShopByCategorySlider({
  categories,
  title,
  subtitle,
  viewAllHref = "/categories",
}: ShopByCategorySliderProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  useEffect(() => {
    if (!api) return;

    const update = () => {
      setSelectedIndex(api.selectedScrollSnap());
      setSnapCount(api.scrollSnapList().length);
    };

    update();
    api.on("select", update);
    api.on("reInit", update);

    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

  if (categories.length === 0) {
    return (
      <div className="container mx-auto px-3 md:px-4 lg:px-6">
        <SectionHeader
          title={title}
          subtitle={subtitle || "Explore our artisanal collections"}
          href={viewAllHref}
        />
        <div className="rounded-3xl border border-border/50 bg-muted/10 p-8 text-center text-muted-foreground shadow-sm">
          No categories available yet.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 md:px-4 lg:px-6">
      <SectionHeader
        title={title}
        subtitle={subtitle || "Explore our artisanal collections"}
        href={viewAllHref}
      />

      <Carousel
        setApi={setApi}
        opts={{ align: "start", loop: categories.length > 3 }}
        className="w-full"
      >
        <CarouselContent className="-ml-3 md:-ml-4">
          {categories.map((category) => {
            const categoryHref = `/category/${encodeURIComponent(category.slug || category.id)}`;
            const imageUrl =
              normalizeSupabaseImageUrl(category.banner_url || category.image_url) ||
              IMAGE_PLACEHOLDER;

            return (
              <CarouselItem
                key={category.id}
                className="pl-3 md:pl-4 basis-[92%] sm:basis-[68%] lg:basis-1/3"
              >
                <Link
                  href={categoryHref}
                  className="group relative block h-[170px] overflow-hidden rounded-[1.75rem] border border-white/60 shadow-[0_10px_28px_rgba(15,23,42,0.12)] md:h-[210px]"
                >
                  <Image
                    src={imageUrl}
                    alt={category.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 95vw, (max-width: 1200px) 68vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/58 via-black/30 to-transparent" />

                  <div className="absolute inset-0 flex flex-col justify-between p-5 md:p-6">
                    <div>
                      <h3 className="max-w-[85%] text-2xl font-extrabold leading-tight text-white md:text-3xl">
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="mt-1 line-clamp-1 text-sm text-white/90">
                          {category.description}
                        </p>
                      )}
                    </div>

                    <span className="inline-flex h-8 w-fit items-center rounded-full bg-red-500 px-4 text-xs font-bold text-white shadow-sm">
                      Shop Now
                    </span>
                  </div>
                </Link>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {snapCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: snapCount }).map((_, index) => (
            <button
              key={`shop-dot-${index}`}
              type="button"
              aria-label={`Go to category slide ${index + 1}`}
              onClick={() => api?.scrollTo(index)}
              className={`h-2.5 rounded-full transition-all ${
                selectedIndex === index ? "w-7 bg-primary" : "w-2.5 bg-primary/25"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
