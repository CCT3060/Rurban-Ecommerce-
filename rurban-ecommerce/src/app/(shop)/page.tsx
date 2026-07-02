// Home page is statically generated and revalidated every 60 seconds (ISR).
// This eliminates 9 parallel DB queries per visitor and serves from CDN cache.
export const revalidate = 60;

import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import HeroSlider from "@/components/home/hero-slider";
import SectionBannerStrip from "@/components/home/section-banner-strip";
import SectionHeader from "@/components/shared/section-header";
import ShopByCategorySlider from "@/components/home/shop-by-category-slider";
import WishlistProductsRail from "@/components/home/wishlist-products-rail";
import ProductCard from "@/components/product/product-card";
import { HOMEPAGE_SECTION_TYPES, IMAGE_PLACEHOLDER } from "@/lib/constants";
import {
  BANNER_SECTIONS,
  normalizeBannerSection,
  type BannerSection,
} from "@/lib/banner-sections";
import { getScheduleTimeMs, normalizeSupabaseImageUrl } from "@/lib/utils";
import type { Banner, Category, HomepageSection, Product, Testimonial } from "@/types";

async function getHomeData() {
  const admin = createAdminClient();
  const hiddenBannerTitles = new Set(["shop by category", "best deals"]);

  const [
    sectionsRes,
    bannersRes,
    categoriesRes,
    subCatsRes,
    testimonialsRes,
    featuredRes,
    trendingRes,
    newArrivalsRes,
    orderItemsRes,
  ] = await Promise.all([
    admin
      .from("homepage_sections")
      .select("*")
      .eq("status", "active")
      .order("sort_order", { ascending: true }),
    admin
      .from("banners")
      .select("*")
      .eq("status", "active")
      .order("sort_order", { ascending: true }),
    admin
      .from("categories")
      .select("*")
      .eq("status", "active")
      .is("parent_id", null)
      .order("sort_order", { ascending: true }),
    admin
      .from("categories")
      .select("*")
      .eq("status", "active")
      .not("parent_id", "is", null)
      .order("sort_order", { ascending: true }),
    admin
      .from("testimonials")
      .select("*")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .limit(6),
    admin
      .from("products")
      .select("*, images:product_images(*)")
      .eq("status", "active")
      .eq("is_featured", true)
      .order("updated_at", { ascending: false })
      .limit(12),
    admin
      .from("products")
      .select("*, images:product_images(*)")
      .eq("status", "active")
      .eq("is_trending", true)
      .order("updated_at", { ascending: false })
      .limit(12),
    admin
      .from("products")
      .select("*, images:product_images(*)")
      .eq("status", "active")
      .eq("is_new_arrival", true)
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("order_items")
      .select("product_id, quantity")
      .not("product_id", "is", null),
  ]);

  const now = Date.now();
  const banners = ((bannersRes.data ?? []) as Banner[]).filter((banner) => {
    const section = normalizeBannerSection(banner.section);
    if (!section) return false;

    const normalizedTitle = banner.title?.trim().toLowerCase();
    if (normalizedTitle && hiddenBannerTitles.has(normalizedTitle)) return false;

    const start = getScheduleTimeMs(banner.start_date, "start");
    const end = getScheduleTimeMs(banner.end_date, "end");
    return (start === null || now >= start) && (end === null || now <= end);
  });

  const parentCategories = (categoriesRes.data ?? []) as Category[];
  const subCategories = (subCatsRes.data ?? []) as Category[];

  const categoriesWithSubs: Category[] = parentCategories.map((parent) => ({
    ...parent,
    subcategories: subCategories.filter((sub) => sub.parent_id === parent.id),
  }));

  const featuredProducts = ((featuredRes.data ?? []) as Product[]).slice(0, 12);
  const trendingProducts = ((trendingRes.data ?? []) as Product[]).slice(0, 12);
  const newArrivalProducts = ((newArrivalsRes.data ?? []) as Product[]).slice(0, 12);

  const qtyByProductId = new Map<string, number>();
  const orderRows = (orderItemsRes.data ?? []) as Array<{
    product_id: string | null;
    quantity: number | null;
  }>;

  for (const row of orderRows) {
    if (!row.product_id) continue;
    const qty = Number(row.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    qtyByProductId.set(row.product_id, (qtyByProductId.get(row.product_id) ?? 0) + qty);
  }

  const rankedPopularIds = [...qtyByProductId.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([productId]) => productId);

  let mostPopularProducts: Product[] = [];
  if (rankedPopularIds.length > 0) {
    const popularIdsForQuery = rankedPopularIds.slice(0, 40);

    const { data: popularProductsData } = await admin
      .from("products")
      .select("*, images:product_images(*)")
      .eq("status", "active")
      .in("id", popularIdsForQuery);

    const productsById = new Map(
      ((popularProductsData ?? []) as Product[]).map((product) => [product.id, product]),
    );

    mostPopularProducts = popularIdsForQuery
      .map((productId) => productsById.get(productId))
      .filter((product): product is Product => Boolean(product))
      .slice(0, 12);
  }

  return {
    sections: (sectionsRes.data ?? []) as HomepageSection[],
    banners,
    categories: parentCategories.slice(0, 8),
    categoriesWithSubs,
    testimonials: (testimonialsRes.data ?? []) as Testimonial[],
    featuredProducts,
    trendingProducts,
    newArrivalProducts,
    mostPopularProducts,
  };
}

export default async function HomePage() {
  // Redirect B2B users to their catalogue view
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Check app_metadata first (set reliably at B2B user creation),
      // then fall back to DB profile
      const metaUserType = user.app_metadata?.user_type as string | undefined;
      let isB2B = metaUserType === "b2b";

      if (!isB2B) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_type")
          .eq("id", user.id)
          .single();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        isB2B = (profile as any)?.user_type === "b2b";
      }

      if (isB2B) {
        redirect("/my-catalogue");
      }
    }
  } catch (e) {
    // If redirect() was called, re-throw it; otherwise ignore DB errors
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
  }

  const {
    sections,
    banners,
    categories,
    categoriesWithSubs,
    testimonials,
    featuredProducts,
    trendingProducts,
    newArrivalProducts,
    mostPopularProducts,
  } = await getHomeData();

  const curatedProductSections: Array<{
    id: string;
    title: string;
    subtitle: string;
    products: Product[];
    href: string;
  }> = [
    {
      id: "featured-products",
      title: "Featured Products",
      subtitle: "Products marked as featured by admin",
      products: featuredProducts,
      href: "/sections/featured-products",
    },
    {
      id: "trending-products",
      title: "Trending Products",
      subtitle: "Products marked as trending by admin",
      products: trendingProducts,
      href: "/sections/trending-products",
    },
    {
      id: "new-arrivals",
      title: "New Arrivals",
      subtitle: "Latest products marked as new arrival by admin",
      products: newArrivalProducts,
      href: "/sections/new-arrivals",
    },
    {
      id: "most-popular-products",
      title: "Most Popular Products",
      subtitle: "Products ordered the most by customers",
      products: mostPopularProducts,
      href: "/sections/most-popular-products",
    },
  ];

  const fallbackSectionTypes: Array<(typeof HOMEPAGE_SECTION_TYPES)[number]> = [
    "hero_slider",
    "featured_categories",
    "best_selling",
    "newsletter",
  ];

  const orderedSections =
    sections.length > 0
      ? sections
      : fallbackSectionTypes.map((type, index) => ({
          id: `fallback-${type}-${index}`,
          type,
          title: null,
          subtitle: null,
          sort_order: index + 1,
          status: "active",
          config: null,
          created_at: "",
          updated_at: "",
        }));

  type RenderableSectionType =
    | (typeof HOMEPAGE_SECTION_TYPES)[number]
    | "sidebar_banners";

  const sectionTypeAliases: Record<string, RenderableSectionType> = {
    hero: "hero_slider",
    hero_banner: "hero_slider",
    offers: "offer_banners",
    offer: "offer_banners",
    offer_banner: "offer_banners",
    offer_banners: "offer_banners",
    categories: "featured_categories",
    category: "featured_categories",
    featured: "best_selling",
    latest: "new_arrivals",
    flashsale: "flash_sale",
    flash_banners: "flash_sale",
    seasonal: "seasonal_banners",
    seasonal_banner: "seasonal_banners",
    discounts: "discount_offers",
    discount: "discount_offers",
    sidebar: "sidebar_banners",
  };

  const normalizeSectionType = (type: string): RenderableSectionType | null => {
    const normalized = type.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if ((HOMEPAGE_SECTION_TYPES as readonly string[]).includes(normalized)) {
      return normalized as (typeof HOMEPAGE_SECTION_TYPES)[number];
    }
    return sectionTypeAliases[normalized] ?? null;
  };

  const bannersBySection = BANNER_SECTIONS.reduce((bucket, section) => {
    bucket[section] = [];
    return bucket;
  }, {} as Record<BannerSection, Banner[]>);

  for (const banner of banners) {
    const section = normalizeBannerSection(banner.section);
    if (!section) continue;
    bannersBySection[section].push(banner);
  }

  const firstSubcategorySectionId =
    orderedSections.find((candidate) => {
      const candidateType = normalizeSectionType(candidate.type);
      return (
        candidateType === "best_selling" ||
        candidateType === "recommended" ||
        candidateType === "trending" ||
        candidateType === "new_arrivals"
      );
    })?.id ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-white selection:bg-primary/20">
      <div className="fixed inset-0 z-[-1] bg-slate-50/30 pointer-events-none" />

      {orderedSections.map((section) => {
        const sectionType = normalizeSectionType(section.type);
        if (!sectionType) return null;

        if (sectionType === "hero_slider") {
          return <HeroSlider key={section.id} banners={bannersBySection.hero} />;
        }

        if (sectionType === "offer_banners") {
          const normalizedSectionTitle = section.title?.trim().toLowerCase();
          if (normalizedSectionTitle === "best deals") return null;
          return (
            <SectionBannerStrip
              key={section.id}
              banners={bannersBySection.offers}
              title={section.title || "Exclusive Offers"}
              hideTitle
            />
          );
        }

        if (sectionType === "flash_sale") {
          return (
            <SectionBannerStrip
              key={section.id}
              banners={bannersBySection.flash_sale}
              title={section.title || "Flash Sale"}
              hideTitle
            />
          );
        }

        if (sectionType === "seasonal_banners") {
          return (
            <SectionBannerStrip
              key={section.id}
              banners={bannersBySection.seasonal}
              title={section.title || "Seasonal Picks"}
            />
          );
        }

        if (sectionType === "discount_offers") {
          const normalizedSectionTitle = section.title?.trim().toLowerCase();
          if (normalizedSectionTitle === "best deals") return null;
          const discountBanners =
            bannersBySection.offers.length > 0
              ? bannersBySection.offers
              : bannersBySection.flash_sale;
          return (
            <SectionBannerStrip
              key={section.id}
              banners={discountBanners}
              title={section.title || "Discount Offers"}
            />
          );
        }

        if (sectionType === "sidebar_banners") {
          return (
            <SectionBannerStrip
              key={section.id}
              banners={bannersBySection.sidebar}
              title={section.title || "Featured Highlights"}
            />
          );
        }

        if (sectionType === "featured_categories") {
          const categorySection = (
            <section
              key={`${section.id}-categories`}
              className="relative overflow-hidden py-8 md:py-10"
            >
              <ShopByCategorySlider
                categories={categories}
                title={section.title || "Shop by Category"}
                subtitle={section.subtitle || "Explore our artisanal collections"}
                viewAllHref="/categories"
              />
            </section>
          );

          const productRailSections = curatedProductSections.map((productSection) => (
            <section
              key={`${section.id}-${productSection.id}`}
              className="border-t border-border/25 bg-white py-7 md:py-9"
            >
              <div className="container mx-auto px-3 md:px-4 lg:px-6">
                <SectionHeader
                  title={productSection.title}
                  subtitle={productSection.subtitle}
                  href={productSection.href}
                />

                {productSection.products.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-border/50 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                    No products available for this section yet.
                  </div>
                ) : (
                  <div className="mt-5 flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory hide-scrollbar md:gap-4">
                    {productSection.products.map((product) => (
                      <div
                        key={`${productSection.id}-${product.id}`}
                        className="min-w-[160px] max-w-[220px] shrink-0 snap-start sm:min-w-[190px]"
                      >
                        <ProductCard product={product} compact />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ));

          return [categorySection, ...productRailSections, <WishlistProductsRail key={`${section.id}-wishlist`} />];
        }
        // Keep category-wise subcategory display as before
        if (
          sectionType === "best_selling" ||
          sectionType === "recommended" ||
          sectionType === "trending" ||
          sectionType === "new_arrivals"
        ) {
          if (section.id !== firstSubcategorySectionId) return null;
          if (categoriesWithSubs.length === 0) return null;

          const parentCategoryRows = categoriesWithSubs.filter(
            (parent) => (parent.subcategories?.length ?? 0) > 0,
          );
          if (parentCategoryRows.length === 0) return null;

          return (
            <section key={section.id} className="border-t border-border/30 bg-white py-6 md:py-8">
              <div className="container mx-auto px-3 md:px-4 lg:px-6">
                <div className="divide-y divide-border/70 rounded-xl border border-border/60 bg-white">
                  {parentCategoryRows.map((parent) => {
                    const parentHref = `/category/${encodeURIComponent(parent.slug || parent.id)}`;
                    return (
                      <div key={parent.id} className="px-4 py-6 md:px-6 md:py-7">
                        <Link
                          href={parentHref}
                          className="inline-block text-xl font-bold text-foreground transition-colors hover:text-primary md:text-2xl"
                        >
                          {parent.name}
                        </Link>

                        <div className="mt-5 grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                          {(parent.subcategories ?? []).map((sub) => {
                            const subImage =
                              normalizeSupabaseImageUrl(sub.image_url) || IMAGE_PLACEHOLDER;
                            const subHref = `/category/${encodeURIComponent(sub.slug || sub.id)}`;

                            return (
                              <Link
                                key={sub.id}
                                href={subHref}
                                className="group flex min-w-0 flex-col items-center"
                              >
                                <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:ring-primary/30 md:h-[74px] md:w-[74px]">
                                  <Image
                                    src={subImage}
                                    alt={sub.name}
                                    fill
                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                    sizes="74px"
                                  />
                                </div>
                                <p className="mt-2 line-clamp-2 text-center text-xs font-medium leading-tight text-foreground md:text-sm">
                                  {sub.name}
                                </p>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        }

        if (sectionType === "testimonials") {
          return (
            <section key={section.id} className="bg-muted/20 py-8 md:py-10">
              <div className="container mx-auto px-3 md:px-4 lg:px-6">
                <SectionHeader
                  title={section.title || "What Our Customers Say"}
                  subtitle={section.subtitle || "Real stories from the Rurban community"}
                />

                {testimonials.length === 0 ? (
                  <div className="mt-5 rounded-3xl border border-border/50 bg-background p-8 text-center text-muted-foreground">
                    No testimonials available yet.
                  </div>
                ) : (
                  <div className="mt-6 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {testimonials.map((testimonial) => (
                      <article
                        key={testimonial.id}
                        className="rounded-2xl border border-border/60 bg-background p-6 shadow-sm"
                      >
                        <p className="mb-3 text-sm text-muted-foreground">
                          Rating: {testimonial.rating}/5
                        </p>
                        <p className="text-base leading-relaxed text-foreground">
                          &quot;{testimonial.comment}&quot;
                        </p>
                        <div className="mt-6">
                          <p className="font-semibold text-foreground">{testimonial.name}</p>
                          {testimonial.designation && (
                            <p className="text-sm text-muted-foreground">
                              {testimonial.designation}
                            </p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        }

        if (sectionType === "newsletter") {
          return null;
        }

        return null;
      })}
    </div>
  );
}
