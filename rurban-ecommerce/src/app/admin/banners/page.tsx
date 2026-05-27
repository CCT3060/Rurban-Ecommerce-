"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Plus, Edit, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { BANNER_SECTIONS, BANNER_SECTION_LABELS, normalizeBannerSection } from "@/lib/banner-sections";
import { toIsoBoundary } from "@/lib/utils";
import { toast } from "sonner";
import type { Banner } from "@/types";

type BannerForm = {
  title: string;
  subtitle: string;
  image_url: string;
  cta_text: string;
  cta_link: string;
  redirect_category_slug: string;
  section: string;
  sort_order: string;
  status: "active" | "inactive";
  start_date: string;
  end_date: string;
};

type CategoryOption = {
  id: string;
  name: string;
  slug: string | null;
};

const initialForm: BannerForm = {
  title: "",
  subtitle: "",
  image_url: "",
  cta_text: "",
  cta_link: "/",
  redirect_category_slug: "none",
  section: "hero",
  sort_order: "0",
  status: "active",
  start_date: "",
  end_date: "",
};

function toIsoOrNull(dateValue: string, boundary: "start" | "end") {
  if (!dateValue) return null;
  return toIsoBoundary(dateValue, boundary);
}

function formatDate(date: string | null) {
  if (!date) return "Always";
  return new Date(date).toLocaleDateString("en-GB");
}

