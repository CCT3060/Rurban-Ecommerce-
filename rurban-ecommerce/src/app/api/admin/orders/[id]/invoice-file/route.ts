/**
 * GET /api/admin/orders/[id]/invoice-file?type=invoice|signed
 *
 * Returns a short-lived signed URL for the order's invoice PDF (type=invoice,
 * default) or the customer's signed upload (type=signed). Admin/warehouse only.
 */
import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getRequestContext();
  if (!auth.ok) return auth.response;
  if (auth.context.role !== "admin" && auth.context.role !== "warehouse_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const type = new URL(request.url).searchParams.get("type") === "signed" ? "signed" : "invoice";

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data: order } = await db
    .from("orders")
    .select("invoice_pdf_path, signed_invoice_path")
    .eq("id", id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const bucket = type === "signed" ? "signed-invoices" : "invoices";
  const path = type === "signed" ? order.signed_invoice_path : order.invoice_pdf_path;
  if (!path) {
    return NextResponse.json({ error: "File not available" }, { status: 404 });
  }

  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 300);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to sign URL" }, { status: 400 });
  }

  return NextResponse.json({ data: { url: data.signedUrl } });
}
