import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminContext } from "@/lib/auth/request-context";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { error } = await admin.from("lookup_values").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as { is_active?: boolean; value?: string };
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await admin.from("lookup_values").update(body as any).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
