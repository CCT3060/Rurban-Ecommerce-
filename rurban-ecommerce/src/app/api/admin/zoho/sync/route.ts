/**
 * POST /api/admin/zoho/sync
 * Triggers a full Zoho Books → Supabase products sync.
 * Admin-only. Returns the sync result immediately (sync is synchronous).
 *
 * GET /api/admin/zoho/sync
 * Returns the last sync result stored in the `settings` table.
 */
import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncZohoProducts } from "@/lib/zoho/sync";

export const dynamic = "force-dynamic";
// Allow up to 5 minutes for a large catalog sync
export const maxDuration = 300;

export async function GET() {
  try {
    const auth = await requireAdminContext();
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("settings")
      .select("value")
      .eq("key", "zoho_last_sync_result")
      .maybeSingle();

    if (error) {
      console.error("[zoho/sync GET] settings query error:", error.message);
      return NextResponse.json({ data: null });
    }

    if (!data?.value) {
      return NextResponse.json({ data: null });
    }

    try {
      return NextResponse.json({ data: JSON.parse(data.value) });
    } catch {
      return NextResponse.json({ data: null });
    }
  } catch (err) {
    console.error("[zoho/sync GET] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const auth = await requireAdminContext();
    if (!auth.ok) return auth.response;

    // Check Zoho is configured
    if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET || !process.env.ZOHO_REFRESH_TOKEN || !process.env.ZOHO_ORG_ID) {
      return NextResponse.json(
        { error: "Zoho Books is not configured. Add ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, and ZOHO_ORG_ID to your environment variables." },
        { status: 422 }
      );
    }

    const result = await syncZohoProducts();

    // Persist the result so the admin panel can show it
    const admin = createAdminClient();
    const { error: upsertError } = await admin.from("settings").upsert(
      {
        key: "zoho_last_sync_result",
        value: JSON.stringify({ ...result, syncedAt: new Date().toISOString() }),
        type: "json",
        group: "zoho",
      },
      { onConflict: "key" }
    );

    if (upsertError) {
      console.error("[zoho/sync POST] failed to persist result:", upsertError.message);
    }

    const httpStatus =
      result.errors.length > 0 && result.created === 0 && result.updated === 0 ? 500 : 200;

    return NextResponse.json({ data: result }, { status: httpStatus });
  } catch (err) {
    console.error("[zoho/sync POST] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: String(err) },
      { status: 500 }
    );
  }
}
