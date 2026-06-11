/**
 * POST /api/admin/setup/migrate
 *
 * One-time migration: adds extended Zoho fields to the products table.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */
import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MIGRATION_SQL = `
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hsn_or_sac            text,
  ADD COLUMN IF NOT EXISTS product_type          text,
  ADD COLUMN IF NOT EXISTS zoho_category_name    text,
  ADD COLUMN IF NOT EXISTS intra_state_tax_name  text,
  ADD COLUMN IF NOT EXISTS intra_state_tax_rate  numeric(10,2),
  ADD COLUMN IF NOT EXISTS intra_state_tax_type  text,
  ADD COLUMN IF NOT EXISTS inter_state_tax_name  text,
  ADD COLUMN IF NOT EXISTS inter_state_tax_rate  numeric(10,2),
  ADD COLUMN IF NOT EXISTS zoho_unit             text,
  ADD COLUMN IF NOT EXISTS zoho_item_type        text;
`;

export async function POST() {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  // Use Supabase's rpc to run raw SQL via pg_catalog
  // Supabase admin client exposes .rpc() for calling Postgres functions.
  // We use the built-in sql query via a workaround: insert into a temp exec.
  // Actually we use the REST API directly with the service role key.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Supabase doesn't expose raw SQL via JS client — use the SQL API endpoint
  // which requires the Postgres connection. Instead, check if columns exist
  // by trying to select them, and insert a placeholder function call.
  
  // Check if migration already applied by seeing if column exists
  const { error: checkError } = await admin
    .from("products")
    .select("hsn_or_sac")
    .limit(1);

  if (!checkError) {
    // Column already exists — migration already applied
    return NextResponse.json({ message: "Migration already applied. Columns exist." });
  }

  // Column doesn't exist — run migration via Supabase Management API (SQL endpoint)
  // This requires a Supabase access token (SUPABASE_ACCESS_TOKEN) not the service role key.
  // Fallback: use the direct REST SQL execution endpoint available via service role.

  // Try via Supabase's /rest/v1/rpc approach using a helper function if available
  // Otherwise, return instructions.
  
  // The most reliable way without direct DB access: use pg_query via service role
  const sqlEndpoint = `${supabaseUrl}/rest/v1/rpc/exec_migration`;
  const resp = await fetch(sqlEndpoint, {
    method: "POST",
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql: MIGRATION_SQL }),
  });

  if (!resp.ok) {
    // Return the SQL for manual execution
    return NextResponse.json(
      {
        error: "Automatic migration not possible. Please run the following SQL in your Supabase dashboard (SQL Editor):",
        sql: MIGRATION_SQL.trim(),
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ message: "Migration applied successfully." });
}
