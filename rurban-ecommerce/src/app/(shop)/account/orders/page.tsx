import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice, IMAGE_PLACEHOLDER } from "@/lib/constants";
import { normalizeSupabaseImageUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "My Orders" };

type OrderItemRow = {
  id: string;
  name: string;
  price: number | string;
  quantity: number | string;
  image_url: string | null;
  variant_info: string | null;
};

type AddressRecord = {
  full_name?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  subtotal: number | string | null;
  discount: number | string | null;
  tax: number | string | null;
  shipping_cost: number | string | null;
  total: number | string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  shipping_address: AddressRecord | null;
  created_at: string;
  items: OrderItemRow[] | null;
};

const statusMeta: Record<
  string,
  { badgeClass: string; barClass: string; progress: number }
> = {
  pending: {
    badgeClass: "bg-amber-100 text-amber-700",
    barClass: "bg-amber-500",
    progress: 15,
  },
  confirmed: {
    badgeClass: "bg-blue-100 text-blue-700",
    barClass: "bg-blue-500",
    progress: 30,
  },
  processing: {
    badgeClass: "bg-indigo-100 text-indigo-700",
    barClass: "bg-indigo-500",
    progress: 55,
  },
  shipped: {
    badgeClass: "bg-violet-100 text-violet-700",
    barClass: "bg-violet-500",
    progress: 75,
  },
  delivered: {
    badgeClass: "bg-emerald-100 text-emerald-700",
    barClass: "bg-emerald-500",
    progress: 100,
  },
  cancelled: {
    badgeClass: "bg-rose-100 text-rose-700",
    barClass: "bg-rose-500",
    progress: 0,
  },
};

const paymentMeta: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  refunded: "bg-slate-100 text-slate-700 border-slate-200",
};

