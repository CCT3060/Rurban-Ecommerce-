"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Warehouse, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type WarehouseRow = {
  id: string;
  name: string;
  code: string;
  location: string | null;
  manager_name: string | null;
  manager_email: string | null;
  is_active: boolean;
};

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequiredMessage, setSetupRequiredMessage] = useState<string | null>(null);
  const [savingWarehouse, setSavingWarehouse] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const [warehouseForm, setWarehouseForm] = useState({
    name: "",
    code: "",
    location: "",
    manager_name: "",
    manager_email: "",
  });

  const [adminForm, setAdminForm] = useState({
    warehouse_id: "",
    full_name: "",
    email: "",
    password: "",
  });

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
          json.message ||
            "Warehouse schema is not migrated yet. Run supabase/migrations/20260420_warehouse_support.sql in Supabase SQL Editor first."
        );
        return;
      }

      setSetupRequiredMessage(null);
      if (!response.ok) throw new Error(json.error || "Failed to load warehouses");
      const rows = json.data ?? [];
      setWarehouses(rows);
      if (rows.length > 0) {
        setAdminForm((prev) =>
          prev.warehouse_id ? prev : { ...prev, warehouse_id: rows[0].id }
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load warehouses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWarehouses();
  }, [fetchWarehouses]);

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWarehouse(true);
    try {
      const response = await fetch("/api/admin/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(warehouseForm),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to create warehouse");
      toast.success("Warehouse created");
      setWarehouseForm({ name: "", code: "", location: "", manager_name: "", manager_email: "" });
      await fetchWarehouses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create warehouse");
    } finally {
      setSavingWarehouse(false);
    }
  };

  const handleCreateWarehouseAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAdmin(true);
    try {
      const response = await fetch("/api/admin/warehouses/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adminForm),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to create warehouse admin");
      toast.success("Warehouse admin created");
      setAdminForm((prev) => ({ ...prev, full_name: "", email: "", password: "" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create warehouse admin");
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Warehouses</h1>
        <p className="text-sm text-muted-foreground">Manage warehouse locations and warehouse admin logins</p>
      </div>

      {setupRequiredMessage && (
        <Card className="border-red-200 bg-red-50/40">
          <CardHeader>
            <CardTitle className="text-red-700">Warehouse Setup Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-red-700">
            <p>{setupRequiredMessage}</p>
            <p>After running the migration, refresh this page.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Warehouse className="h-5 w-5" /> Add Warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateWarehouse}>
              <div className="space-y-2">
                <Label>Warehouse Name *</Label>
                <Input required value={warehouseForm.name} onChange={(e) => setWarehouseForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Warehouse Code</Label>
                <Input placeholder="AUTO if empty" value={warehouseForm.code} onChange={(e) => setWarehouseForm((p) => ({ ...p, code: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={warehouseForm.location} onChange={(e) => setWarehouseForm((p) => ({ ...p, location: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Manager Name</Label>
                  <Input value={warehouseForm.manager_name} onChange={(e) => setWarehouseForm((p) => ({ ...p, manager_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Manager Email</Label>
                  <Input type="email" value={warehouseForm.manager_email} onChange={(e) => setWarehouseForm((p) => ({ ...p, manager_email: e.target.value }))} />
                </div>
              </div>
              <Button type="submit" className="gap-2" disabled={savingWarehouse}><Plus className="h-4 w-4" /> {savingWarehouse ? "Saving..." : "Create Warehouse"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Create Warehouse Admin Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateWarehouseAdmin}>
              <div className="space-y-2">
                <Label>Warehouse *</Label>
                <Select
                  value={adminForm.warehouse_id}
                  onValueChange={(value) => setAdminForm((prev) => ({ ...prev, warehouse_id: value || "" }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={adminForm.full_name} onChange={(e) => setAdminForm((p) => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" required value={adminForm.email} onChange={(e) => setAdminForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input type="password" required minLength={8} value={adminForm.password} onChange={(e) => setAdminForm((p) => ({ ...p, password: e.target.value }))} />
              </div>
              <Button type="submit" disabled={creatingAdmin}>{creatingAdmin ? "Creating..." : "Create Warehouse Admin"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Warehouse List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading warehouses...</p>
          ) : warehouses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No warehouses created yet.</p>
          ) : (
            <div className="space-y-3">
              {warehouses.map((warehouse) => (
                <div key={warehouse.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{warehouse.name} <span className="text-xs text-muted-foreground">({warehouse.code})</span></p>
                    <p className="text-xs text-muted-foreground">{warehouse.location || "No location"} · {warehouse.manager_name || "No manager"}</p>
                  </div>
                  <Badge className={warehouse.is_active ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-700 border-0"}>
                    {warehouse.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
