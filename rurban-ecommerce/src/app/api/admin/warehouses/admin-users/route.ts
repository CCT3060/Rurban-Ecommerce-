import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminContext } from "@/lib/auth/request-context";

function mapWarehouseSchemaError(errorMessage: string) {
  if (
    errorMessage.includes('relation "warehouses" does not exist') ||
    (errorMessage.includes("column") && errorMessage.includes("warehouse_id"))
  ) {
    return NextResponse.json(
      {
        error:
          "Warehouse schema is not migrated yet. Run supabase/migrations/20260420_warehouse_support.sql in Supabase SQL Editor first.",
      },
      { status: 500 }
    );
  }
  return null;
}

interface CreateWarehouseAdminBody {
  warehouse_id?: string;
  full_name?: string;
  email?: string;
  password?: string;
}

export async function POST(request: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as CreateWarehouseAdminBody;
  const warehouseId = body.warehouse_id?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();

  if (!warehouseId) {
    return NextResponse.json({ error: "Warehouse is required" }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: warehouse } = await admin
    .from("warehouses")
    .select("id")
    .eq("id", warehouseId)
    .maybeSingle();

  if (!warehouse) {
    return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
  }

  const { data: createdUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: body.full_name?.trim() || null,
    },
    app_metadata: {
      role: "warehouse_admin",
      warehouse_id: warehouseId, // stored in app_metadata (service-role-only) as authoritative fallback
    },
  });

  if (authError || !createdUser.user) {
    return NextResponse.json({ error: authError?.message || "Failed to create warehouse admin" }, { status: 400 });
  }

  // Use upsert so the profile row is created/updated atomically even if the
  // handle_new_user trigger hasn't committed yet (avoids silent 0-row updates).
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: createdUser.user.id,
        full_name: body.full_name?.trim() || null,
        email,
        role: "warehouse_admin",
        warehouse_id: warehouseId,
        is_active: true,
      },
      { onConflict: "id" }
    );

  if (profileError) {
    const mapped = mapWarehouseSchemaError(profileError.message);
    if (mapped) return mapped;
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({
    data: {
      id: createdUser.user.id,
      email,
      warehouse_id: warehouseId,
      role: "warehouse_admin",
    },
  });
}
