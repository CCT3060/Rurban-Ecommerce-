import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BANNER_SECTIONS, normalizeBannerSection } from "@/lib/banner-sections";
import { getScheduleTimeMs } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedSections = (searchParams.get("sections") || "")
    .split(",")
    .map((section) => normalizeBannerSection(section))
    .filter((section): section is (typeof BANNER_SECTIONS)[number] => Boolean(section));

  const sectionFilter = requestedSections.length > 0 ? requestedSections : BANNER_SECTIONS;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("banners")
    .select("*")
    .eq("status", "active")
    .in("section", [...sectionFilter])
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const now = Date.now();
  const normalized = (data ?? [])
    .map((banner) => {
      const section = normalizeBannerSection(banner.section);
      if (!section) return null;

      const start = getScheduleTimeMs(banner.start_date, "start");
      const end = getScheduleTimeMs(banner.end_date, "end");
      if ((start !== null && now < start) || (end !== null && now > end)) return null;

      return {
        ...banner,
        section,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ data: normalized });
}