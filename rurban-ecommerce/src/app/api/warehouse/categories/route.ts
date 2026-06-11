import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";
import { generateSlug } from "@/lib/constants";
import { normalizeSupabaseImageUrl } from "@/lib/utils";

interface CreateCategoryBody {
  name?: string;
  slug?: string;
  description?: string | null;
  parent_id?: string | null;
  status?: "active" | "inactive";
  sort_order?: number;
  image_url?: string | null;
  banner_url?: string | null;
}

export async function GET() {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  // Include both warehouse-specific categories AND global categories (warehouse_id IS NULL)
  const { data, error } = await admin
    .from("categories")
    .select("*")
    .or(`warehouse_id.eq.${auth.context.warehouseId},warehouse_id.is.null`)
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as CreateCategoryBody;
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Category name is required" }, { status: 400 });

  const admin = createAdminClient();
  const payload = {
    name,
    slug: (body.slug?.trim() || generateSlug(name)).toLowerCase(),
    description: body.description?.trim() || null,
    parent_id: body.parent_id || null,
    status: body.status === "inactive" ? "inactive" : "active",
    sort_order: Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0,
    image_url: normalizeSupabaseImageUrl(body.image_url) || null,
    banner_url: normalizeSupabaseImageUrl(body.banner_url) || null,
    warehouse_id: auth.context.warehouseId,
  };

  const { data, error } = await admin.from("categories").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ data }, { status: 201 });
}
