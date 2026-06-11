"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Pencil, Trash2, Plus, ChevronDown, ChevronRight,
  Download, UserPlus, Upload, Loader2,
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

// ── Types ──────────────────────────────────────────────────────────────────────

type UPPRecord = {
  id: string;
  custom_price: number;
  status: "active" | "inactive";
  start_date: string | null;
  end_date: string | null;
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
type ImportResult = {
  total: number; created: number; updated: number; failed: number; skipped: number;
  errors: { line: number; user_email: string; product_name: string; error: string }[];
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WarehouseUserPricesPage() {
  const [records, setRecords] = useState<UPPRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  // Modal
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editRecord, setEditRecord] = useState<UPPRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [formUserId, setFormUserId] = useState("");
  const [formProductId, setFormProductId] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [userProducts, setUserProducts] = useState<ProductRow[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStartDate, setImportStartDate] = useState("");
  const [importEndDate, setImportEndDate] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importTargetUser, setImportTargetUser] = useState<{ id: string; email: string } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Form dates
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");

  // Add user modal
  const [addUserModal, setAddUserModal] = useState(false);
  const [addUserName, setAddUserName] = useState("");
  const [addUserEmail, setAddUserEmail] = useState("");
  const [addUserPhone, setAddUserPhone] = useState("");
  const [addUserPassword, setAddUserPassword] = useState("");
  const [addUserSaving, setAddUserSaving] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────────

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
        const res = await fetch(`/api/warehouse/user-prices?${params.toString()}`, { cache: "no-store" });
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

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/warehouse/customers");
      if (res.ok) {
        const j = (await res.json()) as { data?: CustomerRow[] };
        setCustomers(j.data ?? []);
      }
    })();
  }, []);

  useEffect(() => { void fetchRecords(); }, [fetchRecords]);

  // ── Group by user ───────────────────────────────────────────────────────────

  const userGroups = useMemo<UserGroup[]>(() => {
    const map = new Map<string, UserGroup>();
    for (const r of records) {
      const uid = r.user?.id ?? "__unknown__";
      if (!map.has(uid)) map.set(uid, { userId: uid, user: r.user, records: [] });
      map.get(uid)!.records.push(r);
    }
    for (const c of customers) {
      if (!map.has(c.id)) {
        map.set(c.id, {
          userId: c.id,
          user: { id: c.id, full_name: c.full_name, email: c.email, phone: c.phone ?? null },
          records: [],
        });
      }
    }
    const q = search.toLowerCase();
    return Array.from(map.values()).filter((g) => {
      if (!q) return true;
      const u = g.user;
      return (
        u?.email.toLowerCase().includes(q) ||
        u?.full_name?.toLowerCase().includes(q) ||
        g.records.some(
          (r) =>
            r.product?.name.toLowerCase().includes(q) ||
            (r.product?.sku ?? "").toLowerCase().includes(q)
        )
      );
    });
  }, [records, customers, search]);

  const toggleUser = (uid: string) =>
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const expandAll = () => setExpandedUsers(new Set(userGroups.map((g) => g.userId)));
  const collapseAll = () => setExpandedUsers(new Set());

  // ── Products for create modal ───────────────────────────────────────────────

  useEffect(() => {
    if (modal !== "create" || !formUserId) { setUserProducts([]); return; }
    void (async () => {
      const res = await fetch("/api/warehouse/products");
      if (res.ok) {
        const j = (await res.json()) as { data?: ProductRow[] };
        setUserProducts(j.data ?? []);
      }
    })();
  }, [formUserId, modal]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return userProducts;
    const q = productSearch.toLowerCase();
    return userProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [userProducts, productSearch]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openCreate = (preselectedUserId?: string) => {
    setFormUserId(preselectedUserId ?? "");
    setFormProductId("");
    setFormPrice("");
    setFormStatus("active");
    setFormStartDate("");
    setFormEndDate("");
    setProductSearch("");
    setEditRecord(null);
    setModal("create");
  };

  const openEdit = (r: UPPRecord) => {
    setEditRecord(r);
    setFormPrice(String(r.custom_price));
    setFormStatus(r.status);
    setFormStartDate(r.start_date ?? "");
    setFormEndDate(r.end_date ?? "");
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
        const res = await fetch("/api/warehouse/user-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: formUserId,
            product_id: formProductId,
            custom_price: price,
            status: formStatus,
            start_date: formStartDate || null,
            end_date: formEndDate || null,
          }),
        });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Failed to create");
        toast.success("Custom price created");
      } else if (modal === "edit" && editRecord) {
        const price = parseFloat(formPrice);
        if (isNaN(price) || price < 0) { toast.error("Enter a valid price"); return; }
        const res = await fetch(`/api/warehouse/user-prices/${editRecord.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            custom_price: price,
            status: formStatus,
            start_date: formStartDate || null,
            end_date: formEndDate || null,
          }),
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

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/warehouse/user-prices/${deleteId}`, { method: "DELETE" });
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

  const handleAddUser = async () => {
    setAddUserSaving(true);
    try {
      const res = await fetch("/api/warehouse/customers", {
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
      toast.success(`User ${j.data?.email ?? ""} created`);
      setAddUserModal(false);
      const custRes = await fetch("/api/warehouse/customers");
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

  const exportAllUserPrices = async () => {
    try {
      toast.info("Exporting all user prices...");
      const res = await fetch("/api/warehouse/user-prices?limit=10000", { cache: "no-store" });
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
    const res = await fetch(`/api/warehouse/user-prices?userId=${userId}&limit=2000`, { cache: "no-store" });
    const json = (await res.json()) as { data?: UPPRecord[] };
    const rows = json.data ?? [];
    if (!rows.length) { toast.info("No custom prices found for this user"); return; }
    const lines = [
      "user_email,product_sku,custom_price,status,start_date,end_date",
      ...rows.map((r) => [
        r.user?.email ?? userEmail,
        r.product?.sku ?? "",
        r.custom_price,
        r.status,
        r.start_date ?? "",
        r.end_date ?? "",
      ].join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `prices_${userEmail.replace(/@.*/, "")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importFile) { toast.error("Please select a CSV file"); return; }
    if (importEndDate && importStartDate && importEndDate < importStartDate) {
      toast.error("End date must be after start date"); return;
    }
    if (!importTargetUser) { toast.error("No user selected for import"); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("user_id", importTargetUser.id);
      if (importStartDate) fd.append("start_date", importStartDate);
      if (importEndDate) fd.append("end_date", importEndDate);
      const res = await fetch("/api/warehouse/user-prices/import", { method: "POST", body: fd });
      const json = (await res.json()) as { data?: ImportResult; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setImportResult(json.data ?? null);
      toast.success(`Import done: ${json.data?.created ?? 0} created, ${json.data?.updated ?? 0} updated`);
      await fetchRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Price Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Custom product prices per customer — overrides default pricing.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void exportAllUserPrices()} disabled={records.length === 0}>
            <Download className="h-4 w-4" /> Export All
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setAddUserModal(true)}>
            <UserPlus className="h-4 w-4" /> Add User
          </Button>
          <Button size="sm" className="gap-2" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> Add Price
          </Button>
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

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>
          {loading ? "Loading..." : `${userGroups.length} customer${userGroups.length !== 1 ? "s" : ""} · ${total} price record${total !== 1 ? "s" : ""}`}
        </span>
        {userGroups.length > 0 && (
          <div className="flex gap-2">
            <button className="hover:text-foreground transition-colors" onClick={expandAll}>Expand all</button>
            <span>·</span>
            <button className="hover:text-foreground transition-colors" onClick={collapseAll}>Collapse all</button>
          </div>
        )}
      </div>

      {/* User-grouped list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : userGroups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No customers found. Add a user or run a sync.
        </div>
      ) : (
        <div className="space-y-2">
          {userGroups.map((group) => {
            const expanded = expandedUsers.has(group.userId);
            const u = group.user;
            return (
              <Card key={group.userId} className="overflow-hidden">
                <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  <button
                    type="button"
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    onClick={() => toggleUser(group.userId)}
                  >
                    {expanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">
                        {u?.full_name ?? u?.email ?? "Unknown"}
                      </span>
                      {u?.full_name && (
                        <span className="ml-2 text-xs text-muted-foreground">{u.email}</span>
                      )}
                      {u?.phone && (
                        <span className="ml-2 text-xs text-muted-foreground">· {u.phone}</span>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {group.records.length} price{group.records.length !== 1 ? "s" : ""}
                    </Badge>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Export CSV"
                    onClick={() => void exportUserPrices(group.userId, u?.email ?? "")}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Import CSV for this user"
                    onClick={() => {
                      setImportTargetUser({ id: group.userId, email: u?.email ?? "" });
                      setImportFile(null);
                      setImportStartDate("");
                      setImportEndDate("");
                      setImportResult(null);
                      setImportModal(true);
                      if (importFileRef.current) importFileRef.current.value = "";
                    }}
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Add price for this user"
                    onClick={() => openCreate(group.userId)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {expanded && (
                  <CardContent className="p-0 border-t">
                    {group.records.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No custom prices yet.{" "}
                        <button
                          className="text-primary underline underline-offset-2"
                          onClick={() => openCreate(group.userId)}
                        >
                          Add one
                        </button>
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Base Price</TableHead>
                            <TableHead className="text-right">Custom Price</TableHead>
                            <TableHead className="text-right">Saving</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Validity</TableHead>
                            <TableHead>Updated</TableHead>
                            <TableHead className="w-20" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.records.map((r) => {
                            const base = r.product?.sale_price ?? r.product?.price ?? 0;
                            const saving = base - r.custom_price;
                            return (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium text-sm max-w-[200px] truncate">
                                  {r.product?.name ?? "—"}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {r.product?.sku ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {r.product?.category?.name ?? "—"}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {formatPrice(base)}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-sm">
                                  {formatPrice(r.custom_price)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {saving > 0 ? (
                                    <span className="text-green-600">-{formatPrice(saving)}</span>
                                  ) : saving < 0 ? (
                                    <span className="text-red-500">+{formatPrice(Math.abs(saving))}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="secondary"
                                    className={`text-[10px] border-0 ${r.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                                  >
                                    {r.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                  {r.start_date || r.end_date
                                    ? `${r.start_date ? fmt(r.start_date) : "∞"} – ${r.end_date ? fmt(r.end_date) : "∞"}`
                                    : <span className="text-muted-foreground/50">—</span>}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                  {fmt(r.updated_at)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost" size="icon" className="h-7 w-7"
                                      onClick={() => openEdit(r)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
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
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ──────────────────────────────────────────────── */}
      <Dialog open={modal !== null} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modal === "create" ? "Add Custom Price" : "Edit Custom Price"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {modal === "create" && (
              <>
                <div className="space-y-1.5">
                  <Label>Customer</Label>
                  <Select value={formUserId} onValueChange={(v) => { setFormUserId(v); setFormProductId(""); setProductSearch(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name ? `${c.full_name} (${c.email})` : c.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formUserId && (
                  <div className="space-y-1.5">
                    <Label>Product</Label>
                    <Input
                      placeholder="Search products…"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                    <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                      {filteredProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No products found</p>
                      ) : filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left ${formProductId === p.id ? "bg-primary/10 font-medium" : ""}`}
                          onClick={() => { setFormProductId(p.id); setFormPrice(String(p.sale_price ?? p.price)); }}
                        >
                          <span className="truncate">{p.name}</span>
                          <span className="ml-2 shrink-0 text-muted-foreground font-mono text-xs">
                            {formatPrice(p.sale_price ?? p.price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {modal === "edit" && editRecord && (
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <p className="font-medium">{editRecord.product?.name}</p>
                <p className="text-muted-foreground text-xs">{editRecord.user?.email}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="form-price">Custom Price (₹)</Label>
              <Input
                id="form-price"
                type="number"
                min={0}
                step="0.01"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="Enter price"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={(v) => v && setFormStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="form-start-date">Start Date</Label>
                <Input
                  id="form-start-date"
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-end-date">End Date</Label>
                <Input
                  id="form-end-date"
                  type="date"
                  value={formEndDate}
                  min={formStartDate || undefined}
                  onChange={(e) => setFormEndDate(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Leave dates blank for no time restriction.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {modal === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────────────────────────── */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete custom price?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will remove the custom price. The product will revert to its default price for this customer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Import Modal ──────────────────────────────────────────────────── */}
      <Dialog open={importModal} onOpenChange={(o) => { if (!o) setImportModal(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Prices for Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {importTargetUser && (
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{importTargetUser.email}</span>
              </div>
            )}
            <div className="rounded-lg border border-dashed p-4 text-center">
              <input
                ref={importFileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
              {importFile ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{importFile.name}</span>
                  <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => { setImportFile(null); if (importFileRef.current) importFileRef.current.value = ""; }}>Remove</button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">CSV columns: <code className="font-mono text-xs bg-muted px-1 rounded">product_name, custom_price, status</code></p>
                  <div className="flex justify-center gap-2 mt-3">
                    <Button variant="outline" size="sm" onClick={() => importFileRef.current?.click()}>Choose file</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/warehouse/products");
                          const json = (await res.json()) as { data?: { name: string }[] };
                          const products = json.data ?? [];
                          const rows = products.map((p) => `"${p.name.replace(/"/g, '""')}",0.00,active`).join("\n");
                          const csv = `product_name,custom_price,status\n${rows}\n`;
                          const blob = new Blob([csv], { type: "text/csv" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "all_items_template.csv";
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch {
                          // silent
                        }
                      }}
                    >
                      <Download className="h-3.5 w-3.5" /> Export All Items
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground"
                      onClick={() => {
                        const csv = `product_name,custom_price,status\nProduct Alpha,299.00,active\nProduct Beta,149.50,active\nProduct Gamma,89.00,inactive\n`;
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "warehouse_prices_sample.csv";
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" /> Sample
                    </Button>
                  </div>
                </>
              )}
            </div>
            {importFile && (
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => importFileRef.current?.click()}>
                Change File
              </Button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="imp-start">Prices Valid From</Label>
                <Input id="imp-start" type="date" value={importStartDate} onChange={(e) => setImportStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="imp-end">Prices Valid Until</Label>
                <Input id="imp-end" type="date" value={importEndDate} min={importStartDate || undefined} onChange={(e) => setImportEndDate(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Dates apply to all rows in this import. Leave blank for no expiry.</p>
            {importResult && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <p className="font-medium">Import Result</p>
                <p className="text-muted-foreground">{importResult.created} created, {importResult.updated} updated, {importResult.skipped} skipped (no price), {importResult.failed} failed out of {importResult.total} rows</p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 max-h-28 overflow-y-auto space-y-1">
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive">Row {e.line}: {e.product_name} — {e.error}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportModal(false)} disabled={importing}>Close</Button>
            <Button onClick={handleImport} disabled={importing || !importFile} className="gap-2">
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Add User Modal ───────────────────────────────────────────────────── */}
      <Dialog open={addUserModal} onOpenChange={(o) => { if (!o) setAddUserModal(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="au-name">Full Name</Label>
              <Input id="au-name" value={addUserName} onChange={(e) => setAddUserName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="au-email">Email</Label>
              <Input id="au-email" type="email" value={addUserEmail} onChange={(e) => setAddUserEmail(e.target.value)} placeholder="john@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="au-phone">Phone</Label>
              <Input id="au-phone" value={addUserPhone} onChange={(e) => setAddUserPhone(e.target.value)} placeholder="+91 9999999999" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="au-password">Password</Label>
              <Input id="au-password" type="password" value={addUserPassword} onChange={(e) => setAddUserPassword(e.target.value)} placeholder="Min 8 characters" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserModal(false)} disabled={addUserSaving}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={addUserSaving} className="gap-2">
              {addUserSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
