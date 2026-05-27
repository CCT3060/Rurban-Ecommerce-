import Image from "next/image";
import Link from "next/link";
import { IMAGE_PLACEHOLDER } from "@/lib/constants";
import { normalizeSupabaseImageUrl } from "@/lib/utils";
import type { Category } from "@/types";

interface CategoryCardProps {
  category: Category;
  variant?: "default" | "large";
}

export default function CategoryCard({
  category,
  variant = "default",
}: CategoryCardProps) {
  const imageUrl = normalizeSupabaseImageUrl(category.image_url) || IMAGE_PLACEHOLDER;
  const categoryHref = `/category/${encodeURIComponent(category.slug || category.id)}`;

  return (
    <Link href={categoryHref} className="flex flex-col items-center gap-2 group w-full transition-all">
      <div className={`relative rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shadow-sm transition-all group-hover:border-primary/30 group-hover:shadow-md ${variant === "large" ? "w-32 h-32 md:w-40 md:h-40" : "w-16 h-16 md:w-24 md:h-24"}`}>
        <Image
          src={imageUrl}
          alt={category.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 150px, 200px"
        />
      </div>
      <div className="text-center mt-1">
        <h3 className={`font-semibold text-foreground group-hover:text-primary transition-colors leading-tight px-1 max-w-[100px] mx-auto text-center line-clamp-2 ${variant === "large" ? "text-sm md:text-sm" : "text-[11px] md:text-xs"}`}>
          {category.name}
        </h3>
      </div>
    </Link>
  );
}
