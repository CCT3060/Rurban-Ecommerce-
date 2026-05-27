"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Upload, Plus } from "lucide-react";
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
  const [isNewArrival, setIsNewArrival] = useState(false);
  const [quantityRows, setQuantityRows] = useState<QuantityPriceRow[]>([
    { id: crypto.randomUUID(), quantity: "", unit: "g", price: "", salePrice: "" },
  ]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch("/api/warehouse/categories", { cache: "no-store" });
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
          price_modifier: row.price - primaryRow.price,
          stock: parsedStock,
          sku: sku.trim() ? `${sku.trim()}-${row.quantity}${row.unit}` : null,
        })),
      };

      const response = await fetch("/api/warehouse/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to create product");

      toast.success("Product created successfully!");
      router.push("/warehouse/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/warehouse/products">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Add Warehouse Product</h1>
          <p className="text-sm text-muted-foreground">Fill in the details to create a product in your warehouse</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Basic info */}
            <Card>
              <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Food/Product Name *</Label>
                  <Input
                    required
                    placeholder="Enter food name (e.g. Almonds 500g, Paneer Fresh)"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    placeholder="auto-generated-from-name"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                  />
                  {!slug && name && <p className="text-xs text-muted-foreground">Using: {effectiveSlug}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Short Description</Label>
                  <Textarea
                    placeholder="Short taste/quality summary..."
                    rows={2}
                    value={shortDescription}
                    onChange={(event) => setShortDescription(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Detailed food details, quality notes, usage ideas..."
                    rows={6}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader><CardTitle>Pricing & Inventory</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <Label>Quantity Pricing</Label>
                  {quantityRows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="100"
                            value={row.quantity}
                            onChange={(event) => {
                              const value = event.target.value;
                              setQuantityRows((prev) =>
                                prev.map((item) => (item.id === row.id ? { ...item, quantity: value } : item))
                              );
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Value</Label>
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
                          <Label>Price (Rs)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="125"
                            value={row.price}
                            onChange={(event) => {
                              const value = event.target.value;
                              setQuantityRows((prev) =>
                                prev.map((item) => (item.id === row.id ? { ...item, price: value } : item))
                              );
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Sale Price (Rs)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="110"
                            value={row.salePrice}
                            onChange={(event) => {
                              const value = event.target.value;
                              setQuantityRows((prev) =>
                                prev.map((item) => (item.id === row.id ? { ...item, salePrice: value } : item))
                              );
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={quantityRows.length === 1}
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (quantityRows.length === 1) return;
                            setQuantityRows((prev) => prev.filter((item) => item.id !== row.id));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      setQuantityRows((prev) => [
                        ...prev,
                        { id: crypto.randomUUID(), quantity: "", unit: "g", price: "", salePrice: "" },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-1"><Label>Batch Code</Label><Input placeholder="WH-001" value={sku} onChange={(event) => setSku(event.target.value)} /></div>
                  <div className="space-y-2 md:col-span-1"><Label>Total Stock Quantity *</Label><Input type="number" required placeholder="0" min="0" value={stock} onChange={(event) => setStock(event.target.value)} /></div>
                  <div className="space-y-2 md:col-span-1">
                    <Label>Stock Value</Label>
                    <Select value={stockUnit} onValueChange={(value) => setStockUnit((value || "Nos") as UnitValue)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="Nos">Nos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Brand / Manufacturer</Label><Input placeholder="Brand name" value={brand} onChange={(event) => setBrand(event.target.value)} /></div>
                <div className="space-y-2"><Label>Tags (comma separated)</Label><Input placeholder="organic, sugar-free, gluten-free" value={tags} onChange={(event) => setTags(event.target.value)} /></div>
              </CardContent>
            </Card>

            {/* Images */}
            <Card>
              <CardHeader><CardTitle>Product Images</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label htmlFor="product-image" className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer block">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Click to upload product image</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 5MB</p>
                  </Label>
                  <Input
                    id="product-image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setImageFile(file);
                      setImageUrl(null);
                    }}
                  />
                  {imageFile && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {imageFile.name}
                    </p>
                  )}
                  {imageUrl && (
                    <p className="text-xs text-green-700">
                      Image uploaded successfully.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Status</CardTitle></CardHeader>
              <CardContent>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    if (!value) return;
                    setStatus(value as "active" | "inactive" | "draft");
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Category</CardTitle></CardHeader>
              <CardContent>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value || "none")}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="none">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Visibility</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="featured" className="text-sm">Featured</Label>
                  <Switch id="featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="trending" className="text-sm">Trending</Label>
                  <Switch id="trending" checked={isTrending} onCheckedChange={setIsTrending} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="newArrival" className="text-sm">New Arrival</Label>
                  <Switch id="newArrival" checked={isNewArrival} onCheckedChange={setIsNewArrival} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end gap-3">
          <Link href="/warehouse/products">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={loading || uploading} className="gap-2">
            <Save className="h-4 w-4" /> {loading || uploading ? "Saving..." : "Save Product"}
          </Button>
        </div>
      </form>
    </div>
  );
}
