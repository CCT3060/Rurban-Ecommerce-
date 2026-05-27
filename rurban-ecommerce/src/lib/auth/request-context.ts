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

  const metadataRole =
    (user.app_metadata?.role as RequestRole | undefined) ??
    (user.user_metadata?.role as RequestRole | undefined);

  const profileRole = profile?.role as RequestRole | undefined;

  const trustedRole =
    metadataRole === "admin" || metadataRole === "warehouse_admin"
      ? metadataRole
      : profileRole ?? metadataRole ?? "user";

  const context: RequestContext = {
    userId: user.id,
    role: trustedRole,
    warehouseId: (profile?.warehouse_id as string | null | undefined) ?? null,
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
