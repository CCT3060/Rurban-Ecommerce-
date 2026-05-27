"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardData = {
  products: number;
  categories: number;
  orders: number;
};

export default function WarehouseDashboardPage() {
  const [data, setData] = useState<DashboardData>({ products: 0, categories: 0, orders: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [productsRes, categoriesRes, ordersRes] = await Promise.all([
          fetch("/api/warehouse/products", { cache: "no-store" }),
          fetch("/api/warehouse/categories", { cache: "no-store" }),
          fetch("/api/warehouse/orders", { cache: "no-store" }),
        ]);

        const productsJson = (await productsRes.json()) as { data?: unknown[] };
        const categoriesJson = (await categoriesRes.json()) as { data?: unknown[] };
        const ordersJson = (await ordersRes.json()) as { data?: unknown[] };

        setData({
          products: productsJson.data?.length ?? 0,
          categories: categoriesJson.data?.length ?? 0,
          orders: ordersJson.data?.length ?? 0,
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Warehouse-level summary</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Products</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{loading ? "-" : data.products}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Categories</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{loading ? "-" : data.categories}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Orders</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{loading ? "-" : data.orders}</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
