import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  href?: string;
  linkText?: string;
}

export default function SectionHeader({
  title,
  subtitle,
  href,
  linkText = "View All",
}: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between mb-6 md:mb-8">
      <div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-0.5 shrink-0 transition-colors"
        >
          {linkText}
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
