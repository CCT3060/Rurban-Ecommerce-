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

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { data, error } = await admin.from("homepage_sections").select("*").order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const body = (await request.json()) as {
    title?: string;
    subtitle?: string | null;
    type?: string;
    config?: Record<string, unknown> | null;
    sort_order?: number;
    status?: "active" | "inactive";
  };
  if (!body.type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("homepage_sections")
    .insert({
      title: body.title ?? null,
      subtitle: body.subtitle ?? null,
      type: body.type,
      config: body.config ?? {},
      sort_order: body.sort_order ?? 0,
      status: body.status ?? "active",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
