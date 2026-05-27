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
  const { data, error } = await admin.from("profiles").select("*").eq("role", "user").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ids = (data ?? []).map((row) => row.id);
  const { data: orders } = await admin.from("orders").select("user_id,total").in("user_id", ids);
  const metrics = new Map<string, { orders: number; spent: number }>();
  for (const id of ids) metrics.set(id, { orders: 0, spent: 0 });
  for (const row of orders ?? []) {
    const metric = metrics.get(row.user_id as string);
    if (!metric) continue;
    metric.orders += 1;
    metric.spent += Number(row.total ?? 0);
  }

  const merged = (data ?? []).map((row) => ({ ...row, orders_count: metrics.get(row.id)?.orders ?? 0, spent_total: metrics.get(row.id)?.spent ?? 0 }));
  return NextResponse.json({ data: merged });
}
