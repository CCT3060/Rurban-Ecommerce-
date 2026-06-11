"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, MoreHorizontal, Loader2, LayoutGrid, List, Eye, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { generateSlug } from "@/lib/constants";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  parent_id: string | null;
  status: "active" | "inactive";
  product_count: number;
};

type CategoryFormState = {
  name: string;
  slug: string;
  image_url: string;
  parent_id: string;
  status: "active" | "inactive";
};

export default function AdminCategoriesPage() {
  const router = useRouter();
  // ── Store categories state
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<CategoryFormState>({
    name: "",
    slug: "",
    image_url: "",
    parent_id: "none",
    status: "active",
  });
  const [selectedParentCategoryId, setSelectedParentCategoryId] = useState("none");
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState("none");

  const parentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) {
      map.set(category.id, category.name);
    }
    return map;
  }, [categories]);

  const { rootCategories, displayChildrenByParent } = useMemo(() => {
    const childrenByParent = new Map<string, CategoryRow[]>();
    const roots: CategoryRow[] = [];

    for (const category of categories) {
      if (!category.parent_id) {
        roots.push(category);
        continue;
      }
      const children = childrenByParent.get(category.parent_id) ?? [];
      children.push(category);
      childrenByParent.set(category.parent_id, children);
    }

    return {
      rootCategories: roots,
      displayChildrenByParent: childrenByParent,
    };
  }, [categories]);

  const categoryById = useMemo(() => {
    const map = new Map<string, CategoryRow>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories]);

  const { topLevelParentOptions, subCategoriesByParent } = useMemo(() => {
    const childrenByParent = new Map<string, CategoryRow[]>();
    const blockedIds = new Set<string>();

    for (const category of categories) {
      if (!category.parent_id) continue;
      const children = childrenByParent.get(category.parent_id) ?? [];
      children.push(category);
      childrenByParent.set(category.parent_id, children);
    }

    if (editingId) {
      const stack = [editingId];
      while (stack.length > 0) {
        const currentId = stack.pop();
        if (!currentId) continue;
        const children = childrenByParent.get(currentId) ?? [];
        for (const child of children) {
          if (blockedIds.has(child.id)) continue;
          blockedIds.add(child.id);
          stack.push(child.id);
        }
      }
    }

    const eligible = categories.filter((category) => category.id !== editingId && !blockedIds.has(category.id));
    const topLevel = eligible.filter((category) => !category.parent_id);
    const subByParent = new Map<string, CategoryRow[]>();

    for (const category of eligible) {
      if (!category.parent_id) continue;
      const siblings = subByParent.get(category.parent_id) ?? [];
      siblings.push(category);
      subByParent.set(category.parent_id, siblings);
    }

    return {
      topLevelParentOptions: topLevel,
      subCategoriesByParent: subByParent,
    };
  }, [categories, editingId]);

  const subCategoryOptions = useMemo(() => {
    if (selectedParentCategoryId === "none") return [];
    return subCategoriesByParent.get(selectedParentCategoryId) ?? [];
  }, [selectedParentCategoryId, subCategoriesByParent]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/categories", { cache: "no-store" });
      const json = (await response.json()) as { data?: CategoryRow[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to load categories");
      setCategories(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCategories();
  }, []);

  useEffect(() => {
    setExpandedCategoryIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(categories.map((category) => category.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [categories]);

  const resolveParentSelections = (parentId: string | null) => {
    if (!parentId) {
      return { parentSelection: "none", subSelection: "none", resolvedParentId: "none" };
    }

    const directParent = categoryById.get(parentId);
    if (!directParent) {
      return { parentSelection: parentId, subSelection: "none", resolvedParentId: parentId };
    }

    if (!directParent.parent_id) {
      return { parentSelection: directParent.id, subSelection: "none", resolvedParentId: directParent.id };
    }

    return {
      parentSelection: directParent.parent_id,
      subSelection: directParent.id,
      resolvedParentId: directParent.id,
    };
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setSelectedParentCategoryId("none");
    setSelectedSubCategoryId("none");
    setForm({ name: "", slug: "", image_url: "", parent_id: "none", status: "active" });
    setDialogOpen(true);
  };

  const openEditDialog = (category: CategoryRow) => {
    setEditingId(category.id);
    const { parentSelection, subSelection, resolvedParentId } = resolveParentSelections(category.parent_id);
    setSelectedParentCategoryId(parentSelection);
    setSelectedSubCategoryId(subSelection);
    setForm({
      name: category.name,
      slug: category.slug,
      image_url: category.image_url ?? "",
      parent_id: resolvedParentId,
      status: category.status,
    });
    setDialogOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const payload = new FormData();
      payload.append("file", file);
      payload.append("categoryName", form.name || "category");

      const response = await fetch("/api/admin/uploads/category-image", {
        method: "POST",
        body: payload,
      });

      const json = (await response.json()) as { data?: { url?: string }; error?: string };
      if (!response.ok) {
        throw new Error(json.error || "Image upload failed");
      }

      const uploadedUrl = json.data?.url;
      if (!uploadedUrl) {
        throw new Error("Could not resolve uploaded image URL");
      }

      setForm((prev) => ({ ...prev, image_url: uploadedUrl }));
      toast.success("Category image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: (form.slug.trim() || generateSlug(form.name.trim())).toLowerCase(),
        image_url: form.image_url.trim() || null,
        parent_id: form.parent_id === "none" ? null : form.parent_id,
        status: form.status,
      };

      const response = await fetch(
        editingId ? `/api/admin/categories/${editingId}` : "/api/admin/categories",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to save category");

      toast.success(editingId ? "Category updated" : "Category created");
      setDialogOpen(false);
      await fetchCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Delete this category? Products in this category will be uncategorized.");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to delete category");
      toast.success("Category deleted");
      await fetchCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete category");
    }
  };

  const toggleSelectCategory = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allCategoriesSelected = categories.length > 0 && categories.every((c) => selectedIds.has(c.id));

  const toggleSelectAllCategories = () => {
    if (allCategoriesSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(categories.map((c) => c.id)));
    }
  };

  const handleBulkDeleteCategories = async () => {
    const count = selectedIds.size;
    const confirmed = window.confirm(`Delete ${count} selected categor${count > 1 ? "ies" : "y"}? Products in these categories will be uncategorized.`);
    if (!confirmed) return;

    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/admin/categories/${id}`, { method: "DELETE" })
        )
      );
      toast.success(`${count} categor${count > 1 ? "ies" : "y"} deleted`);
      setSelectedIds(new Set());
      await fetchCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete categories");
    }
  };

  const toggleCategoryExpanded = (categoryId: string) => {
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const renderCategoryRows = (items: CategoryRow[], depth = 0): ReactNode[] => {
    const rows: ReactNode[] = [];
    for (const cat of items) {
      const children = displayChildrenByParent.get(cat.id) ?? [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedCategoryIds.has(cat.id);

      rows.push(
        <TableRow key={cat.id} className={selectedIds.has(cat.id) ? "bg-muted/50" : ""}>
          <TableCell className="pl-4 w-10">
            <Checkbox
              checked={selectedIds.has(cat.id)}
              onCheckedChange={() => toggleSelectCategory(cat.id)}
              aria-label={`Select ${cat.name}`}
            />
          </TableCell>
          <TableCell className="font-medium">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 14}px` }}>
              {hasChildren ? (
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => toggleCategoryExpanded(cat.id)}
                  aria-label={isExpanded ? "Collapse sub categories" : "Expand sub categories"}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : (
                <span className="inline-block h-5 w-5" />
              )}
              <span>{cat.name}</span>
            </div>
          </TableCell>
          <TableCell className="text-xs text-muted-foreground font-mono">{cat.slug}</TableCell>
          <TableCell className="text-sm">{(cat.parent_id && parentNameById.get(cat.parent_id)) || "--"}</TableCell>
          <TableCell className="text-center"><Badge variant="secondary">{cat.product_count}</Badge></TableCell>
          <TableCell>
            <Badge className={cat.status === "active" ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-700 border-0"}>
              {cat.status}
            </Badge>
          </TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/admin/products?categoryId=${cat.id}&categoryName=${encodeURIComponent(cat.name)}`)}><Eye className="h-4 w-4 mr-2" /> View Products</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEditDialog(cat)}><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => void handleDelete(cat.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      );

      if (hasChildren && isExpanded) {
        rows.push(...renderCategoryRows(children, depth + 1));
      }
    }
    return rows;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">{categories.length} categories</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" className="gap-2" onClick={() => void handleBulkDeleteCategories()}>
              <Trash2 className="h-4 w-4" /> Delete {selectedIds.size} selected
            </Button>
          )}
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
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open && saving) return;
            setDialogOpen(open);
          }}
        >
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" /> Add Category
          </Button>
          <DialogContent className="p-0 w-[95vw] sm:max-w-2xl">
            <DialogHeader className="px-6 py-4 border-b">
              <DialogTitle className="text-lg font-semibold">{editingId ? "Edit Category" : "Add Category"}</DialogTitle>
            </DialogHeader>
            <form className="px-6 py-5 space-y-5" onSubmit={handleSave}>
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Category Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  placeholder="e.g. Dairy & Eggs"
                  value={form.name}
                  className="h-10"
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                      slug: prev.slug || generateSlug(event.target.value),
                    }))
                  }
                />
              </div>

              {/* Slug */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-muted-foreground">Slug (URL)</Label>
                <Input
                  placeholder="auto-generated"
                  value={form.slug}
                  className="h-10 text-muted-foreground"
                  onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                />
              </div>

              {/* Image */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Category Image</Label>
                <label className="flex items-center gap-3 border rounded-lg px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                  <span className="text-xs bg-muted border rounded px-2 py-1 font-medium shrink-0">Choose File</span>
                  <span className="text-sm text-muted-foreground truncate">
                    {form.image_url ? "Image selected" : "No file chosen"}
                  </span>
                  {uploading && <Loader2 className="h-4 w-4 animate-spin ml-auto shrink-0" />}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleImageUpload(file);
                    }}
                  />
                </label>
                <Input
                  placeholder="Or paste image URL"
                  value={form.image_url}
                  className="h-10"
                  onChange={(event) => setForm((prev) => ({ ...prev, image_url: event.target.value }))}
                />
                {form.image_url && (
                  <div className="relative h-24 w-full overflow-hidden rounded-lg border bg-muted/30 mt-1">
                    <Image src={form.image_url} alt="Category preview" fill className="object-cover" />
                  </div>
                )}
              </div>

              {/* Parent Category */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Parent Category</Label>
                <Select
                  value={selectedParentCategoryId}
                  onValueChange={(value) => {
                    const nextParent = value ?? "none";
                    setSelectedParentCategoryId(nextParent);
                    setSelectedSubCategoryId("none");
                    setForm((prev) => ({
                      ...prev,
                      parent_id: nextParent === "none" ? "none" : nextParent,
                    }));
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="None (Top level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Top level)</SelectItem>
                    {topLevelParentOptions.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedParentCategoryId !== "none" && subCategoryOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Sub Category <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                  <Select
                    value={selectedSubCategoryId}
                    onValueChange={(value) => {
                      const nextSub = value ?? "none";
                      setSelectedSubCategoryId(nextSub);
                      setForm((prev) => ({
                        ...prev,
                        parent_id: nextSub === "none" ? selectedParentCategoryId : nextSub,
                      }));
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="No sub category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No sub category</SelectItem>
                      {subCategoryOptions.map((subcategory) => (
                        <SelectItem key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => {
                    if (!value) return;
                    setForm((prev) => ({ ...prev, status: value as "active" | "inactive" }));
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} className="h-10 px-6">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || uploading} className="h-10 px-6">
                  {saving ? "Saving..." : editingId ? "Update Category" : "Save Category"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {viewMode === "table" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={allCategoriesSelected}
                    onCheckedChange={toggleSelectAllCategories}
                    aria-label="Select all categories"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead className="text-center">Products</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Loading categories...
                  </TableCell>
                </TableRow>
              )}
              {!loading && categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No categories found.
                  </TableCell>
                </TableRow>
              )}
              {!loading && renderCategoryRows(rootCategories)}
            </TableBody>
          </Table>
          ) : (
            <div className="p-4">
              {loading ? (
                <div className="text-center text-muted-foreground py-8">Loading categories...</div>
              ) : categories.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No categories found.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {categories.map((cat) => (
                    <Card key={cat.id} className={`overflow-hidden border-border/70 ${selectedIds.has(cat.id) ? "ring-2 ring-primary" : ""}`}>
                      <div className="relative h-32 bg-muted/20">
                        <div className="absolute top-2 left-2 z-10">
                          <Checkbox
                            checked={selectedIds.has(cat.id)}
                            onCheckedChange={() => toggleSelectCategory(cat.id)}
                            aria-label={`Select ${cat.name}`}
                            className="bg-white/90 border-2"
                          />
                        </div>
                        {cat.image_url ? (
                          <Image src={cat.image_url} alt={cat.name} fill className="object-cover" sizes="320px" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No image</div>
                        )}
                      </div>
                      <CardContent className="p-3 space-y-2">
                        <p className="font-medium line-clamp-1">{cat.parent_id ? `|- ${cat.name}` : cat.name}</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">{cat.product_count} products</Badge>
                          <Badge className={cat.status === "active" ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-700 border-0"}>{cat.status}</Badge>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Button type="button" size="sm" variant="outline" className="h-8 flex-1" onClick={() => router.push(`/admin/products?categoryId=${cat.id}&categoryName=${encodeURIComponent(cat.name)}`)}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> View Products
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => openEditDialog(cat)}>
                            <Edit className="h-3.5 w-3.5" />
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