function toTitle(value: string | null | undefined): string {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toAmount(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toQuantity(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function toAddress(value: unknown): AddressRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    full_name: typeof record.full_name === "string" ? record.full_name : undefined,
    phone: typeof record.phone === "string" ? record.phone : undefined,
    street: typeof record.street === "string" ? record.street : undefined,
    city: typeof record.city === "string" ? record.city : undefined,
    state: typeof record.state === "string" ? record.state : undefined,
    zip: typeof record.zip === "string" ? record.zip : undefined,
  };
}

function formatOrderDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toAddressLine(address: AddressRecord | null): string {
  if (!address) return "Address not available";
  const line = [address.street, address.city, address.state, address.zip]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
  return line || "Address not available";
}

export default async function AccountOrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/account/orders");
  }

  const admin = createAdminClient();
  const { data: ordersData, error } = await admin
    .from("orders")
    .select(
      "id,order_number,subtotal,discount,tax,shipping_cost,total,status,payment_status,payment_method,shipping_address,created_at,items:order_items(id,name,price,quantity,image_url,variant_info)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="container mx-auto px-4 py-10 text-sm text-destructive">
        Failed to load your orders: {error.message}
      </div>
    );
  }

  const orders = ((ordersData ?? []) as OrderRow[]).map((order) => ({
    ...order,
    items: Array.isArray(order.items) ? order.items : [],
    shipping_address: toAddress(order.shipping_address),
  }));

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, order) => sum + toAmount(order.total), 0);
  const deliveredOrders = orders.filter((order) => order.status === "delivered").length;
  const openOrders = orders.filter((order) =>
    ["pending", "confirmed", "processing", "shipped"].includes(order.status)
  ).length;

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container mx-auto max-w-6xl px-4 py-8 md:py-10 space-y-6">
        <section className="rounded-2xl border bg-gradient-to-r from-cyan-50 via-blue-50 to-emerald-50 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Orders</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Track purchases, payments, and deliveries in one place.
              </p>
            </div>
            <Link href="/account">
              <Button variant="outline" size="sm" className="bg-background">
                Back to Account
              </Button>
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border bg-background/90 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Total Orders
              </p>
              <p className="mt-1 text-xl font-bold">{totalOrders}</p>
            </div>
            <div className="rounded-xl border bg-background/90 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Total Spent
              </p>
              <p className="mt-1 text-xl font-bold">{formatPrice(totalSpent)}</p>
            </div>
            <div className="rounded-xl border bg-background/90 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Delivered
              </p>
              <p className="mt-1 text-xl font-bold">{deliveredOrders}</p>
            </div>
            <div className="rounded-xl border bg-background/90 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                In Progress
              </p>
              <p className="mt-1 text-xl font-bold">{openOrders}</p>
            </div>
          </div>
        </section>

        {orders.length === 0 ? (
          <section className="rounded-2xl border bg-card px-6 py-12 text-center">
            <h2 className="text-xl font-semibold">No orders yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start shopping to see your latest purchases here.
            </p>
            <Link href="/shop" className="inline-block mt-4">
              <Button>Shop Now</Button>
            </Link>
          </section>
        ) : (
          <section className="space-y-4">
            {orders.map((order) => {
              const orderStatus = statusMeta[order.status] ?? {
                badgeClass: "bg-slate-100 text-slate-700",
                barClass: "bg-slate-400",
                progress: 0,
              };
              const items = order.items ?? [];
              const totalItems = items.reduce(
                (sum, item) => sum + toQuantity(item.quantity),
                0
              );
              const subtotal = toAmount(order.subtotal);
              const discount = toAmount(order.discount);
              const shipping = toAmount(order.shipping_cost);
              const tax = toAmount(order.tax);
              const total = toAmount(order.total);
              const address = order.shipping_address;

              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-2xl border bg-card shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
                >
                  <div className="border-b bg-muted/30 px-4 py-3 md:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Ordered on {formatOrderDate(order.created_at)}
                        </p>
                        <p className="mt-1 text-base font-semibold">{order.order_number}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`border-0 ${orderStatus.badgeClass}`}>
                          {toTitle(order.status)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={paymentMeta[order.payment_status] ?? "bg-slate-50 text-slate-700"}
                        >
                          Payment: {toTitle(order.payment_status)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 p-4 md:p-6 lg:grid-cols-[1fr_270px]">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">Items ({totalItems || items.length})</p>
                          <Link href="/shop" className="text-xs font-medium text-primary hover:underline">
                            Buy Again
                          </Link>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-3">
                          {items.slice(0, 4).map((item) => {
                            const imageUrl = normalizeSupabaseImageUrl(item.image_url) || IMAGE_PLACEHOLDER;
                            const quantity = toQuantity(item.quantity) || 1;
                            return (
                              <div
                                key={item.id}
                                className="flex min-w-[220px] max-w-[280px] items-center gap-3 rounded-xl border bg-background p-2 pr-3"
                              >
                                <div className="relative h-14 w-14 overflow-hidden rounded-lg bg-muted">
                                  <Image
                                    src={imageUrl}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                    sizes="56px"
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{item.name}</p>
                                  {item.variant_info && (
                                    <p className="truncate text-xs text-muted-foreground">
                                      {item.variant_info}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground">Qty: {quantity}</p>
                                </div>
                                <p className="text-xs font-semibold">
                                  {formatPrice(toAmount(item.price) * quantity)}
                                </p>
                              </div>
                            );
                          })}

                          {items.length > 4 && (
                            <div className="flex min-w-[150px] items-center justify-center rounded-xl border bg-muted/30 px-3 text-xs font-medium text-muted-foreground">
                              +{items.length - 4} more item(s)
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border bg-muted/20 px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Delivery Address
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {address?.full_name?.trim() || "Name not available"}
                        </p>
                        <p className="text-sm text-muted-foreground">{toAddressLine(address)}</p>
                        <p className="text-sm text-muted-foreground">{address?.phone?.trim() || "-"}</p>
                      </div>
                    </div>

                    <aside className="h-fit rounded-xl border bg-muted/20 p-4">
                      <p className="font-semibold">Order Summary</p>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>{formatPrice(subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Discount</span>
                          <span>-{formatPrice(discount)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Shipping</span>
                          <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Tax</span>
                          <span>{formatPrice(tax)}</span>
                        </div>
                        <div className="mt-2 border-t pt-2 flex items-center justify-between font-semibold">
                          <span>Total</span>
                          <span>{formatPrice(total)}</span>
                        </div>
                        <p className="pt-1 text-xs text-muted-foreground">
                          Payment mode: {toTitle(order.payment_method || "cod")}
                        </p>
                      </div>
                    </aside>
                  </div>

                  {order.status !== "cancelled" && (
                    <div className="border-t px-4 py-3 md:px-6">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Order progress</span>
                        <span className="font-medium">{orderStatus.progress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${orderStatus.barClass}`}
                          style={{ width: `${orderStatus.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
