import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  // Verify this order contains at least one product belonging to this warehouse
  const { data: warehouseProducts } = await admin
    .from("products")
    .select("id")
    .eq("warehouse_id", auth.context.warehouseId);

  const productIds = (warehouseProducts ?? []).map((p) => p.id);

  const { data: scopedCheck } = await admin
    .from("order_items")
    .select("order_id")
    .eq("order_id", id)
    .in("product_id", productIds)
    .limit(1);

  if (!scopedCheck || scopedCheck.length === 0) {
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

  // Fetch only the items that belong to this warehouse
  const { data: items, error: itemsError } = await admin
    .from("order_items")
    .select("id,name,quantity,price,variant_info,image_url,product_id")
    .eq("order_id", id)
    .in("product_id", productIds);

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

  // Verify warehouse owns an item in this order
  const { data: warehouseProducts } = await admin
    .from("products")
    .select("id")
    .eq("warehouse_id", auth.context.warehouseId);

  const productIds = (warehouseProducts ?? []).map((p) => p.id);

  const { data: scopedCheck } = await admin
    .from("order_items")
    .select("order_id")
    .eq("order_id", id)
    .in("product_id", productIds)
    .limit(1);

  if (!scopedCheck || scopedCheck.length === 0) {
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
