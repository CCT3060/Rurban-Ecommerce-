"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Link from "next/link";
import { generateSlug } from "@/lib/constants";

type CategoryOption = {
  id: string;
  name: string;
};

type UnitValue = "g" | "kg" | "Nos";

type QuantityPriceRow = {
  id: string;
  quantity: string;
  unit: UnitValue;
  price: string;
  salePrice: string;
};

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [stock, setStock] = useState("0");
  const [stockUnit, setStockUnit] = useState<UnitValue>("Nos");
  const [brand, setBrand] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "draft">("active");
  const [categoryId, setCategoryId] = useState("none");
  const [isFeatured, setIsFeatured] = useState(false);
  const [isTrending, setIsTrending] = useState(false);
  const [isNewArrival, setIsNewArrival] = useState(true);
  const [quantityRows, setQuantityRows] = useState<QuantityPriceRow[]>([
    { id: crypto.randomUUID(), quantity: "", unit: "g", price: "", salePrice: "" },
  ]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch("/api/admin/categories", { cache: "no-store" });
        const json = (await response.json()) as { data?: CategoryOption[]; error?: string };
        if (!response.ok) throw new Error(json.error || "Failed to load categories");
        setCategories((json.data ?? []).filter((category) => category.id));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load categories");
      }
    };

    void loadCategories();
  }, []);

  const effectiveSlug = useMemo(() => {
    if (slug.trim()) return slug.trim().toLowerCase();
    return generateSlug(name.trim());
  }, [name, slug]);

  const uploadImage = async () => {
    if (!imageFile) return imageUrl;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("productName", name.trim() || effectiveSlug || "product");

      const response = await fetch("/api/admin/uploads/product-image", {
        method: "POST",
        body: formData,
      });

      const json = (await response.json()) as { data?: { url?: string }; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to upload product image");
      const uploadedUrl = json.data?.url;
      if (!uploadedUrl) throw new Error("Failed to resolve uploaded image URL");

      setImageUrl(uploadedUrl);
      return uploadedUrl;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const uploadedUrl = await uploadImage();

      const normalizedRows = quantityRows
        .map((row) => ({
          quantity: Number(row.quantity),
          unit: row.unit,
          price: Number(row.price),
          salePrice: row.salePrice ? Number(row.salePrice) : null,
        }))
        .filter((row) => Number.isFinite(row.quantity) && row.quantity > 0 && Number.isFinite(row.price) && row.price > 0);

      if (normalizedRows.length === 0) {
        throw new Error("Add at least one valid quantity row with quantity and price.");
      }

      const primaryRow = normalizedRows[0];
      const primarySellingPrice = primaryRow.salePrice ?? primaryRow.price;
      const parsedStock = Number(stock);
      if (!Number.isFinite(parsedStock) || parsedStock < 0) {
        throw new Error("Total stock quantity must be a valid number.");
      }

      const tagList = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const payload = {
        name: name.trim(),
        slug: effectiveSlug,
        short_description: shortDescription.trim() || null,
        description: description.trim() || null,
        price: primaryRow.price,
        sale_price: primaryRow.salePrice,
        sku: sku.trim() || null,
        stock: parsedStock,
        brand: brand.trim() || null,
        tags: Array.from(new Set([...tagList, `stock-unit:${stockUnit}`])),
        status,
        category_id: categoryId === "none" ? null : categoryId,
        is_featured: isFeatured,
        is_trending: isTrending,
        is_new_arrival: isNewArrival,
        image_url: uploadedUrl || imageUrl,
        variants: normalizedRows.map((row) => ({
          name: `${row.quantity} ${row.unit}`,
          type: row.unit === "Nos" ? "size" : "weight",
          value: `${row.quantity} ${row.unit}`,
          price_modifier: (row.salePrice ?? row.price) - primarySellingPrice,
          stock: parsedStock,
          sku: sku.trim() ? `${sku.trim()}-${row.quantity}${row.unit}` : null,
        })),
      };

      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to create product");

      toast.success("Product created successfully!");
      router.push("/admin/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/products">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg border">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Add New Product</h1>
          <p className="text-sm text-muted-foreground">Fill in the details to create a new product</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: main form ── */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6 space-y-6">

                {/* Product Name + Slug */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      Product Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      required
                      placeholder="Enter product name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11"
                    />
                    {!slug && name && (
                      <p className="text-xs text-muted-foreground">Slug: {effectiveSlug}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-muted-foreground">Slug (URL)</Label>
                    <Input
                      placeholder="auto-generated-from-name"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <Separator />

                {/* Thumbnail */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Product Thumbnail (Primary Image)</Label>
                  <label
                    htmlFor="product-image"
                    className="flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <span className="text-xs bg-muted border rounded px-2 py-1 font-medium shrink-0">Choose File</span>
                    <span className="text-sm text-muted-foreground truncate">
                      {imageFile ? imageFile.name : "No file chosen"}
                    </span>
                    {imageUrl && (
                      <span className="ml-auto text-xs text-green-600 font-medium shrink-0">Uploaded ✓</span>
                    )}
                  </label>
                  <Input
                    id="product-image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setImageFile(file);
                      setImageUrl(null);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Upload primary product image (JPG, PNG - Max 5MB)</p>
                </div>

                <Separator />

                {/* Description */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Description</Label>
                    <Textarea
                      placeholder="Enter product description"
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="resize-y"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Short Description / Ingredients</Label>
                    <Textarea
                      placeholder="Short summary, ingredients, key notes..."
                      rows={3}
                      value={shortDescription}
                      onChange={(e) => setShortDescription(e.target.value)}
                      className="resize-y"
                    />
                  </div>
                </div>

                <Separator />

                {/* Quantity & Pricing Variants */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Quantity &amp; Pricing Variants</p>
                  {quantityRows.map((row, idx) => (
                    <div key={row.id} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Variant {idx + 1}
                        </span>
                        {quantityRows.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive px-2"
                            onClick={() => setQuantityRows((prev) => prev.filter((item) => item.id !== row.id))}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="100"
                            value={row.quantity}
                            onChange={(e) => {
                              const value = e.target.value;
                              setQuantityRows((prev) =>
                                prev.map((item) => (item.id === row.id ? { ...item, quantity: value } : item))
                              );
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit</Label>
                          <Select
                            value={row.unit}
                            onValueChange={(value) => {
                              const nextUnit = (value || "g") as UnitValue;
                              setQuantityRows((prev) =>
                                prev.map((item) => (item.id === row.id ? { ...item, unit: nextUnit } : item))
                              );
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="g">g</SelectItem>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="Nos">Nos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Price (₹)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="125"
                            value={row.price}
                            onChange={(e) => {
                              const value = e.target.value;
                              setQuantityRows((prev) =>
                                prev.map((item) => (item.id === row.id ? { ...item, price: value } : item))
                              );
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Sale Price (₹)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="110"
                            value={row.salePrice}
                            onChange={(e) => {
                              const value = e.target.value;
                              setQuantityRows((prev) =>
                                prev.map((item) => (item.id === row.id ? { ...item, salePrice: value } : item))
                              );
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-9"
                    onClick={() =>
                      setQuantityRows((prev) => [
                        ...prev,
                        { id: crypto.randomUUID(), quantity: "", unit: "g", price: "", salePrice: "" },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4" /> Add Variant
                  </Button>
                </div>

                <Separator />

                {/* Inventory & Details */}
                <div className="space-y-4">
                  <p className="text-sm font-semibold">Inventory &amp; Details</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Batch Code (SKU)</Label>
                      <Input placeholder="WH-001" value={sku} onChange={(e) => setSku(e.target.value)} className="h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Total Stock</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Stock Unit</Label>
                      <Select value={stockUnit} onValueChange={(value) => setStockUnit((value || "Nos") as UnitValue)}>
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="Nos">Nos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Brand / Manufacturer</Label>
                    <Input placeholder="Brand name" value={brand} onChange={(e) => setBrand(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      Tags <span className="text-muted-foreground text-xs">(comma separated)</span>
                    </Label>
                    <Input placeholder="organic, sugar-free, gluten-free" value={tags} onChange={(e) => setTags(e.target.value)} className="h-11" />
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold">Status</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Select
                  value={status}
                  onValueChange={(value) => {
                    if (!value) return;
                    setStatus(value as "active" | "inactive" | "draft");
                  }}
                >
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Active</span>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-gray-400 inline-block" /> Inactive</span>
                    </SelectItem>
                    <SelectItem value="draft">
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" /> Draft</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold">Category</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value || "none")}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="none">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold">Visibility</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {[
                  { id: "featured", label: "Featured", checked: isFeatured, onChange: setIsFeatured },
                  { id: "trending", label: "Trending", checked: isTrending, onChange: setIsTrending },
                  { id: "newArrival", label: "New Arrival", checked: isNewArrival, onChange: setIsNewArrival },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <Label htmlFor={item.id} className="text-sm cursor-pointer">{item.label}</Label>
                    <Switch id={item.id} checked={item.checked} onCheckedChange={item.onChange} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={loading || uploading} className="w-full gap-2 h-11">
                <Save className="h-4 w-4" />
                {loading || uploading ? "Saving..." : "Save Product"}
              </Button>
              <Link href="/admin/products" className="w-full">
                <Button type="button" variant="outline" className="w-full h-11">Cancel</Button>
              </Link>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}
