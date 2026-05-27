import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSupabaseImageUrl, toIsoBoundary } from "@/lib/utils";

function normalizeDateInput(value: string | undefined, boundary: "start" | "end") {
  if (!value) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return toIsoBoundary(value, boundary);
  }
  return value;
}

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

interface UpdateOfferBody {
  title?: string;
  description?: string | null;
  type?: "percentage" | "fixed" | "bogo" | "category_discount" | "product_discount";
  value?: number;
  image_url?: string | null;
  apply_to?: "all" | "category" | "product";
  target_id?: string | null;
  start_date?: string;
  end_date?: string;
  status?: "active" | "inactive";
  is_highlighted?: boolean;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as UpdateOfferBody;
  const payload: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Offer title cannot be empty" }, { status: 400 });
    }
    payload.title = title;
  }

  if (body.description !== undefined) payload.description = body.description?.trim() || null;
  if (body.type !== undefined) payload.type = body.type;
  if (body.value !== undefined) payload.value = Number(body.value);
  if (body.image_url !== undefined) payload.image_url = normalizeSupabaseImageUrl(body.image_url) || null;
  if (body.apply_to !== undefined) payload.apply_to = body.apply_to;
  if (body.target_id !== undefined) payload.target_id = body.target_id || null;
  if (body.start_date !== undefined) payload.start_date = normalizeDateInput(body.start_date, "start");
  if (body.end_date !== undefined) payload.end_date = normalizeDateInput(body.end_date, "end");
  if (body.status !== undefined) payload.status = body.status;
  if (body.is_highlighted !== undefined) payload.is_highlighted = Boolean(body.is_highlighted);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("offers")
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
  const { error } = await admin.from("offers").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
