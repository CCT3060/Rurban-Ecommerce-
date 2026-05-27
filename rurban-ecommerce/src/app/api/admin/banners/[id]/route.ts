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
    (user.app_metadata?.role as string | undefined) ?? (user.user_metadata?.role as string | undefined);

  if (role !== "admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const };
}

interface UpdateBannerBody {
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as UpdateBannerBody;

  const payload: Record<string, unknown> = {};

  if (body.title !== undefined) payload.title = body.title?.trim() || null;
  if (body.subtitle !== undefined) payload.subtitle = body.subtitle?.trim() || null;
  if (body.image_url !== undefined) {
    const imageUrl = normalizeSupabaseImageUrl(body.image_url);
    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL cannot be empty" }, { status: 400 });
    }
    payload.image_url = imageUrl;
  }
  if (body.cta_text !== undefined) payload.cta_text = body.cta_text?.trim() || null;
  if (body.cta_link !== undefined) payload.cta_link = body.cta_link?.trim() || null;

  if (body.section !== undefined) {
    const normalizedSection = normalizeBannerSection(body.section);
    if (!normalizedSection || !ALLOWED_SECTIONS.has(normalizedSection)) {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 });
    }
    payload.section = normalizedSection;
  }

  if (body.sort_order !== undefined) {
    payload.sort_order = Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0;
  }

  if (body.status !== undefined) {
    if (!ALLOWED_STATUS.has(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    payload.status = body.status;
  }

  if (body.start_date !== undefined) payload.start_date = body.start_date || null;
  if (body.end_date !== undefined) payload.end_date = body.end_date || null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("banners")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("banners").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
