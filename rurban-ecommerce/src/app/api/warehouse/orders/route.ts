import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";

export async function GET() {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const { data: warehouseProducts, error: productsError } = await admin
    .from("products")
    .select("id")
    .eq("warehouse_id", auth.context.warehouseId);

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 400 });
  }

  const productIds = (warehouseProducts ?? []).map((row) => row.id);
  if (productIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data: scopedItems, error: scopedItemsError } = await admin
    .from("order_items")
    .select("order_id, product_id")
    .in("product_id", productIds);

  if (scopedItemsError) {
    return NextResponse.json({ error: scopedItemsError.message }, { status: 400 });
  }

  const orderIds = Array.from(new Set((scopedItems ?? []).map((item) => item.order_id).filter(Boolean)));
  if (orderIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("*, user:profiles(full_name,email)")
    .in("id", orderIds)
    .order("created_at", { ascending: false });

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 400 });
  }

  const { data: orderItems, error: orderItemsError } = await admin
    .from("order_items")
    .select("id,order_id,product_id,name,quantity,price,variant_info")
    .in("order_id", orderIds)
    .in("product_id", productIds);

  if (orderItemsError) {
    return NextResponse.json({ error: orderItemsError.message }, { status: 400 });
  }

  type ScopedOrderItem = {
    id: string;
    order_id: string;
    product_id: string | null;
    name: string;
    quantity: number;
    price: number;
    variant_info: string | null;
  };

  const itemsByOrder = new Map<string, ScopedOrderItem[]>();
  for (const item of (orderItems ?? []) as ScopedOrderItem[]) {
    const existing = itemsByOrder.get(item.order_id) ?? [];
    existing.push(item);
    itemsByOrder.set(item.order_id, existing);
  }

  const scopedOrders = (orders ?? []).map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
  }));

  return NextResponse.json({ data: scopedOrders });
}
