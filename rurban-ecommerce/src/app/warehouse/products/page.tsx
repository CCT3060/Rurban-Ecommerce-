"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/constants";
import { toast } from "sonner";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  stock: number;
  status: "active" | "inactive" | "draft";
};

export default function WarehouseProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/warehouse/products", { cache: "no-store" });
      const json = (await response.json()) as { data?: ProductRow[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to load products");
      setProducts(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProducts();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      const response = await fetch(`/api/warehouse/products/${id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to delete product");
      toast.success("Product deleted");
      await fetchProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete product");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Warehouse Products</h2>
          <p className="text-sm text-muted-foreground">Manage products for your warehouse</p>
        </div>
        <Link href="/warehouse/products/new">
          <Button className="gap-2"><Plus className="h-4 w-4" /> Add Product</Button>
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Products</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products in this warehouse yet.</p>
          ) : (
            products.map((product) => (
              <div key={product.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(product.sale_price ?? product.price)} · Stock: {product.stock}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={product.status === "active" ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-700 border-0"}>{product.status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => window.open(`/product/${product.slug}`, "_blank", "noopener,noreferrer")}><Eye className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => router.push(`/warehouse/products/${product.id}`)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => void handleDelete(product.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
