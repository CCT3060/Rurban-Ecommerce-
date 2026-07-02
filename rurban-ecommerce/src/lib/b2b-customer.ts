/**
 * Shared helpers for B2B customer creation:
 *  - buildCustomerToken: HMAC-signs the user ID so the public details link cannot be forged
 *  - verifyCustomerToken: verifies the signature and returns the userId or null
 *  - syncContactToZoho: creates/upserts a contact in Zoho Books
 *  - sendWelcomeEmail: sends a welcome email with login credentials and details link
 */
import { createHmac } from "crypto";
import { zohoPost } from "@/lib/zoho/client";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Customer link signing ─────────────────────────────────────────────────────

function getCustomerLinkSecret(): string {
  const secret = process.env.CUSTOMER_LINK_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "CUSTOMER_LINK_SECRET (or SUPABASE_SERVICE_ROLE_KEY) env var required for customer link signing."
    );
  }
  return secret;
}

/** Returns a tamper-proof HMAC-signed token: `<base64url-userId>.<hmac-sig>` */
export function buildCustomerToken(userId: string): string {
  const payload = Buffer.from(userId).toString("base64url");
  const sig = createHmac("sha256", getCustomerLinkSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/**
 * Verifies the HMAC signature and returns the userId if valid, or null if tampered/invalid.
 */
export function verifyCustomerToken(token: string): string | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", getCustomerLinkSecret()).update(payload).digest("base64url");
    // Constant-time comparison to prevent timing attacks
    if (sig.length !== expected.length) return null;
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (!sigBuf.equals(expBuf)) return null;
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded)) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildCustomerLink(userId: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base}/onboarding/${buildCustomerToken(userId)}`;
}

// ── Customer number generator ─────────────────────────────────────────────────

const CUSTOMER_PREFIX = "ECOM-CUST";
const CUSTOMER_NUMBER_RE = /^ECOM-CUST-(\d+)$/;

export async function generateNextCustomerNumber(): Promise<string> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data } = await db
    .from("b2b_customer_details")
    .select("customer_number")
    .like("customer_number", `${CUSTOMER_PREFIX}-%`)
    .order("customer_number", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { customer_number: string } | null };

  let next = 1;
  if (data?.customer_number) {
    const m = CUSTOMER_NUMBER_RE.exec(data.customer_number);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${CUSTOMER_PREFIX}-${String(next).padStart(6, "0")}`;
}

// ── Zoho Books contact sync ───────────────────────────────────────────────────

interface ZohoContactResponse {
  code: number;
  message: string;
  contact?: {
    contact_id: string;
    contact_name: string;
    // Zoho Books populates customer_id for contacts of type "customer"
    customer_id?: string;
  };
}

interface B2BDetails {
  display_name?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  customer_number?: string | null;
  payment_terms?: string | null;
  gst_treatment?: string | null;
  gstin?: string | null;
  billing_attention?: string | null;
  billing_address?: string | null;
  billing_street2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_country?: string | null;
  billing_county?: string | null;
  billing_phone?: string | null;
  shipping_attention?: string | null;
  shipping_address?: string | null;
  shipping_street2?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_country?: string | null;
  shipping_code?: string | null;
  shipping_phone?: string | null;
}

