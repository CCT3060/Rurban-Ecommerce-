import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminContext } from "@/lib/auth/request-context";

function mapWarehouseSchemaError(errorMessage: string) {
  const message = errorMessage.toLowerCase();
  const missingWarehousesTable =
    message.includes('relation "warehouses" does not exist') ||
    message.includes('relation "public.warehouses" does not exist') ||
    message.includes("could not find the table 'public.warehouses' in the schema cache");

  const missingWarehouseColumn =
    message.includes("column") &&
    message.includes("warehouse_id") &&
    (message.includes("profiles") || message.includes("products") || message.includes("categories"));

  const missingStateColumn =
    message.includes("could not find the 'state' column") ||
    (message.includes("column") && message.includes("state") && message.includes("warehouses"));

  if (missingWarehousesTable || missingWarehouseColumn || missingStateColumn) {
    return {
      message:
        "Warehouse schema is not fully migrated. Please run all warehouse-related migrations in Supabase SQL Editor (20260420_warehouse_support.sql, 20260612_warehouse_state.sql, and 20260612_lookup_values.sql).",
    };
  }
  return null;
}

interface CreateWarehouseBody {
  name?: string;
  code?: string;
  location?: string | null;
  state?: string | null;
  manager_name?: string | null;
  manager_email?: string | null;
  is_active?: boolean;
}

export async function GET() {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("warehouses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    const mapped = mapWarehouseSchemaError(error.message);
    if (mapped) {
      return NextResponse.json(
        {
          data: [],
          setupRequired: true,
          message: mapped.message,
        },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as CreateWarehouseBody;
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Warehouse name is required" }, { status: 400 });
  }

  const code = (body.code?.trim() || name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")).slice(0, 40);
  if (!code) {
    return NextResponse.json({ error: "Warehouse code is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const payload = {
    name,
    code,
    location: body.location?.trim() || null,
    state: body.state?.trim() || null,
    manager_name: body.manager_name?.trim() || null,
    manager_email: body.manager_email?.trim() || null,
    is_active: body.is_active ?? true,
  };

  const { data, error } = await admin.from("warehouses").insert(payload).select("*").single();

  if (error) {
    const mapped = mapWarehouseSchemaError(error.message);
    if (mapped) {
      return NextResponse.json({ error: mapped.message, setupRequired: true }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
