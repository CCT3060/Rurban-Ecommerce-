"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search, RefreshCw, Loader2, Pencil, Upload, X, ImageIcon, ChevronLeft, ChevronRight, Download,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type DBProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  sale_price: number | null;
  sku: string | null;
  stock: number;
  brand: string | null;
  tags: string[];
  category_id: string | null;
  status: "active" | "inactive" | "draft";
  is_featured: boolean;
  is_trending: boolean;
  is_new_arrival: boolean;
  zoho_item_id: string | null;
  zoho_category_name: string | null;
  hsn_or_sac: string | null;
  product_type: string | null;
  zoho_unit: string | null;
  zoho_item_type: string | null;
  intra_state_tax_name: string | null;
  intra_state_tax_rate: number | null;
  intra_state_tax_type: string | null;
  inter_state_tax_name: string | null;
  inter_state_tax_rate: number | null;
  category: { id: string; name: string } | null;
  images: { id: string; image_url: string; is_primary: boolean; sort_order: number }[];
};

type Category = { id: string; name: string; slug: string };

const PAGE_SIZE = 50;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [editProduct, setEditProduct] = useState<DBProduct | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProducts = useCallback(async (p = 1, q = search, st = statusFilter, cat = categoryFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      if (q) params.set("search", q);
      if (st && st !== "all") params.set("status", st);
      if (cat && cat !== "all") params.set("categoryId", cat);
      const res = await fetch(`/api/admin/products?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as { data?: DBProduct[]; total?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load products");
      setProducts(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => {
    void fetchProducts(1);
    void fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((j: { data?: Category[] }) => setCategories(j.data ?? []))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchChange = (v: string) => {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(v);
      setPage(1);
      void fetchProducts(1, v, statusFilter, categoryFilter);
    }, 350);
  };

  const handleFilter = (field: "status" | "category", value: string) => {
    const newStatus = field === "status" ? value : statusFilter;
    const newCat = field === "category" ? value : categoryFilter;
    if (field === "status") setStatusFilter(value);
    if (field === "category") setCategoryFilter(value);
    setPage(1);
    void fetchProducts(1, search, newStatus, newCat);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handlePage = (next: number) => {
    setPage(next);
    void fetchProducts(next);
  };

  const onProductSaved = (updated: DBProduct) => {
    setProducts((prev) => prev.map((p) => p.id === updated.id ? { ...p, ...updated } : p));
    setEditProduct(updated);
  };

  const exportAllProducts = async () => {
    try {
      toast.info("Exporting all products…");
      // Fetch all pages
      const allProducts: DBProduct[] = [];
      let p = 1;
      while (true) {
        const params = new URLSearchParams({ page: String(p), limit: "1000" });
        const res = await fetch(`/api/admin/products?${params.toString()}`, { cache: "no-store" });
        const json = (await res.json()) as { data?: DBProduct[]; total?: number };
        const batch = json.data ?? [];
        allProducts.push(...batch);
        if (allProducts.length >= (json.total ?? 0) || batch.length === 0) break;
        p++;
      }
      const header = "Name,SKU,Category,Price,Sale Price,Stock,Status\n";
      const rows = allProducts.map((p) =>
        [
          `"${(p.name ?? "").replace(/"/g, '""')}"`,
          p.sku ?? "",
          `"${(p.category?.name ?? "").replace(/"/g, '""')}"`,
          p.price,
          p.sale_price ?? "",
          p.stock,
          p.status,
        ].join(",")
      ).join("\n");
      const blob = new Blob([header + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "products_export.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${allProducts.length} products`);
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${total.toLocaleString()} product${total !== 1 ? "s" : ""} in database`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void exportAllProducts()} disabled={loading}>
            <Download className="h-4 w-4" /> Export All
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => void fetchProducts(page)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, SKU, HSN/SAC, category…"
                className="pl-9"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => v && handleFilter("category", v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => v && handleFilter("status", v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Loading products…</p>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
              <p className="text-sm font-medium">No products found.</p>
              <p className="text-xs">Sync from Zoho Books to import products, or adjust filters.</p>
            </div>
          ) : (
            <ProductsTable products={products} onEdit={setEditProduct} />
          )}
        </CardContent>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
            <span className="text-muted-foreground">
              Page {page} of {totalPages} · {total.toLocaleString()} products
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => handlePage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => handlePage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {editProduct && (
        <Sheet open={!!editProduct} onOpenChange={(o) => { if (!o) setEditProduct(null); }}>
          <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
            <EditProductSheet
              product={editProduct}
              categories={categories}
              onSaved={onProductSaved}
              onClose={() => setEditProduct(null)}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

// ── Products Table ────────────────────────────────────────────────────────────

function ProductsTable({ products, onEdit }: { products: DBProduct[]; onEdit: (p: DBProduct) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" />
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
        {products.map((product) => (
          <TableRow key={product.id} className="group">
            <TableCell>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onEdit(product)}
                title="Edit product"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </TableCell>
            <TableCell className="font-medium max-w-[220px] truncate">{product.name}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
              {product.sku ?? "—"}
            </TableCell>
            <TableCell className="text-xs whitespace-nowrap">{product.hsn_or_sac ?? "—"}</TableCell>
            <TableCell className="text-xs whitespace-nowrap">
              {product.category?.name ?? product.zoho_category_name ?? "—"}
            </TableCell>
            <TableCell className="text-xs text-right whitespace-nowrap">
              ₹{Number(product.price).toLocaleString("en-IN")}
              {product.sale_price != null && (
                <span className="ml-1 text-green-600">/ ₹{Number(product.sale_price).toLocaleString("en-IN")}</span>
              )}
            </TableCell>
            <TableCell className="text-xs text-right whitespace-nowrap">
              <span className={product.stock <= 0 ? "text-red-500" : ""}>{product.stock}</span>
            </TableCell>
            <TableCell className="text-xs whitespace-nowrap">
              {product.intra_state_tax_name ?? "—"}
              {product.intra_state_tax_rate != null && (
                <span className="ml-1 text-muted-foreground">{product.intra_state_tax_rate}%</span>
              )}
            </TableCell>
            <TableCell className="text-xs whitespace-nowrap">
              {product.inter_state_tax_name ?? "—"}
              {product.inter_state_tax_rate != null && (
                <span className="ml-1 text-muted-foreground">{product.inter_state_tax_rate}%</span>
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge
                variant="secondary"
                className={`border-0 text-[10px] ${
                  product.status === "active"
                    ? "bg-green-100 text-green-700"
                    : product.status === "draft"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {product.status}
              </Badge>
            </TableCell>
            <TableCell className="text-xs whitespace-nowrap">{product.zoho_unit ?? "—"}</TableCell>
            <TableCell className="text-xs capitalize whitespace-nowrap">{product.zoho_item_type ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Edit Sheet ────────────────────────────────────────────────────────────────

function EditProductSheet({
  product,
  categories,
  onSaved,
  onClose,
}: {
  product: DBProduct;
  categories: Category[];
  onSaved: (updated: DBProduct) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [shortDescription, setShortDescription] = useState(product.short_description ?? "");
  const [price, setPrice] = useState(String(product.price));
  const [salePrice, setSalePrice] = useState(product.sale_price != null ? String(product.sale_price) : "");
  const [stock, setStock] = useState(String(product.stock));
  const [brand, setBrand] = useState(product.brand ?? "");
  const [categoryId, setCategoryId] = useState(product.category_id ?? "none");
  const [status, setStatus] = useState<"active" | "inactive" | "draft">(product.status);
  const [isFeatured, setIsFeatured] = useState(product.is_featured);
  const [isTrending, setIsTrending] = useState(product.is_trending);
  const [isNewArrival, setIsNewArrival] = useState(product.is_new_arrival);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState(product.images ?? []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("productName", name);
      const uploadRes = await fetch("/api/admin/uploads/product-image", { method: "POST", body: formData });
      const uploadJson = (await uploadRes.json()) as { data?: { url: string }; error?: string };
      if (!uploadRes.ok) throw new Error(uploadJson.error ?? "Upload failed");

      const saveRes = await fetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: uploadJson.data!.url }),
      });
      const saveJson = (await saveRes.json()) as { data?: DBProduct };
      if (saveJson.data) {
        setImages(saveJson.data.images ?? []);
        onSaved(saveJson.data);
      } else {
        setImages((prev) => [
          ...prev,
          { id: `temp-${Date.now()}`, image_url: uploadJson.data!.url, is_primary: prev.length === 0, sort_order: prev.length },
        ]);
      }
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async (imgId: string) => {
    setImages((prev) => prev.filter((i) => i.id !== imgId));
    if (imgId.startsWith("temp-")) return;
    try {
      await fetch(`/api/admin/products/${product.id}/images/${imgId}`, { method: "DELETE" });
      toast.success("Image removed");
    } catch {
      toast.error("Failed to remove image");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          short_description: shortDescription.trim() || null,
          price: Number(price) || 0,
          sale_price: salePrice ? Number(salePrice) : null,
          stock: Number(stock) || 0,
          brand: brand.trim() || null,
          category_id: categoryId === "none" ? null : categoryId,
          status,
          is_featured: isFeatured,
          is_trending: isTrending,
          is_new_arrival: isNewArrival,
        }),
      });
      const json = (await res.json()) as { data?: DBProduct; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      toast.success("Product saved");
      onSaved(json.data!);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-screen">
      <SheetHeader className="px-6 py-5 border-b shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <SheetTitle className="truncate">{product.name}</SheetTitle>
            <SheetDescription className="font-mono text-xs mt-0.5">
              SKU: {product.sku ?? "—"}{product.zoho_item_id ? ` · Zoho: ${product.zoho_item_id}` : ""}
            </SheetDescription>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 -mt-1" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <section className="space-y-3">
          <Label className="text-sm font-semibold">Product Images</Label>
          <div className="flex flex-wrap gap-3">
            {images.map((img) => (
              <div key={img.id} className="relative group w-24 h-24 rounded-lg overflow-hidden border bg-muted shrink-0">
                <Image src={img.image_url} alt="product" fill className="object-cover" sizes="96px" />
                {img.is_primary && (
                  <span className="absolute top-1 left-1 text-[9px] bg-black/60 text-white px-1 rounded leading-tight">Primary</span>
                )}
                <button
                  type="button"
                  onClick={() => void handleRemoveImage(img.id)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40 shrink-0"
              disabled={uploadingImage}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <><Upload className="h-5 w-5" /><span className="text-[10px] font-medium">Add Image</span></>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageUpload(f); e.target.value = ""; }}
            />
          </div>
          {images.length === 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" /> No images yet. Upload one above.
            </p>
          )}
        </section>

        <Separator />

        {product.zoho_item_id && (
          <>
            <section className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="HSN/SAC" value={product.hsn_or_sac ?? "—"} />
              <InfoRow label="Product Type" value={product.product_type ?? "—"} />
              <InfoRow label="Usage Unit" value={product.zoho_unit ?? "—"} />
              <InfoRow label="Item Type" value={product.zoho_item_type ?? "—"} />
              <InfoRow label="Zoho Category" value={product.zoho_category_name ?? "—"} />
              <InfoRow
                label="Intra State Tax"
                value={[product.intra_state_tax_name, product.intra_state_tax_rate != null ? `${product.intra_state_tax_rate}%` : null].filter(Boolean).join(" · ") || "—"}
              />
              <InfoRow
                label="Inter State Tax"
                value={[product.inter_state_tax_name, product.inter_state_tax_rate != null ? `${product.inter_state_tax_rate}%` : null].filter(Boolean).join(" · ") || "—"}
              />
            </section>
            <Separator />
          </>
        )}

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Store Details</h3>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-price">Price (₹)</Label>
              <Input id="edit-price" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-sale-price">Sale Price (₹)</Label>
              <Input id="edit-sale-price" type="number" min={0} step="0.01" placeholder="No sale" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-stock">Stock</Label>
              <Input id="edit-stock" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-brand">Brand</Label>
              <Input id="edit-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-category">Category</Label>
              <Select value={categoryId} onValueChange={(v) => v && setCategoryId(v)}>
                <SelectTrigger id="edit-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No Category —</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v as "active" | "inactive" | "draft")}>
                <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea id="edit-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Full product description…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-short-desc">Short Description</Label>
            <Textarea id="edit-short-desc" rows={2} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="Brief summary…" />
          </div>
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Display Flags</h3>
          <SwitchRow id="edit-featured" label="Featured" description="Show in Featured Products section" checked={isFeatured} onCheckedChange={setIsFeatured} />
          <SwitchRow id="edit-trending" label="Trending" description="Show in Trending section" checked={isTrending} onCheckedChange={setIsTrending} />
          <SwitchRow id="edit-new-arrival" label="New Arrival" description="Show in New Arrivals section" checked={isNewArrival} onCheckedChange={setIsNewArrival} />
        </section>
      </div>

      <div className="border-t px-6 py-4 flex items-center justify-end gap-3 bg-background shrink-0">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function SwitchRow({ id, label, description, checked, onCheckedChange }: {
  id: string; label: string; description: string; checked: boolean; onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
