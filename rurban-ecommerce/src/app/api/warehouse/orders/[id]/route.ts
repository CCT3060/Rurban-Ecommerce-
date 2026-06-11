import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";

/** Returns true if the given order is accessible by this warehouse.
 * An order is accessible if it contains a warehouse product OR was placed
 * by a B2B user who belongs to this warehouse. */
async function isOrderAccessible(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  warehouseId: string
): Promise<boolean> {
  // Check 1: order placed by a B2B user of this warehouse
  const { data: orderRow } = await admin
    .from("orders")
    .select("user_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderRow?.user_id) {
    const { data: userProfile } = await admin
      .from("profiles")
      .select("warehouse_id, user_type")
      .eq("id", orderRow.user_id)
      .maybeSingle();

    if (
      userProfile?.warehouse_id === warehouseId &&
      userProfile?.user_type === "b2b"
    ) {
      return true;
    }
  }

  // Check 2: order contains a product assigned to this warehouse
  const { data: warehouseProducts } = await admin
    .from("products")
    .select("id")
    .eq("warehouse_id", warehouseId);

  const productIds = (warehouseProducts ?? []).map((p) => p.id);
  if (productIds.length === 0) return false;

  const { data: scopedCheck } = await admin
    .from("order_items")
    .select("order_id")
    .eq("order_id", orderId)
    .in("product_id", productIds)
    .limit(1);

  return (scopedCheck ?? []).length > 0;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();
  const warehouseId = auth.context.warehouseId!;

  const accessible = await isOrderAccessible(admin, id, warehouseId);
  if (!accessible) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Fetch full order details
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("*, user:profiles(full_name,email,phone)")
    .eq("id", id)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Order not found" }, { status: 404 });
  }

  // Fetch all items for this order
  const { data: items, error: itemsError } = await admin
    .from("order_items")
    .select("id,name,quantity,price,variant_info,image_url,product_id")
    .eq("order_id", id);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  return NextResponse.json({ data: { ...order, items: items ?? [] } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const body = (await request.json()) as { status?: string };
  const allowedStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

  if (!body.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createAdminClient();
  const warehouseId = auth.context.warehouseId!;

  const accessible = await isOrderAccessible(admin, id, warehouseId);
  if (!accessible) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("orders")
    .update({ status: body.status })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
