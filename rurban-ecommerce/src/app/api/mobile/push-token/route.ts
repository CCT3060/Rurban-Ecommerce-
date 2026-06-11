import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

// POST /api/mobile/push-token
// Saves or clears the Expo push token for the authenticated user.
export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { push_token?: string | null };
  const pushToken = body.push_token ? String(body.push_token).trim() : null;

  // Validate it looks like an Expo push token
  if (pushToken && !pushToken.startsWith("ExponentPushToken[")) {
    return NextResponse.json({ error: "Invalid push token format" }, { status: 400 });
  }

  const { error } = await admin
    .from("profiles")
    .update({ push_token: pushToken } as unknown as never)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
