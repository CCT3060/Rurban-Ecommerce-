/**
 * GET /api/warehouse/orders/[id]/invoice-file?type=invoice|signed
 *
 * Streams the order's invoice PDF (type=invoice, default) or the customer's
 * signed upload (type=signed) for the WAREHOUSE portal. Uses the same auth as
 * the warehouse order page (requireWarehouseAdminContext) so the download works
 * with the warehouse admin's session, and enforces the same order-access rule.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";

async function isOrderAccessible(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  warehouseId: string
): Promise<boolean> {
  const { data: orderRow } = await admin
    .from("orders")
    .select("user_id")
    .eq("id", orderId)
    .maybeSingle() as unknown as { data: { user_id: string | null } | null };

  if (orderRow?.user_id) {
    const { data: userProfile } = await admin
      .from("profiles")
      .select("warehouse_id, user_type")
      .eq("id", orderRow.user_id)
      .maybeSingle() as unknown as { data: { warehouse_id: string | null; user_type: string | null } | null };
    if (userProfile?.warehouse_id === warehouseId && userProfile?.user_type === "b2b") {
      return true;
    }
  }

  const { data: warehouseProducts } = await admin
    .from("products")
    .select("id")
    .eq("warehouse_id", warehouseId) as unknown as { data: { id: string }[] | null };
  const productIds = (warehouseProducts ?? []).map((p) => p.id);
  if (productIds.length === 0) return false;

  const { data: scopedCheck } = await admin
    .from("order_items")
    .select("order_id")
    .eq("order_id", orderId)
    .in("product_id", productIds)
    .limit(1) as unknown as { data: { order_id: string }[] | null };

  return (scopedCheck ?? []).length > 0;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const type = new URL(request.url).searchParams.get("type") === "signed" ? "signed" : "invoice";
  const admin = createAdminClient();
  const warehouseId = auth.context.warehouseId!;

  if (!(await isOrderAccessible(admin, id, warehouseId))) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

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
  if (!path) return NextResponse.json({ error: "File not available" }, { status: 404 });

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
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
