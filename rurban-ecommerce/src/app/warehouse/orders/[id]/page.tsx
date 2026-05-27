"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Package, User, MapPin, CreditCard, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type Address = {
  full_name?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  variant_info: string | null;
  image_url: string | null;
};

type OrderDetail = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  shipping_cost: number;
  total: number;
  notes: string | null;
  created_at: string;
  shipping_address: Address | null;
  billing_address: Address | null;
  user: { full_name: string | null; email: string | null; phone: string | null } | null;
  items: OrderItem[];
};

const ORDER_STATUSES = [
  { value: "pending",    label: "Pending" },
  { value: "confirmed",  label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped",    label: "Shipped" },
  { value: "delivered",  label: "Delivered" },
  { value: "cancelled",  label: "Cancelled" },
];

const statusColors: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-700 border-yellow-200",
  confirmed:  "bg-blue-100 text-blue-700 border-blue-200",
  processing: "bg-indigo-100 text-indigo-700 border-indigo-200",
  shipped:    "bg-purple-100 text-purple-700 border-purple-200",
  delivered:  "bg-green-100 text-green-700 border-green-200",
  cancelled:  "bg-red-100 text-red-700 border-red-200",
};

const paymentColors: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700 border-yellow-200",
  paid:     "bg-green-100 text-green-700 border-green-200",
  failed:   "bg-red-100 text-red-700 border-red-200",
  refunded: "bg-gray-100 text-gray-700 border-gray-200",
};

function AddressBlock({ address, label }: { address: Address | null; label: string }) {
  if (!address) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <p className="text-sm font-medium">{address.full_name}</p>
      {address.phone && <p className="text-sm text-muted-foreground">{address.phone}</p>}
      <p className="text-sm text-muted-foreground">
        {[address.line1, address.line2].filter(Boolean).join(", ")}
      </p>
      <p className="text-sm text-muted-foreground">
        {[address.city, address.state, address.postal_code].filter(Boolean).join(", ")}
      </p>
      {address.country && <p className="text-sm text-muted-foreground">{address.country}</p>}
    </div>
  );
}

export default function WarehouseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/warehouse/orders/${orderId}`);
        const json = (await res.json()) as { data?: OrderDetail; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load order");
        setOrder(json.data ?? null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load order");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [orderId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/warehouse/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to update status");
      setOrder((prev) => prev ? { ...prev, status: newStatus } : prev);
      toast.success("Order status updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Order not found.</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  const customerName = order.user?.full_name || order.shipping_address?.full_name || "Unknown";
  const customerEmail = order.user?.email ?? "-";
  const customerPhone = order.user?.phone || order.shipping_address?.phone || "-";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{order.order_number}</h2>
            <p className="text-sm text-muted-foreground">
              Placed on {new Date(order.created_at).toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`${paymentColors[order.payment_status] ?? "bg-gray-100 text-gray-700"} border text-xs font-semibold`}>
            {order.payment_status.toUpperCase()}
          </Badge>
          <Select value={order.status} onValueChange={handleStatusChange} disabled={updating}>
            <SelectTrigger className={`w-40 text-xs font-semibold border ${statusColors[order.status] ?? ""}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — items + summary */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Ordered Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 p-0">
              {order.items.map((item, idx) => (
                <div key={item.id}>
                  <div className="flex items-start gap-4 px-6 py-4">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-14 h-14 rounded-lg object-cover border bg-muted shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg border bg-muted flex items-center justify-center shrink-0">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight">{item.name}</p>
                      {item.variant_info && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.variant_info}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm">
                        Rs {(Number(item.price) * item.quantity).toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Rs {Number(item.price).toLocaleString("en-IN")} each
                      </p>
                    </div>
                  </div>
                  {idx < order.items.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" /> Price Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>Rs {Number(order.subtotal).toLocaleString("en-IN")}</span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>- Rs {Number(order.discount).toLocaleString("en-IN")}</span>
                </div>
              )}
              {Number(order.tax) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>Rs {Number(order.tax).toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>
                  {Number(order.shipping_cost) === 0
                    ? <span className="text-green-600">Free</span>
                    : `Rs ${Number(order.shipping_cost).toLocaleString("en-IN")}`}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span>Rs {Number(order.total).toLocaleString("en-IN")}</span>
              </div>
              {order.payment_method && (
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="capitalize">{order.payment_method.replace(/_/g, " ")}</span>
                </div>
              )}
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

        {/* Right column — customer + addresses */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-semibold">{customerName}</p>
              <p className="text-muted-foreground break-all">{customerEmail}</p>
              {customerPhone !== "-" && (
                <p className="text-muted-foreground">{customerPhone}</p>
              )}
            </CardContent>
          </Card>

          {/* Addresses */}
          {(order.shipping_address || order.billing_address) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Addresses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <AddressBlock address={order.shipping_address} label="Shipping Address" />
                {order.billing_address &&
                  JSON.stringify(order.billing_address) !== JSON.stringify(order.shipping_address) && (
                    <>
                      <Separator />
                      <AddressBlock address={order.billing_address} label="Billing Address" />
                    </>
                  )}
              </CardContent>
            </Card>
          )}

          {/* Payment Summary card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge className={`${paymentColors[order.payment_status] ?? ""} border text-xs`}>
                  {order.payment_status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="capitalize">{order.payment_method?.replace(/_/g, " ") ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Amount</span>
                <span>Rs {Number(order.total).toLocaleString("en-IN")}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
