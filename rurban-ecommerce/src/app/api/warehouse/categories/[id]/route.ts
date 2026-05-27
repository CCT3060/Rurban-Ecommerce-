import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";
import { generateSlug } from "@/lib/constants";
import { normalizeSupabaseImageUrl } from "@/lib/utils";

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
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as UpdateCategoryBody;
  const updatePayload: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Category name cannot be empty" }, { status: 400 });
    updatePayload.name = name;
    updatePayload.slug = (body.slug?.trim() || generateSlug(name)).toLowerCase();
  } else if (body.slug !== undefined) {
    const slug = body.slug.trim().toLowerCase();
    if (!slug) return NextResponse.json({ error: "Slug cannot be empty" }, { status: 400 });
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
    .eq("warehouse_id", auth.context.warehouseId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("warehouse_id", auth.context.warehouseId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
