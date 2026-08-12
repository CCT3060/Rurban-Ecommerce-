/**
 * GET /api/admin/orders/[id]/invoice-file?type=invoice|signed
 *
 * Streams the order's invoice PDF (type=invoice, default) or the customer's
 * signed upload (type=signed) directly. Admin/warehouse only (session cookie).
 * Streaming avoids handing the browser a signed storage URL (which was
 * returning 403); the file is pulled from storage server-side and piped back.
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
    .select("order_number, zoho_invoice_number, invoice_pdf_path, signed_invoice_path")
    .eq("id", id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const bucket = type === "signed" ? "signed-invoices" : "invoices";
  const path = type === "signed" ? order.signed_invoice_path : order.invoice_pdf_path;
  if (!path) {
    return NextResponse.json({ error: "File not available" }, { status: 404 });
  }

  const { data: blob, error } = await admin.storage.from(bucket).download(path);
  if (error || !blob) {
    return NextResponse.json({ error: error?.message ?? "File not found" }, { status: 404 });
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const ext = (path.split(".").pop() || "pdf").toLowerCase();
  const mime =
    ext === "pdf" ? "application/pdf" :
    ext === "png" ? "image/png" :
    ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "application/octet-stream";
  const label = type === "signed" ? "signed-invoice" : "invoice";
  const filename = `${label}-${order.zoho_invoice_number ?? order.order_number ?? id}.${ext}`;

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      // inline → opens in the browser's PDF/image viewer (with a download option)
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
