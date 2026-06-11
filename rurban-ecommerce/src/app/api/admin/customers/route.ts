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

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const userType = searchParams.get("user_type") ?? "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (admin as any).from("profiles").select("*").eq("role", "user").order("created_at", { ascending: false });
  if (userType) q = q.eq("user_type", userType);
  const { data, error } = await q;
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

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    full_name?: string;
    email?: string;
    phone?: string;
    password?: string;
  };

  const full_name = String(body.full_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim() || null;
  const password = String(body.password ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, phone },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Update profile: set full_name, phone, and mark as B2B
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin
    .from("profiles")
    .update({ full_name: full_name || null, phone, user_type: "b2b" } as unknown as never) as any)
    .eq("id", authData.user.id);

  // Set app_metadata so user_type is available in the JWT without a DB query
  await admin.auth.admin.updateUserById(authData.user.id, {
    app_metadata: { user_type: "b2b" },
  });

  return NextResponse.json({ data: { id: authData.user.id, email, full_name } }, { status: 201 });
}
