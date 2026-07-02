import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10)));
  const offset = (page - 1) * limit;
  const admin = createAdminClient();
  const { data, error, count } = await admin
    .from("orders")
    .select("*, user:profiles(full_name,email), items:order_items(id)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit });
}
