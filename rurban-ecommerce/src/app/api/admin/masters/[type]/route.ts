import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminContext } from "@/lib/auth/request-context";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lookup_values")
    .select("id, value, sort_order, is_active")
    .eq("type", type)
    .order("sort_order", { ascending: true })
    .order("value", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const { type } = await params;
  const body = (await request.json()) as { value?: string; sort_order?: number };
  const value = String(body.value ?? "").trim();

  if (!value) return NextResponse.json({ error: "Value is required" }, { status: 400 });

  const admin = createAdminClient();

  // Get next sort_order
  const { data: existing } = await admin
    .from("lookup_values")
    .select("sort_order")
    .eq("type", type)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = ((existing?.[0]?.sort_order as number | undefined) ?? 0) + 1;

  const { data, error } = await admin
    .from("lookup_values")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ type, value, sort_order: body.sort_order ?? nextOrder } as any)
    .select("id, value, sort_order, is_active")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `"${value}" already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
