import { NextResponse } from "next/server";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── PUT /api/warehouse/user-prices/[id] ─────────────────────────────────────
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as { custom_price?: unknown; status?: string; start_date?: string | null; end_date?: string | null };

  const updates: Record<string, unknown> = {};

  if (body.custom_price !== undefined) {
    const price = Number(body.custom_price);
    if (isNaN(price) || price < 0) {
      return NextResponse.json(
        { error: "custom_price must be a non-negative number" },
        { status: 400 }
      );
    }
    updates.custom_price = price;
  }

  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "inactive") {
      return NextResponse.json({ error: "status must be 'active' or 'inactive'" }, { status: 400 });
    }
    updates.status = body.status;
  }

  if ("start_date" in body) updates.start_date = body.start_date ?? null;
  if ("end_date" in body) updates.end_date = body.end_date ?? null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("user_product_prices")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 });
  if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  const { data: owner, error: ownerError } = await admin
    .from("profiles")
    .select("id, warehouse_id")
    .eq("id", existing.user_id)
    .maybeSingle() as unknown as { data: { id: string; warehouse_id: string | null } | null; error: { message: string } | null };

  if (ownerError) return NextResponse.json({ error: ownerError.message }, { status: 400 });
  if (!owner || owner.warehouse_id !== auth.context.warehouseId) {
    return NextResponse.json({ error: "Record does not belong to your warehouse" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("user_product_prices")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

// ─── DELETE /api/warehouse/user-prices/[id] ───────────────────────────────────
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("user_product_prices")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 });
  if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  const { data: owner, error: ownerError } = await admin
    .from("profiles")
    .select("id, warehouse_id")
    .eq("id", existing.user_id)
    .maybeSingle() as unknown as { data: { id: string; warehouse_id: string | null } | null; error: { message: string } | null };

  if (ownerError) return NextResponse.json({ error: ownerError.message }, { status: 400 });
  if (!owner || owner.warehouse_id !== auth.context.warehouseId) {
    return NextResponse.json({ error: "Record does not belong to your warehouse" }, { status: 403 });
  }

  const { error } = await admin.from("user_product_prices").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
