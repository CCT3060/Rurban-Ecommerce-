import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSupabaseImageUrl } from "@/lib/utils";

type CheckoutItemInput = {
  productId?: string;
  variantId?: string | null;
  quantity?: number;
};

interface CheckoutBody {
  items?: CheckoutItemInput[];
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  paymentMethod?: string;
  notes?: string;
}

type ProductRow = {
  id: string;
  name: string;
  price: number | string;
  sale_price: number | string | null;
  stock: number;
  status: "active" | "inactive" | "draft";
  images:
    | Array<{
        image_url: string;
        is_primary: boolean;
      }>
    | null;
};

type VariantRow = {
  id: string;
  product_id: string;
  value: string;
  stock: number;
  price_modifier: number | string;
};

function toPositiveInt(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `RB-${timestamp}-${random}`;
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CheckoutBody;
  const items = body.items ?? [];

  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const shippingAddressInput = body.shippingAddress ?? {};
  const firstName = String(shippingAddressInput.firstName ?? "").trim();
  const lastName = String(shippingAddressInput.lastName ?? "").trim();
  const phone = String(shippingAddressInput.phone ?? "").trim();
  const street = String(shippingAddressInput.street ?? "").trim();
  const city = String(shippingAddressInput.city ?? "").trim();
  const state = String(shippingAddressInput.state ?? "").trim();
  const zip = String(shippingAddressInput.zip ?? "").trim();

  if (!firstName || !lastName || !phone || !street || !city || !state || !zip) {
    return NextResponse.json(
      { error: "Complete shipping address is required" },
      { status: 400 }
    );
  }

  const normalizedCart = new Map<
    string,
    { productId: string; variantId: string | null; quantity: number }
  >();

  for (const item of items) {
    const productId = String(item.productId ?? "").trim();
    const variantId = item.variantId ? String(item.variantId).trim() : null;
    const quantity = toPositiveInt(item.quantity);

    if (!productId || !quantity) {
      return NextResponse.json(
        { error: "Each item must include productId and a valid quantity" },
        { status: 400 }
      );
    }

    const key = `${productId}::${variantId ?? ""}`;
    const existing = normalizedCart.get(key);
    if (existing) {
      existing.quantity += quantity;
      normalizedCart.set(key, existing);
    } else {
      normalizedCart.set(key, { productId, variantId, quantity });
    }
  }

  const lineRequests = Array.from(normalizedCart.values());
  const productIds = Array.from(new Set(lineRequests.map((item) => item.productId)));
  const variantIds = Array.from(
    new Set(lineRequests.map((item) => item.variantId).filter(Boolean) as string[])
  );

  const admin = createAdminClient();

  const { data: productsData, error: productsError } = await admin
    .from("products")
    .select("id,name,price,sale_price,stock,status,images:product_images(image_url,is_primary)")
    .in("id", productIds);

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 400 });
  }

  const productMap = new Map<string, ProductRow>(
    ((productsData ?? []) as ProductRow[]).map((product) => [product.id, product])
  );

  for (const productId of productIds) {
    if (!productMap.has(productId)) {
      return NextResponse.json({ error: "One or more products are unavailable" }, { status: 400 });
    }
  }

  const variantMap = new Map<string, VariantRow>();
  if (variantIds.length > 0) {
    const { data: variantsData, error: variantsError } = await admin
      .from("product_variants")
      .select("id,product_id,value,stock,price_modifier")
      .in("id", variantIds);

    if (variantsError) {
      return NextResponse.json({ error: variantsError.message }, { status: 400 });
    }

    for (const variant of (variantsData ?? []) as VariantRow[]) {
      variantMap.set(variant.id, variant);
    }

    for (const variantId of variantIds) {
      if (!variantMap.has(variantId)) {
        return NextResponse.json({ error: "One or more variants are unavailable" }, { status: 400 });
      }
    }
  }

  const orderItemsPayload: Array<{
    order_id: string;
    product_id: string;
    variant_id: string | null;
    name: string;
    price: number;
    quantity: number;
    image_url: string | null;
    variant_info: string | null;
  }> = [];

  let subtotal = 0;

  for (const item of lineRequests) {
    const product = productMap.get(item.productId);
    if (!product || product.status !== "active") {
      return NextResponse.json({ error: "One or more products are not available" }, { status: 400 });
    }

    const variant = item.variantId ? variantMap.get(item.variantId) : null;
    if (item.variantId && (!variant || variant.product_id !== product.id)) {
      return NextResponse.json({ error: "Invalid product variant selected" }, { status: 400 });
    }

    const availableStock = variant ? Number(variant.stock) : Number(product.stock);
    if (item.quantity > availableStock) {
      return NextResponse.json(
        { error: `Insufficient stock for ${product.name}` },
        { status: 400 }
      );
    }

    const basePrice = Number(product.price ?? 0);
    const baseSalePrice =
      product.sale_price === null ? null : Number(product.sale_price ?? 0);
    const priceModifier = variant ? Number(variant.price_modifier ?? 0) : 0;
    const mrp = Math.max(0, basePrice + priceModifier);
    const salePrice =
      baseSalePrice === null ? null : Math.max(0, baseSalePrice + priceModifier);
    const unitPrice = salePrice ?? mrp;

    subtotal += unitPrice * item.quantity;

    const primaryImage =
      normalizeSupabaseImageUrl(
        product.images?.find((img) => img.is_primary)?.image_url ??
          product.images?.[0]?.image_url
      ) || null;

    orderItemsPayload.push({
      order_id: "",
      product_id: product.id,
      variant_id: variant?.id ?? null,
      name: product.name,
      price: unitPrice,
      quantity: item.quantity,
      image_url: primaryImage,
      variant_info: variant?.value ?? null,
    });
  }

  subtotal = Number(subtotal.toFixed(2));

  const shippingCost = subtotal >= 999 ? 0 : 49;
  const tax = Number((subtotal * 0.18).toFixed(2));
  const total = Number((subtotal + shippingCost + tax).toFixed(2));

  const orderNumber = generateOrderNumber();

  const shippingAddress = {
    full_name: `${firstName} ${lastName}`.trim(),
    phone,
    street,
    city,
    state,
    zip,
  };

  const paymentMethod = body.paymentMethod === "online" ? "online" : "cod";

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: user.id,
      order_number: orderNumber,
      subtotal,
      discount: 0,
      tax,
      shipping_cost: shippingCost,
      total,
      status: "pending",
      payment_status: "pending",
      payment_method: paymentMethod,
      shipping_address: shippingAddress,
      billing_address: shippingAddress,
      notes: body.notes?.trim() || null,
    })
    .select("id,order_number")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || "Failed to create order" }, { status: 400 });
  }

  const finalizedOrderItems = orderItemsPayload.map((item) => ({
    ...item,
    order_id: order.id,
  }));

  const { error: itemsError } = await admin.from("order_items").insert(finalizedOrderItems);
  if (itemsError) {
    await admin.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  return NextResponse.json({ data: { id: order.id, order_number: order.order_number } }, { status: 201 });
}
