import { NextResponse } from "next/server";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, email, phone, warehouse_id")
    .eq("id", auth.context.userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  let warehouseName: string | null = null;
  if (profile?.warehouse_id) {
    const { data: warehouse } = await admin
      .from("warehouses")
      .select("name")
      .eq("id", profile.warehouse_id)
      .maybeSingle() as unknown as { data: { name: string } | null };

    warehouseName = warehouse?.name ?? null;
  }

  return NextResponse.json({
    data: {
      id: auth.context.userId,
      role: auth.context.role,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      warehouse_name: warehouseName,
    },
  });
}

export async function PUT(request: Request) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as { full_name?: string | null; phone?: string | null };
  const payload: Record<string, unknown> = {};
  if (body.full_name !== undefined) payload.full_name = body.full_name;
  if (body.phone !== undefined) payload.phone = body.phone;

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin
    .from("profiles")
    .update(payload as unknown as never) as any)
    .eq("id", auth.context.userId);

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 400 });
  return NextResponse.json({ success: true });
}
