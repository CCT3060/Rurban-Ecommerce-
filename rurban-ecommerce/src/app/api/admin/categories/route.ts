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
    (user.app_metadata?.role as string | undefined) ?? (user.user_metadata?.role as string | undefined);

  if (role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data: categories, error } = await admin
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: productRows, error: productError } = await admin
    .from("products")
    .select("category_id")
    .not("category_id", "is", null);

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 400 });
  }

  const directCounts = new Map<string, number>();
  for (const row of productRows ?? []) {
    const id = row.category_id as string | null;
    if (!id) continue;
    directCounts.set(id, (directCounts.get(id) ?? 0) + 1);
  }

  const categoryRows = categories ?? [];
  const childrenByParent = new Map<string, string[]>();
  for (const category of categoryRows) {
    if (!category.parent_id) continue;
    const parentId = category.parent_id as string;
    const children = childrenByParent.get(parentId) ?? [];
    children.push(category.id as string);
    childrenByParent.set(parentId, children);
  }

  const totalsCache = new Map<string, number>();
  const getTotalProductCount = (categoryId: string, trail = new Set<string>()) => {
    const cached = totalsCache.get(categoryId);
    if (cached !== undefined) return cached;

    // Guard against accidental cycles in category relationships.
    if (trail.has(categoryId)) {
      return directCounts.get(categoryId) ?? 0;
    }

    const nextTrail = new Set(trail);
    nextTrail.add(categoryId);

    let total = directCounts.get(categoryId) ?? 0;
    const children = childrenByParent.get(categoryId) ?? [];
    for (const childId of children) {
      total += getTotalProductCount(childId, nextTrail);
    }

    totalsCache.set(categoryId, total);
    return total;
  };

  const data = categoryRows.map((cat) => ({
    ...cat,
    product_count: getTotalProductCount(cat.id as string),
  }));

  return NextResponse.json({ data });
}

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

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as CreateCategoryBody;
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }

  const payload = {
    name,
    slug: (body.slug?.trim() || generateSlug(name)).toLowerCase(),
    description: body.description?.trim() || null,
    parent_id: body.parent_id || null,
    status: body.status === "inactive" ? "inactive" : "active",
    sort_order: Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0,
    image_url: normalizeSupabaseImageUrl(body.image_url) || null,
    banner_url: normalizeSupabaseImageUrl(body.banner_url) || null,
  };

  const admin = createAdminClient();
  const { data, error } = await admin.from("categories").insert(payload).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
