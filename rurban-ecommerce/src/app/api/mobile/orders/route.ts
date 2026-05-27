import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: orders, error } = await admin
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      payment_status,
      payment_method,
      subtotal,
      discount,
      shipping_cost,
      total,
      shipping_address,
      notes,
      created_at,
      updated_at,
      order_items (
        id,
        product_id,
        name,
        price,
        quantity,
        image_url,
        variant_info
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Check which delivered orders the user has NOT yet reviewed
  const deliveredOrderIds = (orders ?? [])
    .filter((o: { status: string }) => o.status === "delivered")
    .map((o: { id: string }) => o.id);

  let pendingReviews: { order_id: string; product_id: string; product_name: string; image_url: string | null }[] = [];

  if (deliveredOrderIds.length > 0) {
    const { data: deliveredItems } = await admin
      .from("order_items")
      .select("order_id,product_id,name,image_url")
      .in("order_id", deliveredOrderIds)
      .not("product_id", "is", null);

    if (deliveredItems && deliveredItems.length > 0) {
      const productIds = [...new Set(deliveredItems.map((i: { product_id: string }) => i.product_id))];
      const { data: existingReviews } = await admin
        .from("reviews")
        .select("product_id")
        .eq("user_id", user.id)
        .in("product_id", productIds);

      const reviewedProductIds = new Set((existingReviews ?? []).map((r: { product_id: string }) => r.product_id));
      pendingReviews = (deliveredItems as Array<{ order_id: string; product_id: string; name: string; image_url: string | null }>)
        .filter(i => !reviewedProductIds.has(i.product_id))
        .map(i => ({
          order_id: i.order_id,
          product_id: i.product_id,
          product_name: i.name,
          image_url: i.image_url,
        }));
    }
  }

  return NextResponse.json({ data: orders ?? [], pending_reviews: pendingReviews });
}
