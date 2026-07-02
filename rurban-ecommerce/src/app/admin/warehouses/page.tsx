"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Warehouse, Search, MapPin, User, ChevronRight,
  RefreshCw, Trash2, MoreHorizontal, Download,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type LookupValue = { id: string; value: string };

function useLookup(type: string) {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    fetch(`/api/admin/masters/${type}`)
      .then((r) => r.json() as Promise<{ data?: LookupValue[] }>)
      .then((j) => setItems((j.data ?? []).map((d) => d.value)))
      .catch(() => { /* silently use empty list */ });
  }, [type]);
  return items;
}

type WarehouseRow = {
  id: string;
  name: string;
  code: string;
  location: string | null;
  state: string | null;
  manager_name: string | null;
  manager_email: string | null;
  is_active: boolean;
};

type WarehouseForm = {
  name: string;
  code: string;
  location: string;
  state: string;
  manager_name: string;
  manager_email: string;
};

const EMPTY_FORM: WarehouseForm = {
  name: "", code: "", location: "", state: "", manager_name: "", manager_email: "",
};

type ZohoWarehouseItem = {
  warehouse_id: string;
  warehouse_name: string;
  email: string | null;
  is_primary: boolean;
  status: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  address_line: string | null;
};

export default function AdminWarehousesPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequiredMessage, setSetupRequiredMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WarehouseForm>(EMPTY_FORM);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<WarehouseRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Zoho import state
  const [showZohoDialog, setShowZohoDialog] = useState(false);
  const [zohoWarehouses, setZohoWarehouses] = useState<ZohoWarehouseItem[]>([]);
  const [zohoLoading, setZohoLoading] = useState(false);
  const [zohoError, setZohoError] = useState<string | null>(null);
  const [zohoStale, setZohoStale] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importAllLoading, setImportAllLoading] = useState(false);

  const states = useLookup("indian_state");

  const fetchWarehouses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/warehouses", { cache: "no-store" });
      const json = (await response.json()) as {
        data?: WarehouseRow[];
        error?: string;
        setupRequired?: boolean;
        message?: string;
      };

      if (json.setupRequired) {
        setWarehouses([]);
        setSetupRequiredMessage(
          json.message ??
            "Warehouse schema is not migrated yet. Run supabase/migrations/20260420_warehouse_support.sql in Supabase SQL Editor first."
        );
        return;
      }

      setSetupRequiredMessage(null);
      if (!response.ok) throw new Error(json.error ?? "Failed to load warehouses");
      setWarehouses(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load warehouses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWarehouses();
  }, [fetchWarehouses]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Failed to create warehouse");
      toast.success("Warehouse created");
      setForm(EMPTY_FORM);
      setShowAddDialog(false);
      await fetchWarehouses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create warehouse");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/warehouses/${deleteTarget.id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to delete warehouse");
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      await fetchWarehouses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const openZohoDialog = async () => {
    setShowZohoDialog(true);
    setZohoError(null);
    setZohoStale(false);
    setZohoWarehouses([]);
    setZohoLoading(true);
    try {
      const res = await fetch("/api/admin/zoho/warehouses", { cache: "no-store" });
      const json = (await res.json()) as { data?: ZohoWarehouseItem[]; error?: string; stale?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Failed to fetch from Zoho");
      setZohoWarehouses(json.data ?? []);
      setZohoStale(json.stale === true);
    } catch (err) {
      setZohoError(err instanceof Error ? err.message : "Failed to fetch from Zoho");
    } finally {
      setZohoLoading(false);
    }
  };

  const refreshZohoWarehouses = async () => {
    setZohoError(null);
    setZohoStale(false);
    setZohoLoading(true);
    try {
      const res = await fetch("/api/admin/zoho/warehouses?refresh=1", { cache: "no-store" });
      const json = (await res.json()) as { data?: ZohoWarehouseItem[]; error?: string; stale?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Failed to fetch from Zoho");
      setZohoWarehouses(json.data ?? []);
      setZohoStale(json.stale === true);
    } catch (err) {
      setZohoError(err instanceof Error ? err.message : "Failed to fetch from Zoho");
    } finally {
      setZohoLoading(false);
    }
  };

  const importSingle = async (w: ZohoWarehouseItem) => {
    setImportingId(w.warehouse_id);
    try {
      const res = await fetch("/api/admin/warehouses/import-zoho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(w),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to import");
      toast.success(`"${w.warehouse_name}" imported`);
      await fetchWarehouses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportingId(null);
    }
  };

  const importAll = async () => {
    setImportAllLoading(true);
    try {
      const res = await fetch("/api/admin/warehouses/import-zoho?all=1", { method: "POST" });
      const json = (await res.json()) as { data?: { imported: number; updated: number }; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      const { imported = 0, updated = 0 } = json.data ?? {};
      toast.success(`Sync complete — ${imported} imported, ${updated} updated`);
      setShowZohoDialog(false);
      await fetchWarehouses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportAllLoading(false);
    }
  };

  const filtered = warehouses.filter((w) => {
    const q = search.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.code.toLowerCase().includes(q) ||
      (w.location ?? "").toLowerCase().includes(q) ||
      (w.state ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Warehouses</h1>
          <p className="text-sm text-muted-foreground">
            {warehouses.length} warehouse{warehouses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openZohoDialog} className="gap-2">
            <Download className="h-4 w-4" /> Import from Zoho Books
          </Button>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Warehouse
          </Button>
        </div>
      </div>

      {/* Setup required banner */}
      {setupRequiredMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50/40 p-4 text-sm text-red-700">
          <p className="font-medium mb-1">Warehouse Setup Required</p>
          <p>{setupRequiredMessage}</p>
          <p className="mt-1">After running the migration, refresh this page.</p>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search warehouses..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Warehouse cards */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading warehouses...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Warehouse className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search
              ? "No warehouses match your search."
              : "No warehouses yet. Click \"Add Warehouse\" to create one."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((warehouse) => (
            <Card
              key={warehouse.id}
              className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/30"
              onClick={() => router.push(`/admin/warehouses/${warehouse.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Warehouse className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{warehouse.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{warehouse.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge
                      className={
                        warehouse.is_active
                          ? "bg-green-100 text-green-700 border-0"
                          : "bg-gray-100 text-gray-700 border-0"
                      }
                    >
                      {warehouse.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/warehouses/${warehouse.id}`);
                          }}
                        >
                          <ChevronRight className="h-4 w-4 mr-2" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(warehouse);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  {(warehouse.location || warehouse.state) && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">
                        {[warehouse.location, warehouse.state].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                  {warehouse.manager_name && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{warehouse.manager_name}</span>
                    </div>
                  )}
                  {!warehouse.location && !warehouse.state && !warehouse.manager_name && (
                    <p className="text-muted-foreground/60 text-xs italic">No details added</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Warehouse Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" /> Add Warehouse
            </DialogTitle>
          </DialogHeader>
          <form id="add-warehouse-form" onSubmit={handleCreate}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="wh-name">Warehouse Name *</Label>
                <Input
                  id="wh-name"
                  required
                  placeholder="e.g. Mumbai Central"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wh-code">Warehouse Code</Label>
                <Input
                  id="wh-code"
                  placeholder="AUTO-generated if empty"
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="wh-location">Location</Label>
                  <Input
                    id="wh-location"
                    placeholder="City / Area"
                    value={form.location}
                    onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select
                    value={form.state}
                    onValueChange={(val) => setForm((p) => ({ ...p, state: val ?? "" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {states.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="wh-mgr-name">Manager Name</Label>
                  <Input
                    id="wh-mgr-name"
                    value={form.manager_name}
                    onChange={(e) => setForm((p) => ({ ...p, manager_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wh-mgr-email">Manager Email</Label>
                  <Input
                    id="wh-mgr-email"
                    type="email"
                    value={form.manager_email}
                    onChange={(e) => setForm((p) => ({ ...p, manager_email: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button form="add-warehouse-form" type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create Warehouse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zoho Import Dialog */}
      <Dialog open={showZohoDialog} onOpenChange={setShowZohoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" /> Import Warehouses from Zoho Books
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3 max-h-[60vh] overflow-y-auto">
            {zohoLoading && (
              <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Fetching from Zoho Books...</span>
              </div>
            )}
            {zohoError && (
              <div className="rounded-lg border border-red-200 bg-red-50/40 p-4 text-sm text-red-700">
                <p className="font-medium mb-1">Failed to connect to Zoho Books</p>
                <p>{zohoError}</p>
                <button
                  onClick={refreshZohoWarehouses}
                  className="mt-2 text-xs underline underline-offset-2 hover:no-underline"
                >
                  Try again
                </button>
              </div>
            )}
            {!zohoLoading && zohoStale && (
              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2 text-xs text-amber-700">
                <span>Showing cached data — Zoho rate limit reached.</span>
                <button
                  onClick={refreshZohoWarehouses}
                  className="flex items-center gap-1 font-medium underline underline-offset-2 hover:no-underline"
                >
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>
            )}
            {!zohoLoading && !zohoError && zohoWarehouses.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No warehouses/stores found in Zoho Books.
              </p>
            )}
            {!zohoLoading && zohoWarehouses.length > 0 && (
              <div className="space-y-2">
                {zohoWarehouses.map((w) => (
                  <div
                    key={w.warehouse_id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{w.warehouse_name}</p>
                        {w.is_primary && (
                          <Badge className="bg-blue-100 text-blue-700 border-0 text-xs shrink-0">
                            Primary
                          </Badge>
                        )}
                        <Badge
                          className={
                            w.status === "active"
                              ? "bg-green-100 text-green-700 border-0 text-xs shrink-0"
                              : "bg-gray-100 text-gray-700 border-0 text-xs shrink-0"
                          }
                        >
                          {w.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[w.city, w.state, w.country].filter(Boolean).join(", ") || "No address"}
                        {w.email ? ` · ${w.email}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={importingId === w.warehouse_id}
                      onClick={() => importSingle(w)}
                      className="shrink-0"
                    >
                      {importingId === w.warehouse_id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Import"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowZohoDialog(false)}>
              Close
            </Button>
            {!zohoLoading && zohoWarehouses.length > 0 && (
              <Button disabled={importAllLoading} onClick={importAll} className="gap-2">
                {importAllLoading ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Syncing...</>
                ) : (
                  <><Download className="h-4 w-4" /> Sync All ({zohoWarehouses.length})</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete Warehouse
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{deleteTarget?.name}</span>?
            This action cannot be undone. Products and users linked to this warehouse will lose the association.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting..." : "Delete Warehouse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
