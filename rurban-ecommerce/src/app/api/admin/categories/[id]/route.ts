import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSlug } from "@/lib/constants";
import { normalizeSupabaseImageUrl } from "@/lib/utils";

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const role =
    user.app_metadata?.role as string | undefined;

  if (role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const };
}

interface UpdateCategoryBody {
  name?: string;
  slug?: string;
  description?: string | null;
  parent_id?: string | null;
  status?: "active" | "inactive";
  sort_order?: number;
  image_url?: string | null;
  banner_url?: string | null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as UpdateCategoryBody;

  const updatePayload: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Category name cannot be empty" }, { status: 400 });
    }
    updatePayload.name = name;
    updatePayload.slug = (body.slug?.trim() || generateSlug(name)).toLowerCase();
  } else if (body.slug !== undefined) {
    const slug = body.slug.trim().toLowerCase();
    if (!slug) {
      return NextResponse.json({ error: "Slug cannot be empty" }, { status: 400 });
    }
    updatePayload.slug = slug;
  }

  if (body.description !== undefined) updatePayload.description = body.description?.trim() || null;
  if (body.parent_id !== undefined) updatePayload.parent_id = body.parent_id || null;
  if (body.status !== undefined) updatePayload.status = body.status === "inactive" ? "inactive" : "active";
  if (body.sort_order !== undefined) updatePayload.sort_order = Number(body.sort_order) || 0;
  if (body.image_url !== undefined) updatePayload.image_url = normalizeSupabaseImageUrl(body.image_url) || null;
  if (body.banner_url !== undefined) updatePayload.banner_url = normalizeSupabaseImageUrl(body.banner_url) || null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("categories")
    .update(updatePayload)
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
  const { error } = await admin.from("categories").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
