"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  hsn_or_sac: string | null;
  price: number;
  sale_price: number | null;
  stock: number;
  status: "active" | "inactive" | "draft";
  intra_state_tax_rate: number | null;
  inter_state_tax_rate: number | null;
  zoho_unit: string | null;
  zoho_item_type: string | null;
  category: { id: string; name: string } | null;
};

function downloadCsv(products: ProductRow[]) {
  const header = "Name,SKU,HSN/SAC,Category,Price,Sale Price,Stock,Intra Tax,Inter Tax,Status,Unit,Item Type\n";
  const rows = products.map((p) =>
    [
      `"${p.name.replace(/"/g, '""')}"`,
      p.sku ?? "",
      p.hsn_or_sac ?? "",
      p.category?.name ?? "",
      p.price,
      p.sale_price ?? "",
      p.stock,
      p.intra_state_tax_rate != null ? `${p.intra_state_tax_rate}%` : "0%",
      p.inter_state_tax_rate != null ? `${p.inter_state_tax_rate}%` : "0%",
      p.status,
      p.zoho_unit ?? "",
      p.zoho_item_type ?? "",
    ].join(",")
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "warehouse_products.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function WarehouseProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

  useEffect(() => { void fetchProducts(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      (p.hsn_or_sac ?? "").includes(q) ||
      (p.category?.name ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Warehouse Products</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loadingâ€¦" : `${products.length.toLocaleString()} products`}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, SKU, HSN/SAC or category…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>HSN/SAC</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Intra Tax</TableHead>
                  <TableHead>Inter Tax</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Item Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                      No products found.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium max-w-[240px]">
                      <span className="line-clamp-2">{p.name}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {p.sku ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {p.hsn_or_sac ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.category?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      ₹{(p.sale_price ?? p.price).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={p.stock === 0 ? "text-destructive font-semibold" : "text-sm"}>
                        {p.stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.intra_state_tax_rate != null ? `${p.intra_state_tax_rate}%` : "0%"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.inter_state_tax_rate != null ? `${p.inter_state_tax_rate}%` : "0%"}
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        p.status === "active"
                          ? "bg-green-100 text-green-700 border-0"
                          : p.status === "draft"
                          ? "bg-yellow-100 text-yellow-700 border-0"
                          : "bg-gray-100 text-gray-700 border-0"
                      }>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{p.zoho_unit ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.zoho_item_type ?? "—"}</TableCell>
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
