import { NextResponse } from "next/server";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  // Verify the user belongs to this warehouse before deleting
  const { data: profile } = await admin
    .from("profiles")
    .select("id, warehouse_id")
    .eq("id", id)
    .maybeSingle() as unknown as { data: { id: string; warehouse_id: string | null } | null };

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (profile.warehouse_id !== auth.context.warehouseId) {
    return NextResponse.json({ error: "User does not belong to your warehouse" }, { status: 403 });
  }

  // deleteUser removes from auth.users which cascades to profiles and user_product_prices
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
