import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminContext } from "@/lib/auth/request-context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("warehouses")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ data });
}

interface UpdateWarehouseBody {
  name?: string;
  code?: string;
  location?: string | null;
  manager_name?: string | null;
  manager_email?: string | null;
  is_active?: boolean;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as UpdateWarehouseBody;

  const updatePayload: Record<string, unknown> = {};
  if (body.name !== undefined) updatePayload.name = body.name.trim();
  if (body.code !== undefined) updatePayload.code = body.code.trim();
  if (body.location !== undefined) updatePayload.location = body.location?.trim() || null;
  if (body.manager_name !== undefined) updatePayload.manager_name = body.manager_name?.trim() || null;
  if (body.manager_email !== undefined) updatePayload.manager_email = body.manager_email?.trim() || null;
  if (body.is_active !== undefined) updatePayload.is_active = Boolean(body.is_active);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("warehouses")
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
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { error } = await admin.from("warehouses").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
