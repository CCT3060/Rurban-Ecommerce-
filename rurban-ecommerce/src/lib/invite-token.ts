/**
 * Stateless HMAC-signed invite tokens for B2B customer self-registration.
 * No database required for generation — token validity is encoded in a signed payload.
 * For single-use enforcement, call consumeInviteToken() at registration time.
 */
import { createHmac, createHash, timingSafeEqual } from "crypto";

/** Minimal Supabase-compatible client interface needed for token consumption. */
interface AdminDb {
  from(table: string): {
    insert(row: Record<string, unknown>): Promise<{ error: { code?: string; message?: string } | null }>;
  };
}

/** Optional metadata that can be embedded in the invite token payload. */
export type InviteTokenMeta = {
  warehouse_id?: string | null;
};

function getSecret(): string {
  const secret = process.env.INVITE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "INVITE_SECRET environment variable is required for invite token signing."
    );
  }
  if (!process.env.INVITE_SECRET) {
    console.warn(
      "[invite-token] INVITE_SECRET is not set; falling back to SUPABASE_SERVICE_ROLE_KEY. " +
        "Set a dedicated INVITE_SECRET to decouple invite validity from service key rotation."
    );
  }
  return secret;
}

export function generateInviteToken(expiryDays = 7, meta: InviteTokenMeta = {}): string {
  const exp = Date.now() + expiryDays * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp, type: "b2b_invite", ...meta })).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyInviteToken(token: string): { valid: boolean; error?: string; meta?: InviteTokenMeta } {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return { valid: false, error: "Malformed token" };
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", getSecret()).update(payload).digest("base64url");
    // Constant-time comparison prevents timing attacks on the HMAC signature.
    const sigBuf = Buffer.from(sig, "base64url");
    const expectedBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, error: "Invalid token" };
    }
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: number; warehouse_id?: string };
    if (Date.now() > decoded.exp) return { valid: false, error: "Link has expired" };
    const meta: InviteTokenMeta = { warehouse_id: decoded.warehouse_id ?? null };
    return { valid: true, meta };
  } catch {
    return { valid: false, error: "Invalid token" };
  }
}

/**
 * Verify and atomically consume an invite token (single-use enforcement).
 * Stores a SHA-256 hash of the token in invite_tokens_used; a duplicate insert
 * (unique violation code 23505) means the link has already been redeemed.
 *
 * Use this at registration time instead of verifyInviteToken().
 * Returns the decoded token metadata (e.g. warehouse_id) on success.
 */
export async function consumeInviteToken(
  token: string,
  admin: AdminDb
): Promise<{ valid: boolean; error?: string; meta?: InviteTokenMeta }> {
  const check = verifyInviteToken(token);
  if (!check.valid) return check;

  const hash = createHash("sha256").update(token).digest("hex");
  const { error } = await admin.from("invite_tokens_used").insert({ token_hash: hash });

  if (error) {
    if (error.code === "23505") {
      return { valid: false, error: "Invite link has already been used" };
    }
    // Fail-closed on unexpected DB errors to prevent silent reuse.
    console.error("[consumeInviteToken] Failed to record token usage:", error.message);
    return { valid: false, error: "Could not process invite link. Please try again." };
  }

  return { valid: true, meta: check.meta };
}
