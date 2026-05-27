import {
  Store, Package, ShoppingCart, CalendarDays,
  ArrowRight, TrendingUp, AlertTriangle, ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import RevenueChart from "./_RevenueChart";

type RecentOrder = {
  id: string;
  order_number: string;
  total: number;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  created_at: string;
  user: { full_name: string | null } | null;
};

type TopProduct = {
  name: string;
  sold: number;
  revenue: number;
};

type LowStockProduct = {
  id: string;
  name: string;
  stock: number;
  sku: string | null;
};

type RecentOrderQueryRow = {
  id: string;
  order_number: string;
  total: number | string | null;
  status: RecentOrder["status"];
  created_at: string;
  user: { full_name: string | null } | Array<{ full_name: string | null }> | null;
};

type AllOrderRow = { id: string; total: number | string | null; created_at: string };
type OrderItemRow = { product_id: string | null; name: string | null; quantity: number | null; price: number | string | null };

async function getDashboardData() {
  const admin = createAdminClient();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleString("en-GB", { month: "short", year: "2-digit" }));
  }

  const [
    allOrdersRes,
    todayOrdersRes,
    monthOrdersRes,
    warehousesRes,
    productsRes,
    recentOrdersRes,
    orderItemsRes,
    lowStockRes,
  ] = await Promise.all([
    admin.from("orders").select("id,total,created_at"),
    admin.from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
    admin.from("orders").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    admin.from("warehouses").select("id", { count: "exact", head: true }).eq("is_active", true),
    admin.from("products").select("id", { count: "exact", head: true }),
    admin.from("orders").select("id,order_number,total,status,created_at,user:profiles(full_name)").order("created_at", { ascending: false }).limit(5),
    admin.from("order_items").select("product_id,name,quantity,price"),
    admin.from("products").select("id,name,sku,stock").gt("stock", 0).order("stock", { ascending: true }).limit(5),
  ]);

  const revenueByMonth = new Map<string, number>();
  for (const order of (allOrdersRes.data ?? []) as AllOrderRow[]) {
    const d = new Date(order.created_at);
    const key = d.toLocaleString("en-GB", { month: "short", year: "2-digit" });
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(order.total || 0));
  }
  const revenueData = months.map((month) => ({ month, revenue: revenueByMonth.get(month) ?? 0 }));

  const totalRevenue = ((allOrdersRes.data ?? []) as AllOrderRow[]).reduce((sum, o) => sum + Number(o.total || 0), 0);

  const topByProduct = new Map<string, TopProduct>();
  for (const row of (orderItemsRes.data ?? []) as OrderItemRow[]) {
    const key = row.product_id || row.name || "unknown";
    const existing = topByProduct.get(key) || ({ name: row.name || "Unknown Product", sold: 0, revenue: 0 } as TopProduct);
    existing.sold += Number(row.quantity || 0);
    existing.revenue += Number(row.quantity || 0) * Number(row.price || 0);
    topByProduct.set(key, existing);
  }
  const topProducts = Array.from(topByProduct.values()).sort((a, b) => b.sold - a.sold).slice(0, 5);

  const recentOrders: RecentOrder[] = ((recentOrdersRes.data ?? []) as RecentOrderQueryRow[]).map((row) => ({
    id: row.id,
    order_number: row.order_number,
    total: Number(row.total || 0),
    status: row.status,
    created_at: row.created_at,
    user: Array.isArray(row.user) ? (row.user[0] ?? null) : (row.user ?? null),
  }));

  return {
    totalRevenue,
    todayOrders: todayOrdersRes.count ?? 0,
    monthOrders: monthOrdersRes.count ?? 0,
    warehouses: warehousesRes.count ?? 0,
    totalProducts: productsRes.count ?? 0,
    recentOrders,
    topProducts,
    lowStockProducts: (lowStockRes.data ?? []) as LowStockProduct[],
    revenueData,
  };
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-sky-100 text-sky-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminDashboard() {
  const dataPromise = getDashboardData();
  return <DashboardContent dataPromise={dataPromise} />;
}

async function DashboardContent({ dataPromise }: { dataPromise: ReturnType<typeof getDashboardData> }) {
  const {
    totalRevenue,
    todayOrders,
    monthOrders,
    warehouses,
    totalProducts,
    recentOrders,
    topProducts,
    lowStockProducts,
    revenueData,
  } = await dataPromise;

  const now = new Date();
  const todayLabel = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const monthLabel = now.toLocaleString("en-GB", { month: "long", year: "numeric" });

  const statCards = [
    {
      label: "Stores",
      value: warehouses,
      icon: Store,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      footer: (
        <Link href="/admin/warehouses" className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
          Manage <ArrowRight className="h-3 w-3" />
        </Link>
      ),
    },
    {
      label: "Products",
      value: totalProducts,
      icon: Package,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      footer: (
        <Link href="/admin/products" className="flex items-center gap-1 text-xs text-amber-600 font-medium">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      ),
    },
    {
      label: "Today'\s Orders",
      value: todayOrders,
      icon: ShoppingCart,
      iconBg: "bg-rose-100",
      iconColor: "text-rose-600",
      footer: <span className="text-xs text-muted-foreground">{todayLabel}</span>,
    },
    {
      label: "Month Orders",
      value: monthOrders,
      icon: CalendarDays,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
      footer: <span className="text-xs text-muted-foreground">{monthLabel}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome back, Admin!</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-medium">{card.label}</span>
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                  <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-3xl font-bold">{card.value}</p>
              <div>{card.footer}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">Revenue Overview</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total · ₹{totalRevenue.toLocaleString("en-IN")}
            </p>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Last 12 months
          </Badge>
        </CardHeader>
        <CardContent className="pt-2">
          <RevenueChart data={revenueData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <Link href="/admin/orders">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View All <ArrowUpRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentOrders.length === 0 && (
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              )}
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{order.user?.full_name || "Customer"}</p>
                    <p className="text-xs text-muted-foreground">{order.order_number} · {new Date(order.created_at).toLocaleDateString("en-GB")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">₹{Number(order.total).toLocaleString("en-IN")}</p>
                    <Badge className={`text-[10px] px-1.5 py-0 border-0 ${statusColors[order.status]}`}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Top Selling Products</CardTitle>
            <Link href="/admin/products">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View All <ArrowUpRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topProducts.length === 0 && (
                <p className="text-sm text-muted-foreground">No sales data yet.</p>
              )}
              {topProducts.map((product, i) => (
                <div key={product.name} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-medium w-5">#{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sold} sold</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">₹{product.revenue.toLocaleString("en-IN")}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-orange-200">
        <CardHeader className="flex flex-row items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <CardTitle className="text-lg">Low Stock Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {lowStockProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">No low-stock products right now.</p>
            )}
            {lowStockProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {product.sku || "-"}</p>
                </div>
                <Badge className="bg-orange-100 text-orange-700 border-0">
                  {product.stock} left
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
