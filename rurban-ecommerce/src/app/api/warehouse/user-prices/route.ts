import { NextResponse } from "next/server";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

type UserPriceRow = {
  id: string;
  custom_price: number;
  status: string;
  created_at: string;
  updated_at: string;
  user: { id: string; full_name: string | null; email: string; phone: string | null } | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    price: number;
    sale_price: number | null;
    category_id: string;
    category: { id: string; name: string } | null;
  } | null;
};

// ─── GET /api/warehouse/user-prices ───────────────────────────────────────────
export async function GET(request: Request) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "";
  const productId = searchParams.get("productId") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const status = searchParams.get("status") ?? "";
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(10000, Math.max(1, parseInt(searchParams.get("limit") ?? "500", 10)));
  const offset = (page - 1) * limit;

  const admin = createAdminClient();

  const { data: warehouseUsers, error: warehouseUsersError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "user")
    .eq("user_type", "b2b")
    .eq("warehouse_id", auth.context.warehouseId!);

  if (warehouseUsersError) {
    return NextResponse.json({ error: warehouseUsersError.message }, { status: 400 });
  }

  const warehouseUserIds = (warehouseUsers ?? []).map((u) => u.id);
  if (warehouseUserIds.length === 0) {
    return NextResponse.json({ data: [], total: 0 });
  }

  let query = admin
    .from("user_product_prices")
    .select(
      `id, custom_price, status, created_at, updated_at,
       user:profiles!user_id(id, full_name, email, phone),
       product:products!product_id(id, name, sku, price, sale_price, category_id,
         category:categories!category_id(id, name))`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  query = query.in("user_id", warehouseUserIds);

  if (userId) query = query.eq("user_id", userId);
  if (productId) query = query.eq("product_id", productId);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let filtered = (data ?? []) as UserPriceRow[];

  if (categoryId) {
    filtered = filtered.filter((r) => r.product?.category_id === categoryId);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        (r.user?.full_name ?? "").toLowerCase().includes(q) ||
        (r.user?.email ?? "").toLowerCase().includes(q) ||
        (r.user?.phone ?? "").toLowerCase().includes(q) ||
        (r.product?.name ?? "").toLowerCase().includes(q) ||
        (r.product?.sku ?? "").toLowerCase().includes(q)
    );
  }

  return NextResponse.json({ data: filtered, total: count ?? filtered.length });
}

// ─── POST /api/warehouse/user-prices ──────────────────────────────────────────
export async function POST(request: Request) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    user_id?: string;
    product_id?: string;
    custom_price?: unknown;
    status?: string;
    start_date?: string | null;
    end_date?: string | null;
  };

  const userId = String(body.user_id ?? "").trim();
  const productId = String(body.product_id ?? "").trim();
  const customPrice = Number(body.custom_price);
  const status = body.status === "inactive" ? "inactive" : "active";
  const startDate = body.start_date ?? null;
  const endDate = body.end_date ?? null;

  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  if (!productId) return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  if (isNaN(customPrice) || customPrice < 0) {
    return NextResponse.json({ error: "custom_price must be a non-negative number" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: user, error: userError } = await admin
    .from("profiles")
    .select("id, role, user_type, warehouse_id")
    .eq("id", userId)
    .maybeSingle();
  if (userError || !user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.role !== "user" || user.user_type !== "b2b") {
    return NextResponse.json({ error: "Selected user is not a B2B customer" }, { status: 400 });
  }
  if (user.warehouse_id !== auth.context.warehouseId) {
    return NextResponse.json({ error: "User does not belong to your warehouse" }, { status: 403 });
  }

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();
  if (productError || !product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const { data, error } = await admin
    .from("user_product_prices")
    .insert({
      user_id: userId,
      product_id: productId,
      custom_price: customPrice,
      status,
      ...(startDate ? { start_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {}),
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A custom price for this user and product already exists. Edit the existing record." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
