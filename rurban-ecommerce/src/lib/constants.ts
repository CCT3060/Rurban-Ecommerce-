export const APP_NAME = "Rurban";

export const CURRENCY = "\u20B9";

export const BANNER_SECTIONS = [
  "hero",
  "category",
  "sidebar",
  "offers",
  "flash_sale",
  "seasonal", 
] as const;

export const HOMEPAGE_SECTION_TYPES = [
  "hero_slider",
  "offer_banners",
  "featured_categories",
  "best_selling",
  "new_arrivals",
  "trending",
  "flash_sale",
  "discount_offers",
  "seasonal_banners",
  "recommended",
  "testimonials",
  "newsletter",
] as const;

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Offers", href: "/offers" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const IMAGE_PLACEHOLDER = "/images/placeholder.svg";

export function formatPrice(price: number): string {
  return `${CURRENCY}${price.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
