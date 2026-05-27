export const BANNER_SECTIONS = [
  "hero",
  "offers",
  "category",
  "flash_sale",
  "seasonal",
  "sidebar",
] as const;

export type BannerSection = (typeof BANNER_SECTIONS)[number];

export const BANNER_SECTION_LABELS: Record<BannerSection, string> = {
  hero: "Hero Slider",
  offers: "Offers Section",
  category: "Category Section",
  flash_sale: "Flash Sale Section",
  seasonal: "Seasonal Section",
  sidebar: "Sidebar Section",
};

const BANNER_SECTION_ALIASES: Record<string, BannerSection> = {
  hero: "hero",
  offers: "offers",
  offer: "offers",
  category: "category",
  categories: "category",
  flash_sale: "flash_sale",
  flashsale: "flash_sale",
  seasonal: "seasonal",
  sidebar: "sidebar",
};

export function normalizeBannerSection(value: string | null | undefined): BannerSection | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return BANNER_SECTION_ALIASES[normalized] ?? null;
}