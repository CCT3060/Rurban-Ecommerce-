"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus, Search, Download, Loader2, Trash2, MoreHorizontal, Eye, Pencil, Ban, CheckCircle, Link2, Copy, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type CustomerDetails = {
  display_name?: string | null;
  customer_number?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  payment_terms?: string | null;
  gst_treatment?: string | null;
  gstin?: string | null;
  billing_attention?: string | null;
  billing_address?: string | null;
  billing_street2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_country?: string | null;
  billing_county?: string | null;
  billing_phone?: string | null;
  shipping_attention?: string | null;
  shipping_address?: string | null;
  shipping_street2?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_country?: string | null;
  shipping_code?: string | null;
  shipping_phone?: string | null;  zoho_contact_id?: string | null;};

type B2BUser = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  active_price_count: number;
  inactive_price_count: number;
  details: CustomerDetails | null;
};

type EditForm = {
  full_name: string;
  phone: string;
  is_active: "active" | "inactive";
  display_name: string;
  customer_number: string;
  company_name: string;
  contact_name: string;
  payment_terms: string;
  gst_treatment: string;
  gstin: string;
  billing_city: string;
  billing_state: string;
  billing_phone: string;
  shipping_city: string;
  shipping_state: string;
  shipping_phone: string;
};

function toEditForm(user: B2BUser): EditForm {
  return {
    full_name: user.full_name ?? "",
    phone: user.phone ?? "",
    is_active: user.is_active ? "active" : "inactive",
    display_name: user.details?.display_name ?? "",
    customer_number: user.details?.customer_number ?? "",
    company_name: user.details?.company_name ?? "",
    contact_name: user.details?.contact_name ?? "",
    payment_terms: user.details?.payment_terms ?? "",
    gst_treatment: user.details?.gst_treatment ?? "",
    gstin: user.details?.gstin ?? "",
    billing_city: user.details?.billing_city ?? "",
    billing_state: user.details?.billing_state ?? "",
    billing_phone: user.details?.billing_phone ?? "",
    shipping_city: user.details?.shipping_city ?? "",
    shipping_state: user.details?.shipping_state ?? "",
    shipping_phone: user.details?.shipping_phone ?? "",
  };
}

