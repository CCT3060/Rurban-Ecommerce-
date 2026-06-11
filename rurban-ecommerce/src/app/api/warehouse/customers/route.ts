import { NextResponse } from "next/server";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── GET /api/warehouse/customers ────────────────────────────────────────────
export async function GET() {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, email, phone")
    .eq("role", "user")
    .eq("user_type", "b2b")
    .eq("warehouse_id", auth.context.warehouseId!)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

// ─── POST /api/warehouse/customers ───────────────────────────────────────────
export async function POST(request: Request) {
  const auth = await requireWarehouseAdminContext();
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

  // Tag user with the warehouse and mark as B2B
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin
    .from("profiles")
    .update({
      full_name: full_name || null,
      phone,
      warehouse_id: auth.context.warehouseId,
      user_type: "b2b",
    } as unknown as never) as any)
    .eq("id", authData.user.id);

  // Set app_metadata so user_type is available in the JWT without a DB query
  await admin.auth.admin.updateUserById(authData.user.id, {
    app_metadata: { user_type: "b2b" },
  });

  return NextResponse.json({ data: { id: authData.user.id, email, full_name } }, { status: 201 });
}
