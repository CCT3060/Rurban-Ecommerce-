import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";

export async function GET() {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const warehouseId = auth.context.warehouseId!;

  // Collect order IDs from two sources and union them:
  // 1. Orders containing products assigned to this warehouse
  // 2. Orders placed by B2B users who belong to this warehouse
  const orderIdSet = new Set<string>();

  // Source 1: product-based — orders that contain warehouse-specific products
  const { data: warehouseProducts } = await admin
    .from("products")
    .select("id")
    .eq("warehouse_id", warehouseId);

  const productIds = (warehouseProducts ?? []).map((row) => row.id);

  if (productIds.length > 0) {
    const { data: productBasedItems, error: productsError } = await admin
      .from("order_items")
      .select("order_id")
      .in("product_id", productIds);

    if (productsError) {
      return NextResponse.json({ error: productsError.message }, { status: 400 });
    }

    for (const item of productBasedItems ?? []) {
      if (item.order_id) orderIdSet.add(item.order_id);
    }
  }

  // Source 2: user-based — orders placed by B2B users belonging to this warehouse
  const { data: warehouseB2BUsers, error: usersError } = await admin
    .from("profiles")
    .select("id")
    .eq("warehouse_id", warehouseId)
    .eq("user_type", "b2b");

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 400 });
  }

  const b2bUserIds = (warehouseB2BUsers ?? []).map((u) => u.id);

  if (b2bUserIds.length > 0) {
    const { data: userBasedOrders, error: userOrdersError } = await admin
      .from("orders")
      .select("id")
      .in("user_id", b2bUserIds);

    if (userOrdersError) {
      return NextResponse.json({ error: userOrdersError.message }, { status: 400 });
    }

    for (const order of userBasedOrders ?? []) {
      orderIdSet.add(order.id);
    }
  }

  const orderIds = Array.from(orderIdSet);
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

  // Fetch all items for these orders (no product restriction — show full order)
  const { data: orderItems, error: orderItemsError } = await admin
    .from("order_items")
    .select("id,order_id,product_id,name,quantity,price,variant_info")
    .in("order_id", orderIds);

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
