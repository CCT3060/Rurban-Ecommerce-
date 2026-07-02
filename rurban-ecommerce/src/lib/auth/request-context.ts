import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RequestRole = "user" | "admin" | "warehouse_admin" | string;

export type RequestContext = {
  userId: string;
  role: RequestRole;
  warehouseId: string | null;
};

export async function getRequestContext() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role,warehouse_id")
    .eq("id", user.id)
    .maybeSingle();

  // Only trust app_metadata (set by service role / admin operations).
  // NEVER fall back to user_metadata — it is user-controlled and can be spoofed.
  const metadataRole = user.app_metadata?.role as RequestRole | undefined;

  const profileRole = profile?.role as RequestRole | undefined;

  // DB profile is the authoritative source; app_metadata is a trusted fallback.
  const trustedRole = profileRole ?? metadataRole ?? "user";

  // Prefer the DB profile value; fall back to app_metadata.warehouse_id which is
  // set by the service role at creation time and cannot be spoofed by users.
  const warehouseId =
    (profile?.warehouse_id as string | null | undefined) ??
    (user.app_metadata?.warehouse_id as string | null | undefined) ??
    null;

  const context: RequestContext = {
    userId: user.id,
    role: trustedRole,
    warehouseId,
  };

  return {
    ok: true as const,
    context,
  };
}

export async function requireAdminContext() {
  const auth = await getRequestContext();
  if (!auth.ok) return auth;
  if (auth.context.role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return auth;
}

export async function requireWarehouseAdminContext() {
  const auth = await getRequestContext();
  if (!auth.ok) return auth;
  if (auth.context.role !== "warehouse_admin" || !auth.context.warehouseId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return auth;
}
