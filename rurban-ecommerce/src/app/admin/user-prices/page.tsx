"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus, Pencil, Trash2, Search, Upload, ChevronDown, ChevronRight,
  CheckCircle, XCircle, UserPlus, Download, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatPrice } from "@/lib/constants";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type UPPRecord = {
  id: string;
  custom_price: number;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  user: { id: string; full_name: string | null; email: string; phone: string | null } | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    price: number;
    sale_price: number | null;
    category_id: string;
    category: { id: string; name: string } | null;
  } | null;
};

type UserGroup = {
  userId: string;
  user: UPPRecord["user"];
  records: UPPRecord[];
};

type CustomerRow = { id: string; full_name: string | null; email: string; phone?: string | null };
type ProductRow = { id: string; name: string; sku: string | null; price: number; sale_price: number | null };

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminUserPricesPage() {
  const [records, setRecords] = useState<UPPRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");

  // Reference data
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  // Expanded user rows
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  // Modal state
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editRecord, setEditRecord] = useState<UPPRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state (create/edit)
  const [formUserId, setFormUserId] = useState("");
  const [formProductId, setFormProductId] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [userProducts, setUserProducts] = useState<ProductRow[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add user modal
  const [addUserModal, setAddUserModal] = useState(false);
  const [addUserName, setAddUserName] = useState("");
  const [addUserEmail, setAddUserEmail] = useState("");
  const [addUserPhone, setAddUserPhone] = useState("");
  const [addUserPassword, setAddUserPassword] = useState("");
  const [addUserSaving, setAddUserSaving] = useState(false);

  // â”€â”€ Fetch records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      // Paginate through ALL records so per-user counts are always accurate
      const PAGE = 2000;
      const allRecords: UPPRecord[] = [];
      let page = 1;
      let totalCount = 0;
      while (true) {
        const params = new URLSearchParams({ limit: String(PAGE), page: String(page) });
        if (search) params.set("search", search);
        const res = await fetch(`/api/admin/user-prices?${params.toString()}`, { cache: "no-store" });
        const json = (await res.json()) as { data?: UPPRecord[]; total?: number; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load records");
        const batch = json.data ?? [];
        allRecords.push(...batch);
        totalCount = json.total ?? allRecords.length;
        if (allRecords.length >= totalCount || batch.length < PAGE) break;
        page++;
      }
      setRecords(allRecords);
      setTotal(totalCount);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [search]);

  // â”€â”€ Fetch reference data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/customers?user_type=b2b");
      if (res.ok) {
        const j = (await res.json()) as { data?: CustomerRow[] };
        setCustomers(j.data ?? []);
      }
    })();
  }, []);

  useEffect(() => { void fetchRecords(); }, [fetchRecords]);

  // â”€â”€ Group records by user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const userGroups = useMemo<UserGroup[]>(() => {
    const map = new Map<string, UserGroup>();
    for (const r of records) {
      const uid = r.user?.id ?? "__unknown__";
      if (!map.has(uid)) map.set(uid, { userId: uid, user: r.user, records: [] });
      map.get(uid)!.records.push(r);
    }
    // Show all customers even those without any price records yet
    for (const c of customers) {
      if (!map.has(c.id)) {
        map.set(c.id, {
          userId: c.id,
          user: { id: c.id, full_name: c.full_name, email: c.email, phone: c.phone ?? null },
          records: [],
        });
      }
    }
    return Array.from(map.values());
  }, [records, customers]);

  // â”€â”€ Expand / collapse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const toggleUser = (uid: string) =>
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });

  const expandAll = () => setExpandedUsers(new Set(userGroups.map((g) => g.userId)));
  const collapseAll = () => setExpandedUsers(new Set());

  // â”€â”€ Load products when user is selected in create modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    if (modal !== "create" || !formUserId) { setUserProducts([]); return; }
    void (async () => {
      const res = await fetch(`/api/admin/products?limit=500&status=active`);
      if (res.ok) {
        const j = (await res.json()) as { data?: ProductRow[] };
        setUserProducts(j.data ?? []);
      }
    })();
  }, [formUserId, modal]);

  // â”€â”€ Filtered product list in create modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const filteredProducts = useMemo(() => {
    if (!productSearch) return userProducts;
    const q = productSearch.toLowerCase();
    return userProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [userProducts, productSearch]);

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const openCreate = (preselectedUserId?: string) => {
    setFormUserId(preselectedUserId ?? "");
    setFormProductId("");
    setFormPrice("");
    setFormStatus("active");
    setProductSearch("");
    setEditRecord(null);
    setModal("create");
  };

  const openEdit = (r: UPPRecord) => {
    setEditRecord(r);
    setFormPrice(String(r.custom_price));
    setFormStatus(r.status);
    setModal("edit");
  };

  const closeModal = () => { setModal(null); setEditRecord(null); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal === "create") {
        if (!formUserId) { toast.error("Please select a user"); return; }
        if (!formProductId) { toast.error("Please select a product"); return; }
        const price = parseFloat(formPrice);
        if (isNaN(price) || price < 0) { toast.error("Enter a valid price"); return; }

        const res = await fetch("/api/admin/user-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: formUserId, product_id: formProductId, custom_price: price, status: formStatus }),
        });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Failed to create");
        toast.success("Custom price created");
      } else if (modal === "edit" && editRecord) {
        const price = parseFloat(formPrice);
        if (isNaN(price) || price < 0) { toast.error("Enter a valid price"); return; }

        const res = await fetch(`/api/admin/user-prices/${editRecord.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ custom_price: price, status: formStatus }),
        });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Failed to update");
        toast.success("Custom price updated");
      }
      closeModal();
      await fetchRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // â”€â”€ Add user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const openAddUser = () => {
    setAddUserName("");
    setAddUserEmail("");
    setAddUserPhone("");
    setAddUserPassword("");
    setAddUserModal(true);
  };

  const handleAddUser = async () => {
    setAddUserSaving(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: addUserName,
          email: addUserEmail,
          phone: addUserPhone,
          password: addUserPassword,
        }),
      });
      const j = (await res.json()) as { data?: { email: string }; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to create user");
      toast.success(`User ${j.data?.email ?? ""} created successfully`);
      setAddUserModal(false);
      // Refresh customer list
      const custRes = await fetch("/api/admin/customers?user_type=b2b");
      if (custRes.ok) {
        const cj = (await custRes.json()) as { data?: CustomerRow[] };
        setCustomers(cj.data ?? []);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setAddUserSaving(false);
    }
  };

  // â”€â”€ Export user prices â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const exportAllUserPrices = async () => {
    try {
      toast.info("Exporting all user prices...");
      const res = await fetch("/api/admin/user-prices?limit=10000", { cache: "no-store" });
      const json = (await res.json()) as { data?: UPPRecord[] };
      const data = json.data ?? [];
      if (data.length === 0) { toast.info("No records to export"); return; }
      const csvLines = [
        "user_email,user_name,product_name,product_sku,custom_price,status",
        ...data.map((r) =>
          [
            r.user?.email ?? "",
            '"' + (r.user?.full_name ?? "").replace(/"/g, '""') + '"',
            '"' + (r.product?.name ?? "").replace(/"/g, '""') + '"',
            r.product?.sku ?? "",
            r.custom_price,
            r.status,
          ].join(",")
        ),
      ];
      const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "all_user_prices.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported " + data.length + " records");
    } catch {
      toast.error("Export failed");
    }
  };

  const exportUserPrices = async (userId: string, userEmail: string) => {
    try {
      const res = await fetch(
        `/api/admin/user-prices?userId=${userId}&limit=2000`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as { data?: UPPRecord[] };
      const rows = json.data ?? [];
      if (rows.length === 0) { toast.info("No custom prices found for this user"); return; }

      const lines = [
        "user_email,product_sku,custom_price,status",
        ...rows.map((r) =>
          [
            r.user?.email ?? userEmail,
            r.product?.sku ?? "",
            r.custom_price,
            r.status,
          ].join(",")
        ),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prices_${userEmail.replace(/@.*/, "")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/user-prices/${deleteId}`, { method: "DELETE" });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to delete");
      toast.success("Record deleted");
      setDeleteId(null);
      await fetchRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Price Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Custom product prices per customer â€” overrides default pricing.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void exportAllUserPrices()} disabled={records.length === 0}>
            <Download className="h-4 w-4" /> Export All
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={openAddUser}>
            <UserPlus className="h-4 w-4" /> Add User
          </Button>
          <Link href="/admin/user-prices/import">
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, product or SKU..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* User-wise list */}
      <div className="space-y-3">
        {/* Summary bar */}
        <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
          <span>
            {loading
              ? "Loading..."
              : `${userGroups.length} customer${userGroups.length !== 1 ? "s" : ""} · ${total} price record${total !== 1 ? "s" : ""}`}
          </span>
          {userGroups.length > 0 && (
            <div className="flex gap-2">
              <button className="hover:text-foreground transition-colors" onClick={expandAll}>
                Expand all
              </button>
              <span>Â·</span>
              <button className="hover:text-foreground transition-colors" onClick={collapseAll}>
                Collapse all
              </button>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">Loading...</CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!loading && userGroups.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <User className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No customers found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click <strong>Add User</strong> to create a customer.
              </p>
            </CardContent>
          </Card>
        )}

        {/* One card per user */}
        {!loading &&
          userGroups.map((group) => {
            const isExpanded = expandedUsers.has(group.userId);
            const activeCount = group.records.filter((r) => r.status === "active").length;
            const inactiveCount = group.records.length - activeCount;

            return (
              <Card key={group.userId} className="overflow-hidden">
                {/* User header */}
                <div
                  className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                    group.records.length > 0 ? "cursor-pointer hover:bg-muted/40" : ""
                  }`}
                  onClick={() => group.records.length > 0 && toggleUser(group.userId)}
                >
                    {/* Chevron - only shown when there are price records */}
                    <span className="shrink-0 text-muted-foreground w-4">
                      {group.records.length > 0 && (
                        isExpanded
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />
                      )}
                    </span>

                    {/* Avatar */}
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0 uppercase">
                      {(group.user?.full_name ?? group.user?.email ?? "?")[0]}
                    </div>

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {group.user?.full_name ?? (
                          <span className="text-muted-foreground italic">No name</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{group.user?.email ?? "â€”"}</span>
                        {group.user?.phone && <span>Â· {group.user.phone}</span>}
                      </div>
                    </div>

                    {/* Stats badges */}
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {group.records.length > 0 ? (
                        <>
                          <Badge variant="outline" className="text-xs font-normal">
                            <span className="font-semibold mr-1">{group.records.length}</span>
                            product{group.records.length !== 1 ? "s" : ""}
                          </Badge>
                          {activeCount > 0 && (
                            <Badge variant="default" className="text-xs font-normal gap-1">
                              <CheckCircle className="h-3 w-3" /> {activeCount} active
                            </Badge>
                          )}
                          {inactiveCount > 0 && (
                            <Badge variant="secondary" className="text-xs font-normal gap-1">
                              <XCircle className="h-3 w-3" /> {inactiveCount} inactive
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                          No prices set
                        </Badge>
                      )}
                    </div>

                    {/* Per-user action buttons */}
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        title="Add price for this user"
                        onClick={() => {
                          openCreate(group.userId);
                          if (!isExpanded) toggleUser(group.userId);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Export prices for this user"
                        onClick={() =>
                          void exportUserPrices(group.userId, group.user?.email ?? "")
                        }
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Link
                        href={`/admin/user-prices/import?email=${encodeURIComponent(group.user?.email ?? "")}`}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Import prices for this user"
                        >
                          <Upload className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>

                {isExpanded && (
                  <div className="border-t bg-muted/10">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="pl-14">Product</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Default Price</TableHead>
                            <TableHead className="text-right">Custom Price</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Updated</TableHead>
                            <TableHead className="text-center w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.records.map((r) => {
                            const defaultPrice = r.product?.sale_price ?? r.product?.price ?? 0;
                            return (
                              <TableRow key={r.id} className="hover:bg-muted/20">
                                <TableCell className="pl-14 font-medium">
                                  {r.product?.name ?? "â€”"}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {r.product?.sku ?? "â€”"}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {r.product?.category?.name ?? "â€”"}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {formatPrice(defaultPrice)}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-primary">
                                  {formatPrice(r.custom_price)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={r.status === "active" ? "default" : "secondary"}
                                    className="gap-1 text-xs"
                                  >
                                    {r.status === "active"
                                      ? <CheckCircle className="h-3 w-3" />
                                      : <XCircle className="h-3 w-3" />}
                                    {r.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {fmt(r.created_at)}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {fmt(r.updated_at)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-center gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      title="Edit"
                                      onClick={() => openEdit(r)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      title="Delete"
                                      onClick={() => setDeleteId(r.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
      </div>

      {/* â”€â”€ Create / Edit Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Dialog open={modal !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {modal === "create" ? "Add Custom Price" : "Edit Custom Price"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {modal === "create" && (
              <>
                <div className="space-y-1.5">
                  <Label>Customer *</Label>
                  <Select
                    value={formUserId}
                    onValueChange={(v) => setFormUserId(v ?? "")}
                    items={Object.fromEntries(customers.map((c) => [c.id, c.full_name ? `${c.full_name} (${c.email})` : c.email]))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[220px]">
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id} label={c.full_name ? `${c.full_name} (${c.email})` : c.email}>
                          {c.full_name ? `${c.full_name} (${c.email})` : c.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formUserId && (
                  <div className="space-y-1.5">
                    <Label>Product *</Label>
                    <div className="relative mb-1.5">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search product or SKU..."
                        className="pl-8 h-8 text-sm"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                      />
                    </div>
                    <Select value={formProductId} onValueChange={(v) => setFormProductId(v ?? "")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[220px]">
                        {filteredProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}{p.sku ? ` (${p.sku})` : ""}{" â€” "}{formatPrice(p.sale_price ?? p.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {modal === "edit" && editRecord && (
              <div className="p-3 bg-muted/40 rounded-lg text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">User: </span>
                  <span className="font-medium">
                    {editRecord.user?.full_name ?? editRecord.user?.email ?? "â€”"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Product: </span>
                  <span className="font-medium">{editRecord.product?.name ?? "â€”"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Default price: </span>
                  <span>{formatPrice(editRecord.product?.sale_price ?? editRecord.product?.price ?? 0)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Custom Price (â‚¹) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v ?? "active")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : modal === "create" ? "Create" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â”€â”€ Add User Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Dialog open={addUserModal} onOpenChange={(open) => !open && setAddUserModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Create New Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input placeholder="John Doe" value={addUserName} onChange={(e) => setAddUserName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" placeholder="customer@example.com" value={addUserEmail} onChange={(e) => setAddUserEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" placeholder="+91 9876543210" value={addUserPhone} onChange={(e) => setAddUserPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input type="password" placeholder="Min. 6 characters" value={addUserPassword} onChange={(e) => setAddUserPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserModal(false)} disabled={addUserSaving}>Cancel</Button>
            <Button onClick={() => void handleAddUser()} disabled={addUserSaving}>
              {addUserSaving ? "Creating..." : "Create Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â”€â”€ Delete Confirmation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Custom Price</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The customer will revert to the default product price after deletion.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

