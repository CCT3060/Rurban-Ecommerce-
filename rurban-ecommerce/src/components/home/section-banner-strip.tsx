import Image from "next/image";
import Link from "next/link";
import { normalizeSupabaseImageUrl } from "@/lib/utils";
import type { Banner } from "@/types";

interface SectionBannerStripProps {
  banners: Banner[];
  title: string;
  hideTitle?: boolean;
}

export default function SectionBannerStrip({ banners, title, hideTitle = false }: SectionBannerStripProps) {
  if (banners.length === 0) return null;

  return (
    <section className="py-4 md:py-5">
      <div className="container mx-auto px-3 md:px-4 lg:px-6">
        {!hideTitle && <h2 className="mb-3 text-lg font-semibold md:text-xl">{title}</h2>}
        <div className="grid grid-cols-1 gap-3 md:gap-4">
          {banners.map((banner) => {
            const hasTitle = Boolean(banner.title?.trim());
            const linkHref = banner.cta_link?.trim() || null;
            const bannerClassName =
              "relative w-full min-h-[170px] overflow-hidden rounded-2xl border border-border/60 md:min-h-[230px] lg:min-h-[280px]";

            const bannerContent = (
              <>
                <Image
                  src={normalizeSupabaseImageUrl(banner.image_url)}
                  alt={banner.title || title || "Banner"}
                  fill
                  className="object-cover"
                  sizes="100vw"
                />
                {hasTitle && <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-transparent" />}
                {hasTitle && (
                  <div className="relative z-10 max-w-[80%] p-5 text-white md:p-6">
                    {banner.subtitle && <p className="mb-2 text-xs uppercase tracking-wider text-white/90 md:text-sm">{banner.subtitle}</p>}
                    <h3 className="mb-3 text-lg font-bold leading-tight md:text-2xl">{banner.title}</h3>
                    {banner.cta_text && linkHref && (
                      <span className="inline-flex h-8 items-center rounded-full bg-white px-3 text-xs font-medium text-black shadow-sm">
                        {banner.cta_text}
                      </span>
                    )}
                  </div>
                )}
              </>
            );

            if (linkHref) {
              return (
                <Link key={banner.id} href={linkHref} className={`${bannerClassName} block`}>
                  {bannerContent}
                </Link>
              );
            }

            return (
              <div key={banner.id} className={bannerClassName}>
                {bannerContent}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
