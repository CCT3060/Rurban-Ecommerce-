import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/auth/request-context";
import { generateInviteToken } from "@/lib/invite-token";

// Simple in-memory rate limit: max 10 invite links per admin per hour.
// NOTE: resets on server restart; use a shared store (Redis) for multi-instance deployments.
const inviteRateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10;

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (inviteRateLimit.get(userId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  inviteRateLimit.set(userId, recent);
  return false;
}

// GET /api/admin/b2b-invite — generate a time-limited onboarding link for a new B2B customer
export async function GET() {
  const ctx = await requireAdminContext();
  if (!ctx.ok) {
    return ctx.response;
  }

  if (isRateLimited(ctx.context.userId)) {
    return NextResponse.json(
      { error: "Too many invite links generated. Please wait before generating more." },
      { status: 429 }
    );
  }

  const token = generateInviteToken(7); // valid for 7 days
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const link = `${base}/onboarding/register?invite=${token}`;

  return NextResponse.json({ link, expiresInDays: 7 });
}
