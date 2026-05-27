/**
 * GET  /api/admin/zoho/status
 * Returns whether Zoho credentials are configured (without exposing them).
 *
 * GET  /api/admin/zoho/status?test=1
 * Also tests the Zoho connection by fetching the org info.
 */
import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/auth/request-context";
import { zohoGet } from "@/lib/zoho/client";

export const dynamic = "force-dynamic";

interface ZohoOrganization {
  organization_id: string;
  name: string;
  currency_code: string;
}

interface ZohoOrganizationsResponse {
  code: number;
  message: string;
  organizations?: ZohoOrganization[];
}

export async function GET(request: Request) {
  try {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;

  const configured =
    Boolean(process.env.ZOHO_CLIENT_ID) &&
    Boolean(process.env.ZOHO_CLIENT_SECRET) &&
    Boolean(process.env.ZOHO_REFRESH_TOKEN) &&
    Boolean(process.env.ZOHO_ORG_ID);

  const { searchParams } = new URL(request.url);
  const doTest = searchParams.get("test") === "1";

  if (!doTest || !configured) {
    return NextResponse.json({
      data: {
        configured,
        connected: null,
        orgName: null,
        region: process.env.ZOHO_REGION ?? "in",
      },
    });
  }

  // Test the connection
  try {
    const res = await zohoGet<ZohoOrganizationsResponse>("/organizations");
    const org = res.organizations?.find(
      (o) => o.organization_id === process.env.ZOHO_ORG_ID
    ) ?? res.organizations?.[0];

    return NextResponse.json({
      data: {
        configured: true,
        connected: true,
        orgName: org?.name ?? null,
        region: process.env.ZOHO_REGION ?? "in",
      },
    });
  } catch (err) {
    return NextResponse.json({
      data: {
        configured: true,
        connected: false,
        error: String(err),
        region: process.env.ZOHO_REGION ?? "in",
      },
    });
  }
  } catch (err) {
    console.error("[zoho/status GET] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: String(err) },
      { status: 500 }
    );
  }
}
