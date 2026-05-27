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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { toIsoBoundary } from "@/lib/utils";

type OfferRow = {
  id: string;
  title: string;
  description: string | null;
  type: "percentage" | "fixed" | "bogo" | "category_discount" | "product_discount";
  value: number;
  image_url: string | null;
  apply_to: "all" | "category" | "product";
  target_id: string | null;
  start_date: string;
  end_date: string;
  status: "active" | "inactive";
  is_highlighted: boolean;
};

type OfferForm = {
  title: string;
  description: string;
  type: "percentage" | "fixed" | "bogo" | "category_discount" | "product_discount";
  value: string;
  image_url: string;
  apply_to: "all" | "category" | "product";
  target_id: string;
  start_date: string;
  end_date: string;
  status: "active" | "inactive";
  is_highlighted: boolean;
};

const initialForm: OfferForm = {
  title: "",
  description: "",
  type: "percentage",
  value: "0",
  image_url: "",
  apply_to: "all",
  target_id: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  status: "active",
  is_highlighted: false,
};

function asDateInput(value: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function asIso(value: string) {
  if (!value) return "";
  return toIsoBoundary(value, "start");
}

function asIsoEnd(value: string) {
  if (!value) return "";
  return toIsoBoundary(value, "end");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB");
}

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OfferForm>(initialForm);

  const title = useMemo(() => (editingId ? "Edit Offer" : "Add Offer"), [editingId]);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/offers", { cache: "no-store" });
      const json = (await response.json()) as { data?: OfferRow[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to load offers");
      setOffers(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load offers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOffers();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const openEdit = (offer: OfferRow) => {
    setEditingId(offer.id);
    setForm({
      title: offer.title,
      description: offer.description ?? "",
      type: offer.type,
      value: String(offer.value),
      image_url: offer.image_url ?? "",
      apply_to: offer.apply_to,
      target_id: offer.target_id ?? "",
      start_date: asDateInput(offer.start_date),
      end_date: asDateInput(offer.end_date),
      status: offer.status,
      is_highlighted: offer.is_highlighted,
    });
    setDialogOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop() || "jpg";
      const safeTitle = form.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "offer";
      const filePath = `offers/${safeTitle}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("banners")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("banners").getPublicUrl(filePath);
      if (!data.publicUrl) throw new Error("Failed to resolve uploaded image URL");

      setForm((prev) => ({ ...prev, image_url: data.publicUrl }));
      toast.success("Offer image uploaded");
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
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        value: Number(form.value),
        image_url: form.image_url.trim() || null,
        apply_to: form.apply_to,
        target_id: form.target_id.trim() || null,
        start_date: asIso(form.start_date),
        end_date: asIsoEnd(form.end_date),
        status: form.status,
        is_highlighted: form.is_highlighted,
      };

      const response = await fetch(
        editingId ? `/api/admin/offers/${editingId}` : "/api/admin/offers",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to save offer");

      toast.success(editingId ? "Offer updated" : "Offer created");
      setDialogOpen(false);
      await fetchOffers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save offer");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this offer?")) return;

    try {
      const response = await fetch(`/api/admin/offers/${id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to delete offer");
      toast.success("Offer deleted");
      await fetchOffers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete offer");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Offers</h1><p className="text-sm text-muted-foreground">Manage promotions and deals</p></div>
        <Button className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" /> Add Offer</Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="space-y-2"><Label>Title *</Label><Input required value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Offer Image</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleImageUpload(file);
                  }}
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <Input
                placeholder="Or paste image URL"
                value={form.image_url}
                onChange={(event) => setForm((prev) => ({ ...prev, image_url: event.target.value }))}
              />
              {form.image_url && (
                <div className="relative h-24 w-full overflow-hidden rounded-md border bg-muted/30">
                  <Image src={form.image_url} alt="Offer preview" fill className="object-cover" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={(value) => value && setForm((prev) => ({ ...prev, type: value as OfferForm["type"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">percentage</SelectItem>
                    <SelectItem value="fixed">fixed</SelectItem>
                    <SelectItem value="bogo">bogo</SelectItem>
                    <SelectItem value="category_discount">category_discount</SelectItem>
                    <SelectItem value="product_discount">product_discount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Value *</Label><Input type="number" min={0} required value={form.value} onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Apply To</Label>
                <Select value={form.apply_to} onValueChange={(value) => value && setForm((prev) => ({ ...prev, apply_to: value as OfferForm["apply_to"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">all</SelectItem>
                    <SelectItem value="category">category</SelectItem>
                    <SelectItem value="product">product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Target ID</Label><Input value={form.target_id} onChange={(event) => setForm((prev) => ({ ...prev, target_id: event.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date *</Label><Input type="date" required value={form.start_date} onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))} /></div>
              <div className="space-y-2"><Label>End Date *</Label><Input type="date" required value={form.end_date} onChange={(event) => setForm((prev) => ({ ...prev, end_date: event.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => value && setForm((prev) => ({ ...prev, status: (value as "active" | "inactive") }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">active</SelectItem><SelectItem value="inactive">inactive</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 mt-8">
                <Label htmlFor="highlighted">Highlighted</Label>
                <Switch id="highlighted" checked={form.is_highlighted} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_highlighted: checked }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || uploading}>{saving ? "Saving..." : editingId ? "Update Offer" : "Save Offer"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Value</TableHead><TableHead>Applies To</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading offers...</TableCell></TableRow>
              )}
              {!loading && offers.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No offers found.</TableCell></TableRow>
              )}
              {!loading && offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium">{offer.title} {offer.is_highlighted && <Badge className="ml-2 bg-cta/10 text-cta border-0 text-[10px]">Featured</Badge>}</TableCell>
                  <TableCell><Badge variant="secondary">{offer.type}</Badge></TableCell>
                  <TableCell className="font-semibold">{offer.value}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{offer.apply_to}{offer.target_id ? `: ${offer.target_id}` : ""}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(offer.start_date)} - {formatDate(offer.end_date)}</TableCell>
                  <TableCell><Badge className={offer.status === "active" ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-700 border-0"}>{offer.status}</Badge></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(offer)}><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => void handleDelete(offer.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
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
