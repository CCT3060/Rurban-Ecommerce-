import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = (user.app_metadata?.role as string | undefined) ?? (user.user_metadata?.role as string | undefined);
  if (role !== "admin") return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true as const };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = (await request.json()) as { is_active?: boolean; full_name?: string | null; phone?: string | null };
  const payload: Record<string, unknown> = {};
  if (body.is_active !== undefined) payload.is_active = Boolean(body.is_active);
  if (body.full_name !== undefined) payload.full_name = body.full_name;
  if (body.phone !== undefined) payload.phone = body.phone;
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").update(payload).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  // deleteUser removes from auth.users which cascades to profiles and user_product_prices
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
