import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToTokens } from "@/lib/push-notifications";

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"] as const;
type OrderStatus = typeof ORDER_STATUSES[number];

// GET /api/mobile/warehouse/orders
// Returns all orders for this warehouse (product-based OR B2B-user-based).
export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get the warehouse_id for this admin
  const { data: profile } = await admin
    .from("profiles")
    .select("role, warehouse_id")
    .eq("id", user.id)
    .maybeSingle() as unknown as { data: { role: string; warehouse_id: string | null } | null };

  if (!profile || profile.role !== "warehouse_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!profile.warehouse_id) {
    return NextResponse.json({ data: [] });
  }

  const warehouseId = profile.warehouse_id;
  const orderIdSet = new Set<string>();

  // Source 1: orders containing products assigned to this warehouse
  const { data: warehouseProducts } = await admin
    .from("products")
    .select("id")
    .eq("warehouse_id", warehouseId) as unknown as { data: { id: string }[] | null };

  const productIds = (warehouseProducts ?? []).map((p) => p.id);

  if (productIds.length > 0) {
    const { data: productOrderItems } = await admin
      .from("order_items")
      .select("order_id")
      .in("product_id", productIds) as unknown as { data: { order_id: string }[] | null };

    for (const item of productOrderItems ?? []) {
      if (item.order_id) orderIdSet.add(item.order_id);
    }
  }

  // Source 2: orders placed by B2B users belonging to this warehouse
  const { data: b2bUsers } = await admin
    .from("profiles")
    .select("id")
    .eq("warehouse_id", warehouseId)
    .eq("user_type", "b2b") as unknown as { data: { id: string }[] | null };

  const b2bUserIds = (b2bUsers ?? []).map((u) => u.id);

  if (b2bUserIds.length > 0) {
    const { data: b2bOrders } = await admin
      .from("orders")
      .select("id")
      .in("user_id", b2bUserIds) as unknown as { data: { id: string }[] | null };

    for (const o of b2bOrders ?? []) {
      orderIdSet.add(o.id);
    }
  }

  const orderIds = Array.from(orderIdSet);
  if (orderIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") ?? "";

  // Fetch orders
  let ordersQuery = admin
    .from("orders")
    .select("id, order_number, status, payment_status, payment_method, subtotal, discount, shipping_cost, total, shipping_address, notes, created_at, updated_at, user_id")
    .in("id", orderIds)
    .order("created_at", { ascending: false })
    .limit(500);

  if (statusFilter) ordersQuery = ordersQuery.eq("status", statusFilter);

  const { data: orders, error: ordersError } = await ordersQuery as unknown as {
    data: { id: string; order_number: string; status: string; payment_status: string; payment_method: string | null; subtotal: number; discount: number; shipping_cost: number; total: number; shipping_address: Record<string, string> | null; notes: string | null; created_at: string; updated_at: string; user_id: string }[] | null;
    error: { message: string } | null;
  };

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 400 });

  // Fetch all order items for these orders
  const { data: allItems } = await admin
    .from("order_items")
    .select("id, order_id, product_id, name, price, quantity, image_url, variant_info")
    .in("order_id", orderIds) as unknown as {
      data: { id: string; order_id: string; product_id: string | null; name: string; price: number; quantity: number; image_url: string | null; variant_info: string | null }[] | null
    };

  // Fetch customer profiles
  const userIds = [...new Set((orders ?? []).map((o) => o.user_id).filter(Boolean))];
  const { data: customers } = userIds.length > 0
    ? await admin.from("profiles").select("id, full_name, email, phone").in("id", userIds) as unknown as { data: { id: string; full_name: string | null; email: string; phone: string | null }[] | null }
    : { data: [] as { id: string; full_name: string | null; email: string; phone: string | null }[] };

  const customerMap = new Map((customers ?? []).map((c) => [c.id, c]));
  const itemsByOrder = new Map<string, typeof allItems>((orders ?? []).map((o) => [o.id, []]));
  for (const item of allItems ?? []) {
    itemsByOrder.get(item.order_id)?.push(item);
  }

  const result = (orders ?? []).map((o) => ({
    ...o,
    customer: customerMap.get(o.user_id) ?? null,
    order_items: itemsByOrder.get(o.id) ?? [],
  }));

  return NextResponse.json({ data: result });
}

// PATCH /api/mobile/warehouse/orders
// Update status of a single order (only if it belongs to this warehouse).
export async function PATCH(request: Request) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await admin
    .from("profiles")
    .select("role, warehouse_id")
    .eq("id", user.id)
    .maybeSingle() as unknown as { data: { role: string; warehouse_id: string | null } | null };

  if (!profile || profile.role !== "warehouse_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { order_id?: string; status?: string };
  const orderId = String(body.order_id ?? "").trim();
  const newStatus = String(body.status ?? "").trim() as OrderStatus;

  if (!orderId) return NextResponse.json({ error: "order_id is required" }, { status: 400 });
  if (!ORDER_STATUSES.includes(newStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await admin
    .from("orders")
    .update({ status: newStatus } as unknown as never)
    .eq("id", orderId) as unknown as { error: { message: string } | null };

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Notify the customer about their order status change (fire and forget)
  void (async () => {
    try {
      const STATUS_MESSAGES: Partial<Record<OrderStatus, { title: string; body: string }>> = {
        confirmed:  { title: "Order Confirmed ✅", body: `Your order ${orderId} has been confirmed and is being prepared.` },
        processing: { title: "Order Processing 🔧", body: `Your order is being processed and will be shipped soon.` },
        shipped:    { title: "Order Shipped 🚚", body: `Great news! Your order is on its way.` },
        delivered:  { title: "Order Delivered 🎉", body: `Your order has been delivered. Enjoy!` },
        cancelled:  { title: "Order Cancelled ❌", body: `Your order has been cancelled.` },
      };

      const msg = STATUS_MESSAGES[newStatus];
      if (!msg) return;

      // Get the order's user_id and order_number
      const { data: orderRow } = await admin
        .from("orders")
        .select("user_id, order_number")
        .eq("id", orderId)
        .maybeSingle() as unknown as { data: { user_id: string; order_number: string } | null };

      if (!orderRow) return;

      // Get the user's push token
      const { data: userProfile } = await admin
        .from("profiles")
        .select("push_token")
        .eq("id", orderRow.user_id)
        .maybeSingle() as unknown as { data: { push_token: string | null } | null };

      if (userProfile?.push_token) {
        await sendPushToTokens(
          [userProfile.push_token],
          msg.title,
          msg.body.replace(orderId, orderRow.order_number),
          { screen: "Orders", order_number: orderRow.order_number }
        );
      }
    } catch {
      // Swallow — never break the status update response
    }
  })();

  return NextResponse.json({ success: true });
}
