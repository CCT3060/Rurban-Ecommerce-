/**
 * Customer-facing invoice endpoints for a single order (mobile app).
 *
 *   GET  /api/mobile/orders/[id]/invoice
 *        → { invoice_number, invoice_url (signed, 5 min), signed_invoice_status,
 *            signed_invoice_url } — only if the invoice has been synced.
 *
 *   POST /api/mobile/orders/[id]/invoice   (multipart form-data, field "file")
 *        → uploads the customer's signed copy and marks the order.
 *
 * Both require the caller to own the order (Bearer token → user must match
 * orders.user_id).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/jpg"]);

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

async function authOrder(request: Request, orderId: string) {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const admin = createAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data: order } = await db
    .from("orders")
    .select("id, user_id, zoho_invoice_number, invoice_pdf_path, signed_invoice_path, signed_invoice_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.user_id !== user.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Order not found" }, { status: 404 }) };
  }
  return { ok: true as const, admin, db, order };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await authOrder(request, id);
  if (!ctx.ok) return ctx.response;
  const { admin, order } = ctx;

  // ── Streaming download mode (?download=invoice|signed) ──────────────────────
  // The app fetches the PDF bytes through THIS API (same host it already uses),
  // and we pull the file from storage server-side. This means the download never
  // depends on the app reaching the storage subdomain directly.
  const download = new URL(request.url).searchParams.get("download");
  if (download === "invoice" || download === "signed") {
    const bucket = download === "signed" ? "signed-invoices" : "invoices";
    const path = download === "signed" ? order.signed_invoice_path : order.invoice_pdf_path;
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
    const label = download === "signed" ? "signed-invoice" : "invoice";
    const filename = `${label}-${order.zoho_invoice_number ?? id}.${ext}`;
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (!order.invoice_pdf_path) {
    return NextResponse.json({ data: { available: false } });
  }

  const { data: invoiceSigned } = await admin.storage
    .from("invoices")
    .createSignedUrl(order.invoice_pdf_path, 300);

  let signedUrl: string | null = null;
  if (order.signed_invoice_path) {
    const { data: s } = await admin.storage
      .from("signed-invoices")
      .createSignedUrl(order.signed_invoice_path, 300);
    signedUrl = s?.signedUrl ?? null;
  }

  return NextResponse.json({
    data: {
      available: true,
      invoice_number: order.zoho_invoice_number ?? null,
      invoice_url: invoiceSigned?.signedUrl ?? null,
      signed_invoice_status: order.signed_invoice_status ?? null,
      signed_invoice_url: signedUrl,
    },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await authOrder(request, id);
  if (!ctx.ok) return ctx.response;
  const { admin, db, order } = ctx;

  if (!order.invoice_pdf_path) {
    return NextResponse.json({ error: "No invoice to sign yet" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Only PDF or image files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File must be 10MB or less" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || (file.type === "application/pdf" ? "pdf" : "jpg");
  const path = `${id}-${Date.now()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("signed-invoices")
    .upload(path, file, { contentType: file.type, upsert: true, cacheControl: "3600" });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { error: updateError } = await db
    .from("orders")
    .update({
      signed_invoice_path: path,
      signed_invoice_uploaded_at: new Date().toISOString(),
      signed_invoice_status: "uploaded",
    })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ data: { signed_invoice_status: "uploaded" } });
}
