"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type OrderRow = {
  id: string;
  order_number: string;
  total: number;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  payment_status: "pending" | "paid" | "failed" | "refunded";
  created_at: string;
  user: { full_name: string | null; email: string | null } | null;
  shipping_address: { full_name?: string; email?: string } | null;
  items: { id: string }[] | null;
};

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

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const totalCount = useMemo(() => orders.length, [orders]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      const json = (await response.json()) as { data?: OrderRow[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to load orders");
      setOrders(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
  }, []);

  const updateOrder = async (
    id: string,
    payload: Partial<Pick<OrderRow, "status" | "payment_status">>
  ) => {
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to update order");

      toast.success("Order updated");
      await fetchOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update order");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">{totalCount} orders</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading orders...</TableCell>
                  </TableRow>
                )}
                {!loading && orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No orders found.</TableCell>
                  </TableRow>
                )}
                {!loading && orders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                  >
                    <TableCell className="font-mono text-sm font-medium">{order.order_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{order.user?.full_name || order.shipping_address?.full_name || "Customer"}</p>
                        <p className="text-xs text-muted-foreground">{order.user?.email || order.shipping_address?.email || "-"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{order.items?.length ?? 0}</TableCell>
                    <TableCell className="text-right font-semibold">₹{Number(order.total).toLocaleString("en-IN")}</TableCell>
                    <TableCell><Badge className={`border-0 ${statusColors[order.status]}`}>{order.status}</Badge></TableCell>
                    <TableCell><Badge className={`border-0 ${paymentColors[order.payment_status]}`}>{order.payment_status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString("en-GB")}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                          onClick={(e) => e.stopPropagation()}
                        ><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => void updateOrder(order.id, { status: "confirmed" })}>Mark Confirmed</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void updateOrder(order.id, { status: "processing" })}>Mark Processing</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void updateOrder(order.id, { status: "shipped" })}>Mark Shipped</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void updateOrder(order.id, { status: "delivered" })}>Mark Delivered</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void updateOrder(order.id, { status: "cancelled" })}>Mark Cancelled</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void updateOrder(order.id, { payment_status: "paid" })}>Mark Paid</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void updateOrder(order.id, { payment_status: "refunded" })}>Mark Refunded</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
