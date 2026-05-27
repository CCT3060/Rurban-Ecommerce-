"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Edit, Trash2, MoreHorizontal, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_value: number;
  max_uses: number | null;
  used_count: number;
  expiry_date: string;
  status: "active" | "inactive";
};

type CouponForm = {
  code: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  min_order_value: string;
  max_uses: string;
  expiry_date: string;
  status: "active" | "inactive";
};

const initialForm: CouponForm = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: "0",
  min_order_value: "0",
  max_uses: "",
  expiry_date: "",
  status: "active",
};

function asDateInput(value: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function asIso(value: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(initialForm);

  const title = useMemo(() => (editingId ? "Edit Coupon" : "Add Coupon"), [editingId]);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/coupons", { cache: "no-store" });
      const json = (await response.json()) as { data?: CouponRow[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to load coupons");
      setCoupons(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCoupons();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const openEdit = (coupon: CouponRow) => {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description ?? "",
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      min_order_value: String(coupon.min_order_value),
      max_uses: coupon.max_uses === null ? "" : String(coupon.max_uses),
      expiry_date: asDateInput(coupon.expiry_date),
      status: coupon.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_value: Number(form.min_order_value),
        max_uses: form.max_uses.trim() ? Number(form.max_uses) : null,
        expiry_date: asIso(form.expiry_date),
        status: form.status,
      };

      const response = await fetch(
        editingId ? `/api/admin/coupons/${editingId}` : "/api/admin/coupons",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to save coupon");

      toast.success(editingId ? "Coupon updated" : "Coupon created");
      setDialogOpen(false);
      await fetchCoupons();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save coupon");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this coupon?")) return;

    try {
      const response = await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to delete coupon");
      toast.success("Coupon deleted");
      await fetchCoupons();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete coupon");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Coupons</h1><p className="text-sm text-muted-foreground">Manage discount codes</p></div>
        <Button className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" /> Add Coupon</Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="space-y-2"><Label>Code *</Label><Input required value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={form.discount_type} onValueChange={(value) => value && setForm((prev) => ({ ...prev, discount_type: value as "percentage" | "fixed" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="percentage">percentage</SelectItem><SelectItem value="fixed">fixed</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Discount Value *</Label><Input type="number" min={0} required value={form.discount_value} onChange={(event) => setForm((prev) => ({ ...prev, discount_value: event.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Min Order Value</Label><Input type="number" min={0} value={form.min_order_value} onChange={(event) => setForm((prev) => ({ ...prev, min_order_value: event.target.value }))} /></div>
              <div className="space-y-2"><Label>Max Uses</Label><Input type="number" min={0} value={form.max_uses} onChange={(event) => setForm((prev) => ({ ...prev, max_uses: event.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Expiry Date *</Label><Input type="date" required value={form.expiry_date} onChange={(event) => setForm((prev) => ({ ...prev, expiry_date: event.target.value }))} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => value && setForm((prev) => ({ ...prev, status: value as "active" | "inactive" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">active</SelectItem><SelectItem value="inactive">inactive</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Update Coupon" : "Save Coupon"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Discount</TableHead><TableHead>Min Order</TableHead><TableHead className="text-center">Usage</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading coupons...</TableCell></TableRow>}
              {!loading && coupons.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No coupons found.</TableCell></TableRow>}
              {!loading && coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell>
                    <button
                      className="font-mono font-bold text-sm flex items-center gap-1 hover:text-primary"
                      onClick={() => {
                        navigator.clipboard.writeText(coupon.code);
                        toast.success("Code copied");
                      }}
                    >
                      {coupon.code} <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{coupon.discount_type}</Badge></TableCell>
                  <TableCell className="font-semibold">{coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">₹{coupon.min_order_value}</TableCell>
                  <TableCell className="text-center text-sm">{coupon.used_count}{coupon.max_uses ? `/${coupon.max_uses}` : ""}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(coupon.expiry_date).toLocaleDateString("en-GB")}</TableCell>
                  <TableCell><Badge className={coupon.status === "active" ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-700 border-0"}>{coupon.status}</Badge></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(coupon)}><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => void handleDelete(coupon.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
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
