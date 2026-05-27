"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Package, MapPin, CreditCard, User, Clock,
  ChevronDown, Printer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Image from "next/image";

/* ─── Types ─────────────────────────────────────────────────────────────── */
type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

type OrderItem = {
  id: string;
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
  variant_info: string | null;
};

type Address = {
  full_name?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
};

type OrderDetail = {
  id: string;
  order_number: string;
  subtotal: number;
  discount: number;
  tax: number;
  shipping_cost: number;
  total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  shipping_address: Address | null;
  billing_address: Address | null;
  user: { full_name: string | null; email: string | null; phone?: string | null } | null;
  order_items: OrderItem[];
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-indigo-100 text-indigo-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const paymentColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-gray-100 text-gray-700",
};

const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

function AddressBlock({ label, address }: { label: string; address: Address | null }) {
  if (!address) return null;
  const lines = [
    address.full_name,
    address.phone,
    address.address_line1,
    address.address_line2,
    [address.city, address.state, address.pincode].filter(Boolean).join(", "),
    address.country,
  ].filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      {lines.map((line, i) => (
        <p key={i} className="text-sm leading-5">{line}</p>
      ))}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`);
      const json = (await res.json()) as { data?: OrderDetail; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load order");
      setOrder(json.data ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchOrder(); }, [id]);

  const updateOrder = async (payload: { status?: string; payment_status?: string }) => {
    if (!order) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to update order");
      toast.success("Order updated");
      await fetchOrder();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update order");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground text-sm">Loading order…</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-muted-foreground">Order not found.</p>
        <Button variant="outline" onClick={() => router.back()}>Go back</Button>
      </div>
    );
  }

  const customerName = order.user?.full_name ?? order.shipping_address?.full_name ?? "Customer";
  const customerEmail = order.user?.email ?? "—";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Order {order.order_number}</h1>
            <p className="text-xs text-muted-foreground">
              Placed on {new Date(order.created_at).toLocaleString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pl-11 sm:pl-0">
          {/* Order Status */}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={updating}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm hover:bg-accent disabled:opacity-50"
            >
              <Badge className={`border-0 pointer-events-none ${statusColors[order.status]}`}>
                {order.status}
              </Badge>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {STATUS_FLOW.map((s) => (
                <DropdownMenuItem
                  key={s}
                  disabled={s === order.status}
                  onClick={() => void updateOrder({ status: s })}
                >
                  <Badge className={`border-0 mr-2 ${statusColors[s]}`}>{s}</Badge>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void updateOrder({ payment_status: "paid" })} disabled={order.payment_status === "paid"}>
                Mark Paid
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void updateOrder({ payment_status: "refunded" })} disabled={order.payment_status === "refunded"}>
                Mark Refunded
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm hover:bg-accent"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Items + Summary ────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Items ({order.order_items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex gap-3 px-6 py-4">
                    <div className="h-16 w-16 shrink-0 rounded-lg border bg-muted overflow-hidden flex items-center justify-center">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          width={64}
                          height={64}
                          className="object-contain w-full h-full"
                        />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-5">{item.name}</p>
                      {item.variant_info && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.variant_info}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">₹{(Number(item.price) * item.quantity).toLocaleString("en-IN")}</p>
                      <p className="text-xs text-muted-foreground">₹{Number(item.price).toLocaleString("en-IN")} each</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price summary */}
              <div className="px-6 py-4 bg-muted/30 space-y-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{Number(order.subtotal).toLocaleString("en-IN")}</span>
                </div>
                {Number(order.discount) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>−₹{Number(order.discount).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {Number(order.tax) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>₹{Number(order.tax).toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{Number(order.shipping_cost) === 0 ? "Free" : `₹${Number(order.shipping_cost).toLocaleString("en-IN")}`}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>₹{Number(order.total).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Order Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right: Meta cards ────────────────────────────── */}
        <div className="space-y-4">

          {/* Customer */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm font-medium">{customerName}</p>
              <p className="text-xs text-muted-foreground">{customerEmail}</p>
              {order.user?.phone && (
                <p className="text-xs text-muted-foreground">{order.user.phone}</p>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                <Badge className={`border-0 text-xs ${paymentColors[order.payment_status]}`}>
                  {order.payment_status}
                </Badge>
              </div>
              {order.payment_method && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Method</span>
                  <span className="text-xs font-medium capitalize">{order.payment_method}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" /> Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {STATUS_FLOW.filter(s => s !== "cancelled").map((s, i) => {
                  const idx = STATUS_FLOW.indexOf(order.status);
                  const thisIdx = STATUS_FLOW.indexOf(s);
                  const done = order.status !== "cancelled" && thisIdx <= idx;
                  const current = s === order.status;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${done ? "bg-primary" : "bg-muted-foreground/25"}`} />
                      <span className={`text-xs capitalize ${current ? "font-semibold text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>
                        {s}
                      </span>
                      {current && <Badge className="border-0 bg-primary/10 text-primary text-[10px] ml-auto">Current</Badge>}
                    </div>
                  );
                })}
                {order.status === "cancelled" && (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full shrink-0 bg-red-400" />
                    <span className="text-xs font-semibold text-red-600">Cancelled</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Addresses */}
          {(order.shipping_address ?? order.billing_address) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" /> Addresses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <AddressBlock label="Shipping Address" address={order.shipping_address} />
                {order.billing_address && (
                  <>
                    <Separator />
                    <AddressBlock label="Billing Address" address={order.billing_address} />
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
