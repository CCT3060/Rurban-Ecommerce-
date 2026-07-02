"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Warehouse, MapPin, Mail, User, UserPlus,
  Pencil, Check, X, Shield, Package, Search, TrendingDown, AlertTriangle,
  IndianRupee, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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

type WarehouseDetail = {
  id: string;
  name: string;
  code: string;
  location: string | null;
  state: string | null;
  manager_name: string | null;
  manager_email: string | null;
  is_active: boolean;
  created_at?: string;
};

type WarehouseUser = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

type EditForm = {
  name: string;
  code: string;
  location: string;
  state: string;
  manager_name: string;
  manager_email: string;
  is_active: boolean;
};

type AddUserForm = {
  full_name: string;
  email: string;
  password: string;
};

const EMPTY_USER_FORM: AddUserForm = { full_name: "", email: "", password: "" };

type StockProduct = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  price: number;
  sale_price: number | null;
  status: string;
  category: { id: string; name: string } | null;
  images: Array<{ image_url: string; is_primary: boolean }>;
};

type StockSummary = {
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStockValue: number;
};

export default function WarehouseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const warehouseId = params.id;

  const [warehouse, setWarehouse] = useState<WarehouseDetail | null>(null);
  const [users, setUsers] = useState<WarehouseUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);

  const [stock, setStock] = useState<StockProduct[]>([]);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockLoaded, setStockLoaded] = useState(false);
  const [stockSearch, setStockSearch] = useState("");

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState<AddUserForm>(EMPTY_USER_FORM);
  const [addingUser, setAddingUser] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const states = useLookup("indian_state");

  const fetchWarehouse = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/warehouses/${warehouseId}`, { cache: "no-store" });
      const json = (await res.json()) as { data?: WarehouseDetail; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load warehouse");
      setWarehouse(json.data ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load warehouse");
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const res = await fetch(`/api/admin/warehouses/${warehouseId}/users`, { cache: "no-store" });
      const json = (await res.json()) as { data?: WarehouseUser[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load users");
      setUsers(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }, [warehouseId]);

  const fetchStock = useCallback(async () => {
    try {
      setStockLoading(true);
      const res = await fetch(`/api/admin/warehouses/${warehouseId}/stock`, { cache: "no-store" });
      const json = (await res.json()) as {
        data?: StockProduct[];
        summary?: StockSummary;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load stock");
      setStock(json.data ?? []);
      setStockSummary(json.summary ?? null);
      setStockLoaded(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load stock");
    } finally {
      setStockLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    void fetchWarehouse();
    void fetchUsers();
  }, [fetchWarehouse, fetchUsers]);

  const startEdit = () => {
    if (!warehouse) return;
    setEditForm({
      name: warehouse.name,
      code: warehouse.code,
      location: warehouse.location ?? "",
      state: warehouse.state ?? "",
      manager_name: warehouse.manager_name ?? "",
      manager_email: warehouse.manager_email ?? "",
      is_active: warehouse.is_active,
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditForm(null);
  };

  const handleSave = async () => {
    if (!editForm) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/warehouses/${warehouseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          code: editForm.code,
          location: editForm.location || null,
          manager_name: editForm.manager_name || null,
          manager_email: editForm.manager_email || null,
          is_active: editForm.is_active,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to update warehouse");
      toast.success("Warehouse updated");
      setEditing(false);
      setEditForm(null);
      await fetchWarehouse();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update warehouse");
    } finally {
      setSaving(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    try {
      const res = await fetch("/api/admin/warehouses/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id: warehouseId,
          full_name: addUserForm.full_name,
          email: addUserForm.email,
          password: addUserForm.password,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to create user");
      toast.success("Warehouse admin created");
      setAddUserForm(EMPTY_USER_FORM);
      setShowAddUser(false);
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setAddingUser(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/warehouses/${warehouseId}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to delete warehouse");
      toast.success("Warehouse deleted");
      router.push("/admin/warehouses");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm text-muted-foreground">Loading warehouse...</p>
        </div>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Warehouse not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/admin/warehouses")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {warehouse.name}
              <Badge
                className={
                  warehouse.is_active
                    ? "bg-green-100 text-green-700 border-0 text-xs"
                    : "bg-gray-100 text-gray-700 border-0 text-xs"
                }
              >
                {warehouse.is_active ? "Active" : "Inactive"}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground font-mono">{warehouse.code}</p>
          </div>
        </div>
        {!editing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startEdit} className="gap-2">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        )}
      </div>

      {/* Warehouse Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Warehouse className="h-4 w-4" /> Warehouse Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editing && editForm ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Warehouse Name *</Label>
                  <Input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => p && ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    value={editForm.code}
                    onChange={(e) => setEditForm((p) => p && ({ ...p, code: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={editForm.location}
                    onChange={(e) => setEditForm((p) => p && ({ ...p, location: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select
                    value={editForm.state}
                    onValueChange={(val) => setEditForm((p) => p && ({ ...p, state: val ?? "" }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {states.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Manager Name</Label>
                  <Input
                    value={editForm.manager_name}
                    onChange={(e) => setEditForm((p) => p && ({ ...p, manager_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Manager Email</Label>
                  <Input
                    type="email"
                    value={editForm.manager_email}
                    onChange={(e) => setEditForm((p) => p && ({ ...p, manager_email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.is_active ? "active" : "inactive"}
                  onValueChange={(val) => setEditForm((p) => p && ({ ...p, is_active: val === "active" }))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  <Check className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={cancelEdit} className="gap-2">
                  <X className="h-4 w-4" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <InfoRow
                icon={<MapPin className="h-4 w-4" />}
                label="Location"
                value={[warehouse.location, warehouse.state].filter(Boolean).join(", ") || "—"}
              />
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="Manager"
                value={warehouse.manager_name || "—"}
              />
              <InfoRow
                icon={<Mail className="h-4 w-4" />}
                label="Manager Email"
                value={warehouse.manager_email || "—"}
              />
              {warehouse.created_at && (
                <InfoRow
                  icon={<Warehouse className="h-4 w-4" />}
                  label="Created"
                  value={new Date(warehouse.created_at).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warehouse Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" /> Warehouse Admin Users
            </CardTitle>
            <Button size="sm" onClick={() => setShowAddUser(true)} className="gap-2">
              <UserPlus className="h-4 w-4" /> Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <p className="text-sm text-muted-foreground">Loading users...</p>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                No admin users for this warehouse yet.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 gap-2"
                onClick={() => setShowAddUser(true)}
              >
                <UserPlus className="h-4 w-4" /> Add First User
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {user.role.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          user.is_active
                            ? "bg-green-100 text-green-700 border-0"
                            : "bg-gray-100 text-gray-700 border-0"
                        }
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(user.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Stock In Hand */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" /> Stock In Hand
            </CardTitle>
            {stockLoaded && (
              <Button
                size="sm"
                variant="outline"
                disabled={stockLoading}
                onClick={() => void fetchStock()}
                className="gap-2"
              >
                <Search className="h-3.5 w-3.5" />
                {stockLoading ? "Refreshing..." : "Refresh"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Not loaded yet — show load button */}
          {!stockLoaded && !stockLoading && (
            <div className="text-center py-10">
              <Package className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Stock details are not loaded yet.
              </p>
              <Button onClick={() => void fetchStock()} className="gap-2">
                <Package className="h-4 w-4" /> Load Stock Details
              </Button>
            </div>
          )}
          {/* Loading spinner */}
          {stockLoading && (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <Search className="h-4 w-4 animate-pulse" />
              <span className="text-sm">Loading stock...</span>
            </div>
          )}

          {/* Summary stats */}
          {stockLoaded && stockSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Products</p>
                <p className="text-xl font-bold">{stockSummary.totalProducts}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Units</p>
                <p className="text-xl font-bold">{stockSummary.totalStock.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-center">
                <p className="text-xs text-amber-700 mb-1 flex items-center justify-center gap-1">
                  <TrendingDown className="h-3 w-3" /> Low Stock
                </p>
                <p className="text-xl font-bold text-amber-700">{stockSummary.lowStockCount}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50/40 p-3 text-center">
                <p className="text-xs text-red-700 mb-1 flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Out of Stock
                </p>
                <p className="text-xl font-bold text-red-700">{stockSummary.outOfStockCount}</p>
              </div>
            </div>
          )}

          {/* Stock value */}
          {stockLoaded && stockSummary && (
            <div className="flex items-center gap-2 rounded-lg border bg-primary/5 px-4 py-2.5">
              <IndianRupee className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Estimated Stock Value:</span>
              <span className="font-semibold text-primary">
                ₹{stockSummary.totalStockValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}

          {/* Search + Products table */}
          {stockLoaded && (
          <>
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-9"
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
            />
          </div>

          {/* Products table */}
          {stock.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No products assigned to this warehouse.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock
                    .filter((p) => {
                      const q = stockSearch.toLowerCase();
                      return (
                        !q ||
                        p.name.toLowerCase().includes(q) ||
                        (p.sku ?? "").toLowerCase().includes(q) ||
                        (p.category?.name ?? "").toLowerCase().includes(q)
                      );
                    })
                    .map((product) => {
                      const primaryImage = product.images.find((i) => i.is_primary) ?? product.images[0];
                      const displayPrice = product.sale_price ?? product.price;
                      const isLow = product.stock > 0 && product.stock <= 10;
                      const isOut = product.stock === 0;
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="p-2">
                            {primaryImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={primaryImage.image_url}
                                alt={product.name}
                                className="h-9 w-9 rounded object-cover border"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded border bg-muted flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {product.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm font-mono">
                            {product.sku ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {product.category?.name ?? "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            <span className="font-medium">
                              ₹{displayPrice.toLocaleString("en-IN")}
                            </span>
                            {product.sale_price !== null && product.sale_price !== product.price && (
                              <span className="ml-1 text-xs text-muted-foreground line-through">
                                ₹{product.price.toLocaleString("en-IN")}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`font-semibold text-sm ${
                                isOut
                                  ? "text-red-600"
                                  : isLow
                                  ? "text-amber-600"
                                  : "text-green-700"
                              }`}
                            >
                              {product.stock}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                product.status === "active"
                                  ? "bg-green-100 text-green-700 border-0 text-xs"
                                  : product.status === "draft"
                                  ? "bg-yellow-100 text-yellow-700 border-0 text-xs"
                                  : "bg-gray-100 text-gray-700 border-0 text-xs"
                              }
                            >
                              {product.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
          </>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Add Warehouse Admin User
            </DialogTitle>
          </DialogHeader>
          <form id="add-user-form" onSubmit={handleAddUser}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="u-name">Full Name</Label>
                <Input
                  id="u-name"
                  value={addUserForm.full_name}
                  placeholder="e.g. Ramesh Kumar"
                  onChange={(e) => setAddUserForm((p) => ({ ...p, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-email">Email *</Label>
                <Input
                  id="u-email"
                  type="email"
                  required
                  value={addUserForm.email}
                  onChange={(e) => setAddUserForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-password">Password *</Label>
                <Input
                  id="u-password"
                  type="password"
                  required
                  minLength={8}
                  value={addUserForm.password}
                  onChange={(e) => setAddUserForm((p) => ({ ...p, password: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>
              Cancel
            </Button>
            <Button form="add-user-form" type="submit" disabled={addingUser}>
              {addingUser ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete Warehouse
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{warehouse?.name}</span>?
            This action cannot be undone. Products and users linked to this warehouse will lose their association.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
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

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
