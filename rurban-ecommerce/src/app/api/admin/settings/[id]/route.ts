import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = user.app_metadata?.role as string | undefined;
  if (role !== "admin") return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true as const };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = (await request.json()) as { value?: string | number | boolean | Record<string, unknown> | null; type?: string; group?: string; key?: string };
  const payload: Record<string, unknown> = {};
  if (body.key !== undefined) payload.key = body.key;
  if (body.type !== undefined) payload.type = body.type;
  if (body.group !== undefined) payload.group = body.group;
  if (body.value !== undefined) {
    payload.value =
      typeof body.value === "string"
        ? body.value
        : body.value === null
          ? ""
          : typeof body.value === "object"
            ? JSON.stringify(body.value)
            : String(body.value);
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("settings").update(payload).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("settings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
