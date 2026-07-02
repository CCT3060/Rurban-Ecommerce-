/**
 * POST /api/admin/warehouses/import-zoho
 * Imports a single warehouse from Zoho Books into the local warehouses table.
 * Body: { warehouse_id, warehouse_name, email, is_primary, status, phone,
 *         city, state, zip, country, address_line }
 *
 * POST /api/admin/warehouses/import-zoho?all=1
 * Fetches ALL Zoho warehouses and upserts them all at once.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminContext } from "@/lib/auth/request-context";
import { zohoGet } from "@/lib/zoho/client";

interface ZohoWarehouseAddress {
  attention?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

interface ZohoWarehouse {
  warehouse_id: string;
  warehouse_name: string;
  email?: string;
  is_primary?: boolean;
  status?: string;
  created_time?: string;
  address?: ZohoWarehouseAddress;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

interface ZohoWarehousesResponse {
  code: number;
  message: string;
  warehouses?: ZohoWarehouse[];
}

interface ImportBody {
  warehouse_id?: string;
  warehouse_name?: string;
  email?: string | null;
  is_primary?: boolean;
  status?: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  address_line?: string | null;
}

function makeCode(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function zohoToLocalRow(w: ZohoWarehouse) {
  const name = w.warehouse_name?.trim() || "Unnamed Warehouse";
  const code = makeCode(name);
  const city = w.address?.city ?? w.city ?? null;
  const state = w.address?.state ?? w.state ?? null;
  const locationParts = [city, state].filter(Boolean);
  return {
    name,
    code,
    location: locationParts.join(", ") || null,
    state: state ?? null,
    manager_name: null as string | null,
    manager_email: w.email?.trim() || null,
    is_active: (w.status ?? "active") === "active",
    zoho_warehouse_id: w.warehouse_id,
  };
}

export async function POST(request: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const importAll = searchParams.get("all") === "1";

  if (
    !process.env.ZOHO_CLIENT_ID ||
    !process.env.ZOHO_CLIENT_SECRET ||
    !process.env.ZOHO_REFRESH_TOKEN ||
    !process.env.ZOHO_ORG_ID
  ) {
    return NextResponse.json(
      { error: "Zoho Books is not configured." },
      { status: 422 }
    );
  }

  const admin = createAdminClient();

  if (importAll) {
    // Fetch all warehouses from Zoho and upsert
    let zohoWarehouses: ZohoWarehouse[] = [];
    try {
      const res = await zohoGet<ZohoWarehousesResponse>("/settings/warehouses");
      if (res.code !== 0) {
        return NextResponse.json({ error: `Zoho error: ${res.message}` }, { status: 502 });
      }
      zohoWarehouses = res.warehouses ?? [];
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 502 }
      );
    }

    if (zohoWarehouses.length === 0) {
      return NextResponse.json({ data: { imported: 0, skipped: 0, warehouses: [] } });
    }

    const rows = zohoWarehouses.map(zohoToLocalRow);
    let imported = 0;
    const importedWarehouses: unknown[] = [];

    for (const row of rows) {
      // Check if already exists by zoho_warehouse_id
      const { data: existing } = await admin
        .from("warehouses")
        .select("id")
        .eq("zoho_warehouse_id", row.zoho_warehouse_id)
        .maybeSingle();

      if (existing) {
        // Update
        await admin
          .from("warehouses")
          .update({ name: row.name, location: row.location, state: row.state, manager_email: row.manager_email, is_active: row.is_active })
          .eq("id", existing.id);
      } else {
        // Insert — generate unique code if collision
        let code = row.code;
        const { data: codeConflict } = await admin
          .from("warehouses")
          .select("id")
          .eq("code", code)
          .maybeSingle();

        if (codeConflict) {
          code = `${code}-${row.zoho_warehouse_id.slice(-4)}`;
        }

        const { data: created, error: insertError } = await admin
          .from("warehouses")
          .insert({ ...row, code })
          .select("id, name, code")
          .single();

        if (!insertError && created) {
          imported++;
          importedWarehouses.push(created);
        }
      }
    }

    return NextResponse.json({
      data: {
        imported,
        updated: zohoWarehouses.length - imported,
        warehouses: importedWarehouses,
      },
    });
  }

  // Single import
  const body = (await request.json()) as ImportBody;
  const zohoWarehouseId = body.warehouse_id?.trim();
  const warehouseName = body.warehouse_name?.trim();

  if (!zohoWarehouseId || !warehouseName) {
    return NextResponse.json(
      { error: "warehouse_id and warehouse_name are required" },
      { status: 400 }
    );
  }

  // Check if already imported
  const { data: existing } = await admin
    .from("warehouses")
    .select("id, name")
    .eq("zoho_warehouse_id", zohoWarehouseId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `This warehouse is already imported as "${existing.name}".` },
      { status: 409 }
    );
  }

  let code = makeCode(warehouseName);
  const { data: codeConflict } = await admin
    .from("warehouses")
    .select("id")
    .eq("code", code)
    .maybeSingle();

  if (codeConflict) {
    code = `${code}-${zohoWarehouseId.slice(-4)}`;
  }

  const locationParts = [body.city, body.state].filter(Boolean);

  const { data, error } = await admin
    .from("warehouses")
    .insert({
      name: warehouseName,
      code,
      location: locationParts.join(", ") || null,
      state: body.state ?? null,
      manager_name: null,
      manager_email: body.email ?? null,
      is_active: (body.status ?? "active") === "active",
      zoho_warehouse_id: zohoWarehouseId,
    })
    .select("*")
    .single();

  if (error) {
    // If zoho_warehouse_id column doesn't exist yet, fall back without it
    if (error.message.includes("zoho_warehouse_id")) {
      const { data: data2, error: error2 } = await admin
        .from("warehouses")
        .insert({
          name: warehouseName,
          code,
          location: locationParts.join(", ") || null,
          state: body.state ?? null,
          manager_name: null,
          manager_email: body.email ?? null,
          is_active: (body.status ?? "active") === "active",
        })
        .select("*")
        .single();
      if (error2) return NextResponse.json({ error: error2.message }, { status: 400 });
      return NextResponse.json({ data: data2 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