export async function syncContactToZoho(
  email: string,
  full_name: string | null,
  phone: string | null,
  details: B2BDetails
): Promise<{ ok: boolean; zohoContactId?: string; error?: string }> {
  if (
    !process.env.ZOHO_CLIENT_ID ||
    !process.env.ZOHO_CLIENT_SECRET ||
    !process.env.ZOHO_REFRESH_TOKEN ||
    !process.env.ZOHO_ORG_ID
  ) {
    return { ok: false, error: "Zoho not configured" };
  }

  try {
    // Zoho requires a non-empty contact_name
    const contactName = (
      details.display_name?.trim() ||
      details.company_name?.trim() ||
      full_name?.trim() ||
      email.split("@")[0]
    );

    // Map our display labels to Zoho Books API enum values
    const GST_TREATMENT_MAP: Record<string, string> = {
      "Business - Registered": "business_gst",
      "Business - Unregistered": "business_none",
      "Consumer": "consumer",
      "Overseas": "overseas",
      "Special Economic Zone": "business_sez",
      "Deemed Export": "deemed_export",
    };
    const gstTreatment = GST_TREATMENT_MAP[details.gst_treatment?.trim() ?? ""] ?? "business_none";

    const nameParts = (details.contact_name ?? full_name ?? "").trim().split(" ");
    const firstName = nameParts[0] || contactName;
    const lastName = nameParts.slice(1).join(" ") || undefined;

    // Build the custom_fields array — always include cf_ecom_cust_id when we
    // have a customer_number so Zoho Books records the ecommerce ID.
    // NOTE: use `api_name` (not `label`) so Zoho resolves the field by its
    // internal API identifier rather than its display label.
    const customFields: Array<{ api_name: string; value: string }> = [];
    if (details.customer_number?.trim()) {
      customFields.push({
        api_name: "cf_ecom_cust_id",
        value: details.customer_number.trim(),
      });
    }

    const payload: Record<string, unknown> = {
      contact_name: contactName,
      contact_type: "customer",
      customer_sub_type: "business",
      customer_code: details.customer_number?.trim() || undefined,
      email,
      phone: phone ?? undefined,
      company_name: details.company_name?.trim() || undefined,
      gst_treatment: gstTreatment,
      gst_no: details.gstin?.trim() || undefined,       // Zoho Books India field is gst_no, not gstin
      payment_terms_label: details.payment_terms?.trim() || undefined,
      custom_fields: customFields.length > 0 ? customFields : undefined,
      contact_persons: [
        {
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone ?? undefined,
          is_primary_contact: true,
        },
      ],
    };

    // Billing address — send if any address field is present
    if (details.billing_address || details.billing_city || details.billing_county) {
      payload.billing_address = {
        attention: details.billing_attention ?? undefined,
        address: details.billing_address ?? undefined,
        street2: details.billing_street2 ?? undefined,
        city: details.billing_city ?? undefined,
        state: details.billing_state ?? undefined,
        zip: details.billing_county ?? undefined,
        country: details.billing_country ?? "India",
        phone: details.billing_phone ?? undefined,
      };
    }

    // Shipping address — send if any address field is present
    if (details.shipping_address || details.shipping_city || details.shipping_code) {
      payload.shipping_address = {
        attention: details.shipping_attention ?? undefined,
        address: details.shipping_address ?? undefined,
        street2: details.shipping_street2 ?? undefined,
        city: details.shipping_city ?? undefined,
        state: details.shipping_state ?? undefined,
        zip: details.shipping_code ?? undefined,
        country: details.shipping_country ?? "India",
        phone: details.shipping_phone ?? undefined,
      };
    }

    const res = await zohoPost<ZohoContactResponse>("/contacts", payload);

    if (res.code !== 0) {
      return { ok: false, error: res.message };
    }

    // Prefer customer_id (Zoho's customer-specific ID) over the generic contact_id
    const zohoContactId = res.contact?.customer_id ?? res.contact?.contact_id;
    return { ok: true, zohoContactId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Welcome email ─────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(
  email: string,
  full_name: string | null,
  password: string,
  detailsLink: string,
  companyName?: string | null
): Promise<{ ok: boolean; error?: string }> {
  // Use SMTP or a transactional email service.
  // This implementation uses the Resend API (RESEND_API_KEY env var).
  // If not configured, log a warning and return gracefully.
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM ?? "noreply@rurban.in";
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "Rurban";

  if (!resendKey) {
    console.warn("[sendWelcomeEmail] RESEND_API_KEY not set — skipping email");
    return { ok: false, error: "Email not configured" };
  }

  const greeting = full_name ? `Hi ${full_name},` : "Hello,";
  const orgLine = companyName ? `<p>You have been registered as a B2B customer for <strong>${companyName}</strong>.</p>` : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:sans-serif;background:#f4f4f5;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#16a34a;padding:32px 40px;text-align:center">
      <h1 style="color:#fff;font-size:22px;margin:0">${siteName}</h1>
    </div>
    <div style="padding:32px 40px">
      <p style="font-size:16px;color:#111">${greeting}</p>
      <p style="color:#444">Welcome to <strong>${siteName}</strong> as a <strong>B2B Customer</strong>!</p>
      ${orgLine}
      <p style="color:#444">Your account has been created. Here are your login credentials:</p>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0;width:120px">Login URL</td>
            <td style="font-size:13px;font-weight:600"><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/login" style="color:#16a34a">${(process.env.NEXT_PUBLIC_SITE_URL ?? "") + "/login"}</a></td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0">Email</td>
            <td style="font-size:13px;font-weight:600">${email}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0">Password</td>
            <td style="font-size:13px;font-weight:600;font-family:monospace">${password}</td>
          </tr>
        </table>
      </div>

      <p style="color:#444">Please click the button below to fill in your business details — it only takes a few minutes:</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${detailsLink}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block">
          Complete My Account Details
        </a>
      </div>

      <p style="font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px;margin-top:16px">
        If you did not request this account, please ignore this email or contact us at
        <a href="mailto:support@rurban.in" style="color:#16a34a">support@rurban.in</a>.
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${siteName} <${fromEmail}>`,
        to: [email],
        subject: `Welcome to ${siteName} — Your B2B Account Details`,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Email API error ${res.status}: ${text}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
