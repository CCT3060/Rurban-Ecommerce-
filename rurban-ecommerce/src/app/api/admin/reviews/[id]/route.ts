import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = (user.app_metadata?.role as string | undefined) ?? (user.user_metadata?.role as string | undefined);
  if (role !== "admin") return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true as const };
}

async function syncProductRating(productId: string) {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("reviews")
    .select("rating")
    .eq("product_id", productId)
    .eq("status", "approved");

  const count = rows?.length ?? 0;
  const avg = count > 0
    ? rows!.reduce((sum, r) => sum + r.rating, 0) / count
    : 0;

  await admin
    .from("products")
    .update({
      avg_rating: Math.round(avg * 100) / 100,
      review_count: count,
    })
    .eq("id", productId);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = (await request.json()) as { status?: "pending" | "approved" | "rejected" };
  const admin = createAdminClient();
  const { data, error } = await admin.from("reviews").update({ status: body.status }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Recalculate avg_rating and review_count for the affected product
  if (data?.product_id) {
    await syncProductRating(data.product_id as string);
  }

  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  // Fetch product_id before deleting so we can resync
  const { data: review } = await admin.from("reviews").select("product_id").eq("id", id).single();

  const { error } = await admin.from("reviews").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Recalculate after deletion
  if (review?.product_id) {
    await syncProductRating(review.product_id as string);
  }

  return NextResponse.json({ success: true });
}
