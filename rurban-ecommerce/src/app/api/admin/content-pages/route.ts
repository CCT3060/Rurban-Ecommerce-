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
  const { data, error } = await admin.from("content_pages").select("*").order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const body = (await request.json()) as {
    slug?: string;
    title?: string;
    content?: string;
    meta_title?: string | null;
    meta_description?: string | null;
    status?: "active" | "inactive";
  };
  if (!body.slug || !body.title || !body.content) {
    return NextResponse.json({ error: "slug, title and content are required" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("content_pages")
    .insert({
      slug: body.slug,
      title: body.title,
      content: body.content,
      meta_title: body.meta_title ?? null,
      meta_description: body.meta_description ?? null,
      status: body.status ?? "active",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
