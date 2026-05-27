import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSlug } from "@/lib/constants";
import { normalizeSupabaseImageUrl } from "@/lib/utils";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/jpg"]);

async function requireAdminOrWarehouseAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const role =
    (user.app_metadata?.role as string | undefined) ?? (user.user_metadata?.role as string | undefined);

  if (role !== "admin" && role !== "warehouse_admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  const auth = await requireAdminOrWarehouseAdmin();
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const file = formData.get("file");
  const productName = String(formData.get("productName") || "product");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only PNG, JPG and WEBP files are allowed" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File size must be 5MB or less" }, { status: 400 });
  }

  const extension = file.name.split(".").pop() || "jpg";
  const safeSlug = generateSlug(productName) || "product";
  const filePath = `products/${safeSlug}-${Date.now()}.${extension}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("products")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data } = admin.storage.from("products").getPublicUrl(filePath);
  return NextResponse.json({ data: { url: normalizeSupabaseImageUrl(data.publicUrl) } }, { status: 201 });
}