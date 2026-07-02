import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSupabaseImageUrl } from "@/lib/utils";
import { BANNER_SECTIONS, normalizeBannerSection } from "@/lib/banner-sections";

const ALLOWED_SECTIONS = new Set(BANNER_SECTIONS);

const ALLOWED_STATUS = new Set(["active", "inactive"]);

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const role =
    user.app_metadata?.role as string | undefined;

  if (role !== "admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("banners")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

interface CreateBannerBody {
  title?: string | null;
  subtitle?: string | null;
  image_url?: string;
  cta_text?: string | null;
  cta_link?: string | null;
  section?: string;
  sort_order?: number;
  status?: "active" | "inactive";
  start_date?: string | null;
  end_date?: string | null;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as CreateBannerBody;

  if (!body.image_url) {
    return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
  }

  const section = normalizeBannerSection(body.section ?? "hero");
  if (!section || !ALLOWED_SECTIONS.has(section)) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  }

  const status = body.status ?? "active";
  if (!ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createAdminClient();
  const payload = {
    title: body.title?.trim() || null,
    subtitle: body.subtitle?.trim() || null,
    image_url: normalizeSupabaseImageUrl(body.image_url),
    cta_text: body.cta_text?.trim() || null,
    cta_link: body.cta_link?.trim() || null,
    section,
    sort_order: Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0,
    status,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
  };

  const { data, error } = await admin
    .from("banners")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
