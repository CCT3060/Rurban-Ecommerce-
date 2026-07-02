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

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { data, error } = await admin.from("settings").select("*").order("key", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const body = (await request.json()) as { key?: string; value?: string | number | boolean | Record<string, unknown> | null; type?: string; group?: string };
  if (!body.key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  const normalizedValue =
    typeof body.value === "string"
      ? body.value
      : body.value === null || body.value === undefined
        ? ""
        : typeof body.value === "object"
          ? JSON.stringify(body.value)
          : String(body.value);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("settings")
    .upsert(
      {
        key: body.key,
        value: normalizedValue,
        type: body.type ?? "text",
        group: body.group ?? "general",
      },
      { onConflict: "key" }
    )
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
