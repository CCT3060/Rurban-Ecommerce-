"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye, LayoutGrid, List, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice, IMAGE_PLACEHOLDER } from "@/lib/constants";
import { normalizeSupabaseImageUrl } from "@/lib/utils";
import { toast } from "sonner";

type ApiCategory = { name?: string } | { name?: string }[] | null;
type ApiImage = { image_url: string; is_primary: boolean };
type ApiProduct = {
  id: string;
  slug: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  price: number;
  sale_price: number | null;
  stock: number;
  status: "active" | "inactive" | "draft";
  category: ApiCategory;
  images: ApiImage[] | null;
};

type ProductRow = {
  id: string;
  slug: string;
  categoryId: string | null;
  name: string;
  sku: string;
  price: number;
  salePrice: number | null;
  stock: number;
  status: "active" | "inactive" | "draft";
  categoryName: string;
  image: string;
};

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    const queryCategoryId = new URLSearchParams(window.location.search).get("categoryId");
    if (queryCategoryId) {
      setCategoryFilter(queryCategoryId);
    }
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/products", { cache: "no-store" });
      const json = (await response.json()) as { data?: ApiProduct[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to load products");

      const mapped = (json.data ?? []).map((product) => {
        const categoryValue = product.category;
        const category = Array.isArray(categoryValue) ? categoryValue[0] : categoryValue;
        const images = product.images ?? [];
        const primaryImage = images.find((image) => image.is_primary)?.image_url ?? images[0]?.image_url;

        return {
          id: product.id,
          slug: product.slug,
          categoryId: product.category_id,
          name: product.name,
          sku: product.sku ?? "-",
          price: Number(product.price),
          salePrice: product.sale_price === null ? null : Number(product.sale_price),
          stock: Number(product.stock),
          status: product.status,
          categoryName: category?.name || "Uncategorized",
          image: normalizeSupabaseImageUrl(primaryImage) || IMAGE_PLACEHOLDER,
        } satisfies ProductRow;
      });

      setProducts(mapped);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProducts();
  }, []);

  const filtered = useMemo(
    () =>
      products.filter((product) => {
        const searchLower = search.toLowerCase();
        const matchSearch =
          product.name.toLowerCase().includes(searchLower) ||
          product.sku.toLowerCase().includes(searchLower);
        const matchStatus = statusFilter === "all" || product.status === statusFilter;
        const matchCategory = categoryFilter === "all" || product.categoryId === categoryFilter;
        return matchSearch && matchStatus && matchCategory;
      }),
    [products, search, statusFilter, categoryFilter]
  );

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Delete this product?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to delete product");
      toast.success("Product deleted");
      await fetchProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete product");
    }
  };

  const handleStatusChange = async (id: string, status: "active" | "inactive" | "draft") => {
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to update product status");
      toast.success("Product status updated");
      await fetchProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">{products.length} total products</p>
        </div>
        <Link href="/admin/products/new">
          <Button className="gap-2"><Plus className="h-4 w-4" /> Add Product</Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <div className="inline-flex items-center rounded-2xl border bg-background p-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={`h-9 w-9 rounded-xl ${viewMode === "grid" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:bg-muted"}`}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={`h-9 w-9 rounded-xl ${viewMode === "table" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:bg-muted"}`}
                onClick={() => setViewMode("table")}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {categoryFilter !== "all" && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              Filtered by category
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-muted"
                onClick={() => {
                  setCategoryFilter("all");
                  router.push("/admin/products");
                }}
                aria-label="Clear category filter"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {viewMode === "table" ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Loading products...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No products found.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-muted">
                        <Image src={product.image} alt={product.name} fill className="object-cover" sizes="40px" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{product.sku}</TableCell>
                    <TableCell className="text-sm">{product.categoryName}</TableCell>
                    <TableCell className="text-right">
                      <div>
                        <span className="font-medium">{formatPrice(product.salePrice ?? product.price)}</span>
                        {product.salePrice && (
                          <span className="text-xs text-muted-foreground line-through ml-1">{formatPrice(product.price)}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`border-0 ${product.stock === 0 ? "bg-red-100 text-red-700" : product.stock <= 10 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                        {product.stock}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.status === "active" ? "default" : "secondary"} className={product.status === "active" ? "bg-green-100 text-green-700 border-0" : product.status === "draft" ? "bg-yellow-100 text-yellow-700 border-0" : ""}>
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => window.open(`/product/${product.slug}`, "_blank", "noopener,noreferrer")}>
                            <Eye className="h-4 w-4 mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/admin/products/${product.id}`)}>
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleStatusChange(product.id, "active")}>Set Active</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleStatusChange(product.id, "inactive")}>Set Inactive</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleStatusChange(product.id, "draft")}>Set Draft</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => void handleDelete(product.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          ) : (
            <div className="p-4">
              {loading ? (
                <div className="text-center text-muted-foreground py-8">Loading products...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No products found.</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filtered.map((product) => (
                    <Card key={product.id} className="overflow-hidden border-border/70">
                      <div className="relative aspect-square bg-muted/20">
                        <Image src={product.image} alt={product.name} fill className="object-cover" sizes="240px" />
                      </div>
                      <CardContent className="p-3 space-y-2">
                        <p className="font-medium text-sm line-clamp-2 min-h-[40px]">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.categoryName}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{formatPrice(product.salePrice ?? product.price)}</span>
                          <Badge className={`border-0 text-[10px] ${product.stock === 0 ? "bg-red-100 text-red-700" : product.stock <= 10 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                            {product.stock}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Button type="button" size="sm" variant="outline" className="h-8 flex-1" onClick={() => router.push(`/admin/products/${product.id}`)}>
                            <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => window.open(`/product/${product.slug}`, "_blank", "noopener,noreferrer")}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