function downloadCsv(users: B2BUser[]) {
  const header = "Name,Email,Phone,Status\n";
  const rows = users.map((u) =>
    [
      `"${(u.full_name ?? "").replace(/"/g, '""')}"`,
      u.email,
      u.phone ?? "",
      u.is_active ? "active" : "inactive",
    ].join(",")
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "warehouse_b2b_users.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function WarehouseB2BUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<B2BUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedUser, setSelectedUser] = useState<B2BUser | null>(null);
  const [editUser, setEditUser] = useState<B2BUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteUser, setDeleteUser] = useState<B2BUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [zohoSyncingId, setZohoSyncingId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const generateInviteLink = async () => {
    setInviteLoading(true);
    try {
      const res = await fetch("/api/warehouse/b2b-invite");
      const json = (await res.json()) as { link?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to generate link");
      setInviteLink(json.link ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate link");
    } finally {
      setInviteLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/warehouse/customers", { cache: "no-store" });
      const json = (await res.json()) as { data?: B2BUser[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load users");
      setUsers(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchUsers(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone ?? "").includes(q)
    );
  }, [users, search]);

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/warehouse/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to update user");
      toast.success("User status updated");
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const handleEditSave = async () => {
    if (!editUser || !editForm) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/warehouse/customers/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editForm.full_name || null,
          phone: editForm.phone || null,
          is_active: editForm.is_active === "active",
          display_name: editForm.display_name || null,
          customer_number: editForm.customer_number || null,
          company_name: editForm.company_name || null,
          contact_name: editForm.contact_name || null,
          payment_terms: editForm.payment_terms || null,
          gst_treatment: editForm.gst_treatment || null,
          gstin: editForm.gstin || null,
          billing_city: editForm.billing_city || null,
          billing_state: editForm.billing_state || null,
          billing_phone: editForm.billing_phone || null,
          shipping_city: editForm.shipping_city || null,
          shipping_state: editForm.shipping_state || null,
          shipping_phone: editForm.shipping_phone || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to update customer");
      toast.success("Customer updated");
      setEditUser(null);
      setEditForm(null);
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update customer");
    } finally {
      setSavingEdit(false);
    }
  };

  const syncToZoho = async (userId: string) => {
    setZohoSyncingId(userId);
    try {
      const res = await fetch(`/api/warehouse/customers/${userId}/zoho-sync`, { method: "POST" });
      const json = (await res.json()) as { zohoContactId?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Zoho sync failed");
      toast.success(`Synced to Zoho Books${json.zohoContactId ? ` — ID: ${json.zohoContactId}` : ""}`);
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Zoho sync failed");
    } finally {
      setZohoSyncingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/warehouse/customers/${deleteUser.id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to delete user");
      toast.success(`${deleteUser.full_name ?? deleteUser.email} deleted`);
      setDeleteUser(null);
      await fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer</h1>
          <p className="text-sm text-muted-foreground">{users.length} B2B accounts assigned to this warehouse</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => downloadCsv(users)} disabled={users.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button className="gap-2" onClick={() => void generateInviteLink()} disabled={inviteLoading}>
            {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add B2B User
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email or phone..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Price Status</TableHead>
                <TableHead>Zoho</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Loading…</TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No B2B users found for this warehouse.</TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">{(u.full_name || u.email).charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{u.phone || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className="bg-green-100 text-green-700 border-0">{u.active_price_count} active</Badge>
                      <Badge className="bg-gray-100 text-gray-700 border-0">{u.inactive_price_count} inactive</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.details?.zoho_contact_id ? (
                      <Badge className="bg-blue-100 text-blue-700 border-0 gap-1">
                        <BookOpen className="h-3 w-3" /> Synced
                      </Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-700 border-0">Not synced</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={u.is_active ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-700 border-0"}>
                      {u.is_active ? "active" : "inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedUser(u)}><Eye className="h-4 w-4 mr-2" /> View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditUser(u); setEditForm(toEditForm(u)); }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void syncToZoho(u.id)}
                          disabled={zohoSyncingId === u.id}
                        >
                          {zohoSyncingId === u.id
                            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            : <BookOpen className="h-4 w-4 mr-2" />}
                          {u.details?.zoho_contact_id ? "Re-sync to Zoho" : "Sync to Zoho Books"}
                        </DropdownMenuItem>
                        {u.is_active ? (
                          <DropdownMenuItem className="text-destructive" onClick={() => void toggleActive(u.id, false)}><Ban className="h-4 w-4 mr-2" /> Deactivate</DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => void toggleActive(u.id, true)}><CheckCircle className="h-4 w-4 mr-2" /> Activate</DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => {
                          const token = Buffer.from(u.id).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
                          const link = `${window.location.origin}/onboarding/${token}`;
                          void navigator.clipboard.writeText(link).then(() => toast.success("Onboarding link copied!"));
                        }}><Link2 className="h-4 w-4 mr-2" /> Copy Link</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteUser(u)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={(v) => { if (!v) setSelectedUser(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Customer Details</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm py-2">
            <div className="space-y-1">
              <p><span className="text-muted-foreground">Name:</span> {selectedUser?.full_name || "-"}</p>
              <p><span className="text-muted-foreground">Email:</span> {selectedUser?.email || "-"}</p>
              <p><span className="text-muted-foreground">Phone:</span> {selectedUser?.phone || "-"}</p>
              <p><span className="text-muted-foreground">Display Name:</span> {selectedUser?.details?.display_name || "-"}</p>
              <p><span className="text-muted-foreground">Ecom Customer No:</span> {selectedUser?.details?.customer_number || "-"}</p>
              <p><span className="text-muted-foreground">Company:</span> {selectedUser?.details?.company_name || "-"}</p>
              <p><span className="text-muted-foreground">Contact:</span> {selectedUser?.details?.contact_name || "-"}</p>
              <p><span className="text-muted-foreground">Payment Terms:</span> {selectedUser?.details?.payment_terms || "-"}</p>
              <p><span className="text-muted-foreground">GST Treatment:</span> {selectedUser?.details?.gst_treatment || "-"}</p>
              <p><span className="text-muted-foreground">GSTIN:</span> {selectedUser?.details?.gstin || "-"}</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs uppercase text-muted-foreground">Billing</p>
                <p>{selectedUser?.details?.billing_city || "-"}, {selectedUser?.details?.billing_state || "-"}</p>
                <p>{selectedUser?.details?.billing_phone || "-"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase text-muted-foreground">Shipping</p>
                <p>{selectedUser?.details?.shipping_city || "-"}, {selectedUser?.details?.shipping_state || "-"}</p>
                <p>{selectedUser?.details?.shipping_phone || "-"}</p>
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSelectedUser(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser && !!editForm} onOpenChange={(v) => { if (!v) { setEditUser(null); setEditForm(null); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5"><Label>Full Name</Label><Input value={editForm?.full_name ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, full_name: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={editForm?.phone ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, phone: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>Status</Label><Select value={editForm?.is_active ?? "active"} onValueChange={(v) => setEditForm((p) => (p ? { ...p, is_active: v as "active" | "inactive" } : p))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Display Name</Label><Input value={editForm?.display_name ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, display_name: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>Ecom Customer No.</Label><Input readOnly className="bg-muted" value={editForm?.customer_number ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, customer_number: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>Company</Label><Input value={editForm?.company_name ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, company_name: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>Contact</Label><Input value={editForm?.contact_name ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, contact_name: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>Payment Terms</Label><Input value={editForm?.payment_terms ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, payment_terms: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>GST Treatment</Label><Input value={editForm?.gst_treatment ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, gst_treatment: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>GSTIN</Label><Input value={editForm?.gstin ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, gstin: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>Billing City</Label><Input value={editForm?.billing_city ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, billing_city: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>Billing State</Label><Input value={editForm?.billing_state ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, billing_state: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>Billing Phone</Label><Input value={editForm?.billing_phone ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, billing_phone: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>Shipping City</Label><Input value={editForm?.shipping_city ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, shipping_city: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>Shipping State</Label><Input value={editForm?.shipping_state ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, shipping_state: e.target.value } : p))} /></div>
            <div className="space-y-1.5"><Label>Shipping Phone</Label><Input value={editForm?.shipping_phone ?? ""} onChange={(e) => setEditForm((p) => (p ? { ...p, shipping_phone: e.target.value } : p))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditUser(null); setEditForm(null); }} disabled={savingEdit}>Cancel</Button>
            <Button onClick={() => void handleEditSave()} disabled={savingEdit} className="gap-2">{savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteUser} onOpenChange={(v) => { if (!v) setDeleteUser(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete B2B User</DialogTitle></DialogHeader>
          <div className="py-2 text-sm text-muted-foreground space-y-1">
            <p>Are you sure you want to permanently delete:</p>
            <p className="font-semibold text-foreground">{deleteUser?.full_name ?? deleteUser?.email}</p>
            <p className="text-xs mt-2 text-destructive">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting} className="gap-2">{deleting ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting…</> : <><Trash2 className="h-4 w-4" />Delete</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invite link dialog ── */}
      <Dialog open={!!inviteLink} onOpenChange={(v) => { if (!v) setInviteLink(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Invite B2B Customer
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Send this link to your customer. They will create their own account — name, email, password, company details, GST, and addresses.
          </p>

          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <p className="text-xs break-all text-muted-foreground leading-relaxed">{inviteLink}</p>
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                void navigator.clipboard.writeText(inviteLink ?? "").then(() => toast.success("Link copied!"));
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy Link
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">This link is valid for 7 days.</p>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => void generateInviteLink()} disabled={inviteLoading}>
              {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}New Link
            </Button>
            <Button size="sm" onClick={() => setInviteLink(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
