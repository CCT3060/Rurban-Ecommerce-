"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type OrderRow = {
  id: string;
  order_number: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  user: { full_name: string | null; email: string | null } | null;
  items: Array<{ id: string; name: string; quantity: number }> | null;
};

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

export default function WarehouseOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/warehouse/orders", { cache: "no-store" });
        const json = (await response.json()) as { data?: OrderRow[]; error?: string };
        if (!response.ok) throw new Error(json.error || "Failed to load orders");
        setOrders(json.data ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Warehouse Orders</h2>
        <p className="text-sm text-muted-foreground">Only orders that contain your warehouse products</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Orders</span>
            {!loading && (
              <span className="text-sm font-normal text-muted-foreground">{orders.length} total</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">Loading orders...</p>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <ShoppingBag className="h-10 w-10 opacity-30" />
              <p className="text-sm">No orders found for your warehouse products.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {orders.map((order) => {
                const customerName =
                  order.user?.full_name || order.user?.email || "Customer";
                const itemCount = order.items?.length ?? 0;

                return (
                  <li key={order.id}>
                    <Link
                      href={`/warehouse/orders/${order.id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors group"
                    >
                      {/* Left */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{order.order_number}</p>
                          <Badge className={`${statusColors[order.status] ?? "bg-gray-100 text-gray-700"} border text-xs`}>
                            {order.status}
                          </Badge>
                          <Badge className={`${paymentColors[order.payment_status] ?? "bg-gray-100 text-gray-700"} border text-xs`}>
                            {order.payment_status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {customerName} &middot;{" "}
                          {new Date(order.created_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {itemCount} {itemCount === 1 ? "item" : "items"}
                        </p>
                      </div>

                      {/* Right */}
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="font-bold text-sm">
                          Rs {Number(order.total).toLocaleString("en-IN")}
                        </p>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