function asDateInput(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function extractCategorySlugFromLink(link: string | null | undefined) {
  if (!link) return "none";
  try {
    const parsed = new URL(link, "https://rurban.local");
    return parsed.searchParams.get("category")?.trim() || "none";
  } catch {
    return "none";
  }
}

function getCategoryRedirectValue(category: CategoryOption) {
  return category.slug?.trim() || category.id;
}

export default function AdminBannersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerForm>(initialForm);
  const [rows, setRows] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const previewUrl = useMemo(() => form.image_url || null, [form.image_url]);

  const loadBanners = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/banners", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Failed to load banners");
      }
      setRows(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load banners");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch("/api/categories", { cache: "no-store" });
      const json = (await response.json()) as { data?: CategoryOption[]; error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Failed to load categories");
      }
      setCategories(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load categories");
    }
  };

  useEffect(() => {
    void loadBanners();
    void loadCategories();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const openEdit = (banner: Banner) => {
    setEditingId(banner.id);
    setForm({
      title: banner.title ?? "",
      subtitle: banner.subtitle ?? "",
      image_url: banner.image_url,
      cta_text: banner.cta_text ?? "",
      cta_link: banner.cta_link ?? "/",
      redirect_category_slug: extractCategorySlugFromLink(banner.cta_link),
      section: normalizeBannerSection(banner.section) ?? "hero",
      sort_order: String(banner.sort_order ?? 0),
      status: banner.status,
      start_date: asDateInput(banner.start_date),
      end_date: asDateInput(banner.end_date),
    });
    setDialogOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.\-_]/g, "-");
      const filePath = `admin/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("banners")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("banners").getPublicUrl(filePath);
      setForm((prev) => ({ ...prev, image_url: data.publicUrl }));
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.image_url) {
      toast.error("Please upload or paste an image URL");
      return;
    }

    setSaving(true);

    try {
      const redirectLink =
        form.redirect_category_slug !== "none"
          ? `/category/${encodeURIComponent(form.redirect_category_slug)}`
          : form.cta_link;

      const response = await fetch(editingId ? `/api/admin/banners/${editingId}` : "/api/admin/banners", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title,
          subtitle: form.subtitle,
          image_url: form.image_url,
          cta_text: form.cta_text,
          cta_link: redirectLink,
          section: form.section,
          sort_order: Number(form.sort_order || 0),
          status: form.status,
          start_date: toIsoOrNull(form.start_date, "start"),
          end_date: toIsoOrNull(form.end_date, "end"),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Failed to save banner");
      }

      toast.success(editingId ? "Banner updated" : "Banner created");
      setEditingId(null);
      setForm(initialForm);
      setDialogOpen(false);
      await loadBanners();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save banner");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this banner?")) return;

    try {
      const response = await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Failed to delete banner");
      }

      toast.success("Banner deleted");
      await loadBanners();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete banner");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Banners</h1>
          <p className="text-sm text-muted-foreground">Manage homepage and section banners</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Banner
          </Button>
          <DialogContent className="max-h-[90vh] w-[95vw] sm:max-w-3xl overflow-y-auto p-0">
            <DialogHeader className="px-6 py-4 border-b">
              <DialogTitle className="text-lg font-semibold">{editingId ? "Edit Banner" : "Add Banner"}</DialogTitle>
            </DialogHeader>
            <form className="px-6 py-5 space-y-5" onSubmit={handleSubmit}>

              {/* Banner Image */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Banner Image <span className="text-red-500">*</span>
                </Label>
                <label className="flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors">
                  <span className="text-xs bg-muted border rounded px-2 py-1 font-medium shrink-0">Choose File</span>
                  <span className="text-sm text-muted-foreground truncate">
                    {form.image_url ? "Image selected" : "No file chosen"}
                  </span>
                  {uploading && <Loader2 className="h-4 w-4 animate-spin ml-auto shrink-0" />}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileUpload(file);
                    }}
                  />
                </label>
                <p className="text-xs text-muted-foreground">Upload banner image (JPG, PNG, WEBP - Max 2MB)</p>
              </div>

              {/* Image URL & preview */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Image URL</Label>
                <Input
                  placeholder="Or paste image URL directly"
                  value={form.image_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                  className="h-10"
                />
                {previewUrl && (
                  <div className="relative h-28 w-full overflow-hidden rounded-lg border bg-muted/30 mt-2">
                    <Image src={previewUrl} alt="Banner preview" fill className="object-cover" />
                  </div>
                )}
              </div>

              {/* Title + Display Order */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Banner title"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Display Order</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
                </div>
              </div>

              {/* Subtitle */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Subtitle</Label>
                <Input
                  placeholder="Optional subtitle"
                  value={form.subtitle}
                  onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                  className="h-10"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Description</Label>
                <textarea
                  placeholder="Optional description"
                  value={""}
                  readOnly
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring text-muted-foreground"
                />
              </div>

              {/* Section + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Section <span className="text-red-500">*</span>
                  </Label>
                  <Select value={form.section} onValueChange={(value) => setForm((prev) => ({ ...prev, section: value ?? "hero" }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BANNER_SECTIONS.map((section) => (
                        <SelectItem key={section} value={section}>{BANNER_SECTION_LABELS[section]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: (value === "inactive" ? "inactive" : "active") }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Redirect Category */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Redirect Category</Label>
                <Select
                  value={form.redirect_category_slug}
                  onValueChange={(value) => {
                    const nextValue = value || "none";
                    setForm((prev) => ({
                      ...prev,
                      redirect_category_slug: nextValue,
                      cta_link: nextValue !== "none" ? `/category/${encodeURIComponent(nextValue)}` : "/",
                    }));
                  }}
                >
                  <SelectTrigger className="h-10"><SelectValue placeholder="No redirect" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Category Redirect</SelectItem>
                    {categories.map((category) => {
                      const redirectValue = getCategoryRedirectValue(category);
                      return (
                        <SelectItem key={category.id} value={redirectValue}>{category.name}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* CTA */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">CTA Text</Label>
                  <Input placeholder="Shop Now" value={form.cta_text} onChange={(e) => setForm((prev) => ({ ...prev, cta_text: e.target.value }))} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">CTA Link</Label>
                  <Input
                    placeholder="/"
                    value={form.cta_link}
                    onChange={(e) => setForm((prev) => ({ ...prev, cta_link: e.target.value, redirect_category_slug: "none" }))}
                    className="h-10"
                  />
                </div>
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">End Date</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))} className="h-10" />
                </div>
              </div>

              {/* Footer buttons */}
              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} className="h-10 px-6">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || uploading} className="h-10 px-6 gap-2">
                  {saving ? "Saving..." : editingId ? "Update Banner" : "Save Banner"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead className="text-center">Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Loading banners...</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No banners yet. Add your first banner.</TableCell>
                </TableRow>
              ) : rows.map((banner) => (
                <TableRow key={banner.id}>
                  <TableCell>
                    <div className="relative h-10 w-14 overflow-hidden rounded border bg-muted/20">
                      <Image src={banner.image_url} alt={banner.title || "Banner"} fill className="object-cover" />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{banner.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {BANNER_SECTION_LABELS[normalizeBannerSection(banner.section) ?? "hero"]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {banner.start_date ? `${formatDate(banner.start_date)} → ${formatDate(banner.end_date)}` : "Always"}
                  </TableCell>
                  <TableCell className="text-center">{banner.sort_order}</TableCell>
                  <TableCell>
                    <Badge className={banner.status === "active" ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-700 border-0"}>
                      {banner.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(banner)}><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => void handleDelete(banner.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
