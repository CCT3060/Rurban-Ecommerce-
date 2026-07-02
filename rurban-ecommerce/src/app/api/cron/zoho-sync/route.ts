/**
 * GET /api/cron/zoho-sync
 *
 * Called by Vercel Cron (or any external cron service) on a schedule.
 * Secured via CRON_SECRET environment variable.
 *
 * Vercel cron.json example:
 * {
 *   "crons": [
 *     { "path": "/api/cron/zoho-sync", "schedule": "0 * * * *" }
 *   ]
 * }
 *
 * Set CRON_SECRET to a random secret (e.g. openssl rand -hex 32) and pass it
 * as Authorization: Bearer <CRON_SECRET> from your cron caller,
 * OR configure Vercel Cron which sets the CRON_SECRET automatically.
 */
import { NextResponse } from "next/server";
import { syncZohoProducts } from "@/lib/zoho/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  // Require cron secret — fail closed if not configured.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET env var is not configured" }, { status: 500 });
  }
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Skip if Zoho is not configured
  if (
    !process.env.ZOHO_CLIENT_ID ||
    !process.env.ZOHO_CLIENT_SECRET ||
    !process.env.ZOHO_REFRESH_TOKEN ||
    !process.env.ZOHO_ORG_ID
  ) {
    return NextResponse.json({ skipped: true, reason: "Zoho not configured" });
  }

  const result = await syncZohoProducts();

  // Persist last-sync result
  const admin = createAdminClient();
  await admin.from("settings").upsert(
    {
      key: "zoho_last_sync_result",
      value: JSON.stringify({ ...result, syncedAt: new Date().toISOString() }),
      type: "json",
      group: "zoho",
    },
    { onConflict: "key" }
  );

  return NextResponse.json({ data: result });
}
