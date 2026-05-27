"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { normalizeSupabaseImageUrl } from "@/lib/utils";
import Autoplay from "embla-carousel-autoplay";
import type { Banner } from "@/types";

interface HeroSliderProps {
  banners: Banner[];
}

export default function HeroSlider({ banners }: HeroSliderProps) {
  if (!banners.length) {
    // Fallback hero when no banners
    return (
      <section className="py-2 md:py-3">
        <div className="container mx-auto px-3 md:px-4 lg:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-primary shadow-sm">
            <div className="min-h-[220px] md:min-h-[300px] flex items-center">
              <div className="px-5 py-8 md:px-8 md:py-10">
                <div className="max-w-2xl text-white">
                  <span className="inline-block px-3 py-1 bg-white/20 rounded text-xs font-bold mb-4 tracking-wider uppercase">
                    New Collection
                  </span>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight">
                    Premium Products, <br /> Unbeatable Value
                  </h1>
                  <p className="mt-4 text-sm md:text-base text-white/90 max-w-lg font-medium">
                    Discover our curated collection of quality products at prices
                    you&apos;ll love. Free shipping on orders above Rs 999.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href="/">
                      <Button
                        size="lg"
                        className="bg-white text-primary hover:bg-slate-100 border-0 font-bold px-8 h-12"
                      >
                        Shop Now
                      </Button>
                    </Link>
                    <Link href="/offers">
                      <Button
                        size="lg"
                        variant="outline"
                        className="text-white border-white/40 hover:bg-white/10 font-bold px-8 h-12"
                      >
                        View Offers
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative py-2 md:py-3">
      <div className="container mx-auto px-3 md:px-4 lg:px-6">
        <Carousel
          opts={{ loop: true }}
          plugins={[Autoplay({ delay: 5000, stopOnInteraction: false })]}
          className="w-full overflow-hidden rounded-2xl border border-border/40 shadow-sm"
        >
          <CarouselContent>
            {banners.map((banner) => {
              const hasTitle = Boolean(banner.title?.trim());
              const linkHref = banner.cta_link?.trim() || null;

              const slideContent = (
                <div className="relative min-h-[220px] md:min-h-[320px] lg:min-h-[380px] flex items-center overflow-hidden">
                  <Image
                    src={normalizeSupabaseImageUrl(banner.image_url)}
                    alt={banner.title || "Banner"}
                    fill
                    className="object-cover"
                    priority
                    sizes="(min-width: 1536px) 1500px, 100vw"
                  />
                  {hasTitle && (
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                  )}
                  {hasTitle && (
                    <div className="relative px-5 py-8 md:px-8 md:py-10">
                      <div className="max-w-xl text-white">
                        {banner.subtitle && (
                          <span className="inline-block px-3 py-1 bg-cta/90 rounded-full text-xs font-semibold mb-4 tracking-wider uppercase">
                            {banner.subtitle}
                          </span>
                        )}
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
                          {banner.title}
                        </h2>
                        {banner.cta_text && linkHref && (
                          <div className="mt-4">
                            <span className="inline-flex h-11 items-center rounded-full bg-cta px-8 text-sm font-medium text-white shadow-sm">
                              {banner.cta_text}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );

              return (
                <CarouselItem key={banner.id}>
                  {linkHref ? (
                    <Link href={linkHref} className="block h-full">
                      {slideContent}
                    </Link>
                  ) : (
                    slideContent
                  )}
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious className="left-4 bg-white/20 border-0 text-white hover:bg-white/30 h-10 w-10" />
          <CarouselNext className="right-4 bg-white/20 border-0 text-white hover:bg-white/30 h-10 w-10" />
        </Carousel>
      </div>
    </section>
  );
}
