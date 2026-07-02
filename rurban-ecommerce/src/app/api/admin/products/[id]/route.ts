import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSlug } from "@/lib/constants";
import { normalizeSupabaseImageUrl } from "@/lib/utils";

async function requireAdmin() {
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
    user.app_metadata?.role as string | undefined;

  if (role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const };
}

interface UpdateProductBody {
  name?: string;
  slug?: string;
  description?: string | null;
  short_description?: string | null;
  price?: number;
  sale_price?: number | null;
  sku?: string | null;
  stock?: number;
  brand?: string | null;
  tags?: string[];
  category_id?: string | null;
  status?: "active" | "inactive" | "draft";
  is_featured?: boolean;
  is_trending?: boolean;
  is_new_arrival?: boolean;
  image_url?: string | null;
  variants?: Array<{
    id?: string;
    name?: string;
    type?: string;
    value?: string;
    price_modifier?: number;
    stock?: number;
    sku?: string | null;
  }>;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = (await request.json()) as UpdateProductBody;
  const updatePayload: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Product name cannot be empty" }, { status: 400 });
    }
    updatePayload.name = name;
    updatePayload.slug = (body.slug?.trim() || generateSlug(name)).toLowerCase();
  } else if (body.slug !== undefined) {
    const slug = body.slug.trim().toLowerCase();
    if (!slug) {
      return NextResponse.json({ error: "Slug cannot be empty" }, { status: 400 });
    }
    updatePayload.slug = slug;
  }

  if (body.description !== undefined) updatePayload.description = body.description?.trim() || null;
  if (body.short_description !== undefined) updatePayload.short_description = body.short_description?.trim() || null;
  if (body.price !== undefined) updatePayload.price = Number(body.price);
  if (body.sale_price !== undefined) updatePayload.sale_price = body.sale_price === null ? null : Number(body.sale_price);
  if (body.sku !== undefined) updatePayload.sku = body.sku?.trim() || null;
  if (body.stock !== undefined) updatePayload.stock = Number(body.stock);
  if (body.brand !== undefined) updatePayload.brand = body.brand?.trim() || null;
  if (body.tags !== undefined) updatePayload.tags = Array.isArray(body.tags) ? body.tags : [];
  if (body.category_id !== undefined) updatePayload.category_id = body.category_id || null;
  if (body.status !== undefined) updatePayload.status = body.status;
  if (body.is_featured !== undefined) updatePayload.is_featured = Boolean(body.is_featured);
  if (body.is_trending !== undefined) updatePayload.is_trending = Boolean(body.is_trending);
  if (body.is_new_arrival !== undefined) updatePayload.is_new_arrival = Boolean(body.is_new_arrival);

  const normalizedImageUrl =
    body.image_url !== undefined ? normalizeSupabaseImageUrl(body.image_url) || null : undefined;

  const admin = createAdminClient();
  const { error } = await admin
    .from("products")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (normalizedImageUrl) {
    const { data: existingPrimary } = await admin
      .from("product_images")
      .select("id")
      .eq("product_id", id)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();

    if (existingPrimary?.id) {
      const { error: imageUpdateError } = await admin
        .from("product_images")
        .update({ image_url: normalizedImageUrl })
        .eq("id", existingPrimary.id);

      if (imageUpdateError) {
        return NextResponse.json({ error: imageUpdateError.message }, { status: 400 });
      }
    } else {
      const { error: imageInsertError } = await admin.from("product_images").insert({
        product_id: id,
        image_url: normalizedImageUrl,
        is_primary: true,
        sort_order: 0,
      });

      if (imageInsertError) {
        return NextResponse.json({ error: imageInsertError.message }, { status: 400 });
      }
    }
  }

  if (body.variants !== undefined) {
    const normalizedVariants = (body.variants ?? [])
      .map((variant) => ({
        product_id: id,
        name: variant.name?.trim() || "",
        type: variant.type?.trim() || "",
        value: variant.value?.trim() || "",
        price_modifier: Number(variant.price_modifier ?? 0),
        stock: Number(variant.stock ?? 0),
        sku: variant.sku?.trim() || null,
      }))
      .filter((variant) => variant.name && variant.type && variant.value);

    const { error: deleteVariantsError } = await admin
      .from("product_variants")
      .delete()
      .eq("product_id", id);

    if (deleteVariantsError) {
      return NextResponse.json({ error: deleteVariantsError.message }, { status: 400 });
    }

    if (normalizedVariants.length > 0) {
      const { error: insertVariantsError } = await admin
        .from("product_variants")
        .insert(normalizedVariants);

      if (insertVariantsError) {
        return NextResponse.json({ error: insertVariantsError.message }, { status: 400 });
      }
    }
  }

  const { data: fullProduct, error: fetchError } = await admin
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("id", id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 });
  }

  return NextResponse.json({ data: fullProduct });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("products").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
