import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/lookup/[type]
 * Public read endpoint for lookup values (states, payment terms, GST treatments, etc.)
 * Accessible by any authenticated user (admin, warehouse_admin, b2b, regular).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  // Require authentication (any role)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("lookup_values")
    .select("id, value, sort_order, is_active")
    .eq("type", type)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("value", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}
