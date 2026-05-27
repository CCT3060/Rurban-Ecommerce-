import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { product_id?: unknown; rating?: unknown; title?: unknown; comment?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const productId = String(body.product_id ?? "").trim();
  const rating = Number(body.rating);
  const title = String(body.title ?? "").trim();
  const comment = String(body.comment ?? "").trim();

  if (!productId) {
    return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }

  // Verify the user has a delivered order containing this product
  const { data: orderItems } = await admin
    .from("order_items")
    .select("order_id, orders!inner(user_id, status)")
    .eq("product_id", productId)
    .eq("orders.user_id", user.id)
    .eq("orders.status", "delivered")
    .limit(1);

  if (!orderItems || orderItems.length === 0) {
    return NextResponse.json({ error: "You can only review products from delivered orders" }, { status: 403 });
  }

  // Upsert review (one review per user per product)
  const { data: review, error } = await admin
    .from("reviews")
    .upsert(
      { user_id: user.id, product_id: productId, rating, title, comment, status: "pending" },
      { onConflict: "user_id,product_id" }
    )
    .select("id,rating,title,comment,status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Update product avg_rating and review_count
  const { data: allReviews } = await admin
    .from("reviews")
    .select("rating")
    .eq("product_id", productId)
    .eq("status", "approved");

  if (allReviews && allReviews.length > 0) {
    const avgRating = allReviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / allReviews.length;
    await admin
      .from("products")
      .update({ avg_rating: Math.round(avgRating * 100) / 100, review_count: allReviews.length })
      .eq("id", productId);
  }

  return NextResponse.json({ data: review });
}
