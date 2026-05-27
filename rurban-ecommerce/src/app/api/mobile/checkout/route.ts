import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `RB-${timestamp}-${random}`;
}

function toPositiveInt(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

interface CheckoutItem {
  productId?: string;
  variantId?: string | null;
  quantity?: number;
}

interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { items?: CheckoutItem[]; shippingAddress?: ShippingAddress; paymentMethod?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const items = body.items ?? [];
  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const addr = body.shippingAddress ?? {};
  const firstName = String(addr.firstName ?? "").trim();
  const lastName = String(addr.lastName ?? "").trim();
  const phone = String(addr.phone ?? "").trim();
  const street = String(addr.street ?? "").trim();
  const city = String(addr.city ?? "").trim();
  const state = String(addr.state ?? "").trim();
  const zip = String(addr.zip ?? "").trim();

  if (!firstName || !lastName || !phone || !street || !city || !state || !zip) {
    return NextResponse.json({ error: "Complete shipping address is required" }, { status: 400 });
  }

  // Deduplicate cart items
  const normalizedCart = new Map<string, { productId: string; variantId: string | null; quantity: number }>();
  for (const item of items) {
    const productId = String(item.productId ?? "").trim();
    const variantId = item.variantId ? String(item.variantId).trim() : null;
    const quantity = toPositiveInt(item.quantity);
    if (!productId || !quantity) {
      return NextResponse.json({ error: "Each item must include productId and a valid quantity" }, { status: 400 });
    }
    const key = `${productId}::${variantId ?? ""}`;
    const existing = normalizedCart.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      normalizedCart.set(key, { productId, variantId, quantity });
    }
  }

  const lineItems = Array.from(normalizedCart.values());
  const productIds = [...new Set(lineItems.map(i => i.productId))];

  const { data: productsData, error: productsError } = await admin
    .from("products")
    .select("id,name,price,sale_price,stock,status,images:product_images(image_url,is_primary)")
    .in("id", productIds);

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 400 });
  }

  type ProductRow = { id: string; name: string; price: number; sale_price: number | null; stock: number; status: string; images: Array<{ image_url: string; is_primary: boolean }> | null };
  const productMap = new Map<string, ProductRow>(
    ((productsData ?? []) as ProductRow[]).map(p => [p.id, p])
  );

  for (const id of productIds) {
    if (!productMap.has(id)) {
      return NextResponse.json({ error: "One or more products are unavailable" }, { status: 400 });
    }
  }

  let subtotal = 0;
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

  for (const item of lineItems) {
    const product = productMap.get(item.productId)!;
    if (product.status !== "active") {
      return NextResponse.json({ error: `Product "${product.name}" is not available` }, { status: 400 });
    }
    if (item.quantity > product.stock) {
      return NextResponse.json({ error: `Insufficient stock for ${product.name}` }, { status: 400 });
    }

    const unitPrice = product.sale_price ? Number(product.sale_price) : Number(product.price);
    subtotal += unitPrice * item.quantity;

    const primaryImg = (product.images ?? []).find(img => img.is_primary)?.image_url
      ?? (product.images ?? [])[0]?.image_url ?? null;

    orderItemsPayload.push({
      order_id: "", // will set after order creation
      product_id: item.productId,
      variant_id: item.variantId,
      name: product.name,
      price: unitPrice,
      quantity: item.quantity,
      image_url: primaryImg,
      variant_info: null,
    });
  }

  const shippingCost = subtotal >= 199 ? 0 : 29;
  const total = subtotal + shippingCost;
  const paymentMethod = String(body.paymentMethod ?? "cod").trim();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: user.id,
      order_number: generateOrderNumber(),
      subtotal,
      discount: 0,
      tax: 0,
      shipping_cost: shippingCost,
      total,
      status: "pending",
      payment_status: paymentMethod === "cod" ? "pending" : "paid",
      payment_method: paymentMethod,
      shipping_address: { firstName, lastName, phone, street, city, state, zip },
    })
    .select("id,order_number,total,status")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Failed to create order" }, { status: 500 });
  }

  // Insert order items
  const itemsWithOrderId = orderItemsPayload.map(i => ({ ...i, order_id: order.id }));
  const { error: itemsError } = await admin.from("order_items").insert(itemsWithOrderId);
  if (itemsError) {
    // Rollback order
    await admin.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Decrement stock
  for (const item of lineItems) {
    await admin.rpc("decrement_stock", { p_product_id: item.productId, p_quantity: item.quantity }).maybeSingle();
  }

  return NextResponse.json({
    data: {
      id: order.id,
      order_number: order.order_number,
      total: order.total,
      status: order.status,
    },
  });
}
