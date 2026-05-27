import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

interface UpdateCouponBody {
  code?: string;
  description?: string | null;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  min_order_value?: number;
  max_uses?: number | null;
  expiry_date?: string;
  status?: "active" | "inactive";
  used_count?: number;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as UpdateCouponBody;
  const payload: Record<string, unknown> = {};

  if (body.code !== undefined) {
    const code = body.code.trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "Coupon code cannot be empty" }, { status: 400 });
    }
    payload.code = code;
  }

  if (body.description !== undefined) payload.description = body.description?.trim() || null;
  if (body.discount_type !== undefined) payload.discount_type = body.discount_type;
  if (body.discount_value !== undefined) payload.discount_value = Number(body.discount_value);
  if (body.min_order_value !== undefined) payload.min_order_value = Number(body.min_order_value);
  if (body.max_uses !== undefined) payload.max_uses = body.max_uses === null ? null : Number(body.max_uses);
  if (body.expiry_date !== undefined) payload.expiry_date = body.expiry_date;
  if (body.status !== undefined) payload.status = body.status;
  if (body.used_count !== undefined) payload.used_count = Number(body.used_count);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coupons")
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
  const { error } = await admin.from("coupons").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
