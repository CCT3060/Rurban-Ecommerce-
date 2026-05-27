/**
 * Zoho Books API client
 *
 * Uses Client Credentials / Refresh Token flow.
 * Access tokens expire in 1 hour; this module auto-refreshes them and
 * caches the current token in memory for the lifetime of the server process.
 *
 * Required environment variables:
 *   ZOHO_CLIENT_ID          – from Zoho API Console
 *   ZOHO_CLIENT_SECRET      – from Zoho API Console
 *   ZOHO_REFRESH_TOKEN      – long-lived refresh token (see README)
 *   ZOHO_ORG_ID             – your Zoho Books organisation ID
 *   ZOHO_REGION             – "in" | "com" | "eu" | "au" | "jp" (default "in")
 */

const ZOHO_REGION = (process.env.ZOHO_REGION ?? "in").toLowerCase();

/** OAuth token endpoint — always on accounts.zoho.<region> */
const TOKEN_URL = `https://accounts.zoho.${ZOHO_REGION}/oauth/v2/token`;

/**
 * Zoho Books REST base — must use zohoapis.<region>, not books.zoho.<region>
 * Docs: https://www.zoho.com/books/api/v3/introduction/#base-url
 */
const ZOHOAPIS_HOST: Record<string, string> = {
  in:  "www.zohoapis.in",
  com: "www.zohoapis.com",
  eu:  "www.zohoapis.eu",
  au:  "www.zohoapis.com.au",
  jp:  "www.zohoapis.jp",
};
export const ZOHO_API_BASE = `https://${ZOHOAPIS_HOST[ZOHO_REGION] ?? "www.zohoapis.in"}/books/v3`;

// ── In-process token cache ────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0; // unix ms

async function fetchAccessToken(): Promise<string> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Zoho credentials not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN."
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho token refresh failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!json.access_token) {
    throw new Error(`Zoho token refresh error: ${json.error ?? "unknown"}`);
  }

  // Cache with a 5-minute safety margin before real expiry
  const expiresIn = (json.expires_in ?? 3600) - 300;
  cachedToken = json.access_token;
  tokenExpiresAt = Date.now() + expiresIn * 1000;

  return cachedToken;
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  return fetchAccessToken();
}

// ── Typed API caller ──────────────────────────────────────────────────────────

export async function zohoGet<T>(
  path: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const orgId = process.env.ZOHO_ORG_ID;
  if (!orgId) throw new Error("ZOHO_ORG_ID environment variable is not set.");

  const token = await getAccessToken();
  const url = new URL(`${ZOHO_API_BASE}${path}`);
  url.searchParams.set("organization_id", orgId);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    // Next.js: don't cache; always fetch fresh data from Zoho
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho API error ${res.status} on ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}
