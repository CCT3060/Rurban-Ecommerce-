import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeSupabaseImageUrl(url: string | null | undefined): string {
  if (!url) return "";

  let normalized = url.trim();
  if (!normalized) return "";

  if (/^[a-z0-9-]+\.supabase\.co\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  if (normalized.includes("/storage/v1/object/") && !normalized.includes("/storage/v1/object/public/")) {
    normalized = normalized.replace("/storage/v1/object/", "/storage/v1/object/public/");
  }

  return normalized;
}

export function toIsoBoundary(value: string, boundary: "start" | "end"): string {
  const [year, month, day] = value.split("-").map(Number);
  const date =
    boundary === "start"
      ? new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      : new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  return date.toISOString();
}

export function getScheduleTimeMs(value: string | null | undefined, boundary: "start" | "end"): number | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  if (boundary === "end") {
    const raw = value.trim();
    const hasExplicitTime = /T\d{2}:\d{2}/.test(raw);
    const isMidnightTime = /T00:00(:00(?:\.000)?)?(Z|[+-]\d{2}:?\d{2})?$/.test(raw);

    if (!hasExplicitTime || isMidnightTime) {
      return parsed.getTime() + 86_399_999;
    }
  }

  return parsed.getTime();
}

export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
