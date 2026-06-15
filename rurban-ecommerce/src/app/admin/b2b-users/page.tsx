"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus, Search, Download, MoreHorizontal, Ban, CheckCircle, Trash2,
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type B2BUser = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  orders_count: number;
  spent_total: number;
};

function downloadCsv(users: B2BUser[]) {
  const header = "Name,Email,Phone,Orders,Total Spent,Status,Joined\n";
  const rows = users.map((u) =>
    [
      `"${(u.full_name ?? "").replace(/"/g, '""')}"`,
      u.email,
      u.phone ?? "",
      u.orders_count,
      u.spent_total,
      u.is_active ? "active" : "inactive",
      new Date(u.created_at).toLocaleDateString("en-GB"),
    ].join(",")
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "b2b_users.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminB2BUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<B2BUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Delete confirmation
  const [deleteUser, setDeleteUser] = useState<B2BUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/customers?user_type=b2b", { cache: "no-store" });
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

  const handleAdd = async () => {
    if (!email || !password) { toast.error("Email and password are required"); return; }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
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

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/customers/${deleteUser.id}`, { method: "DELETE" });
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">B2B Customer</h1>
          <p className="text-sm text-muted-foreground">{users.length} B2B accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => downloadCsv(users)} disabled={users.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button className="gap-2" onClick={() => router.push("/admin/b2b-users/new")}>
            <UserPlus className="h-4 w-4" /> Add B2B User
          </Button>
        </div>
      </div>

      {/* Table */}
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
                <TableHead className="text-center">Orders</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No B2B users found.
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {(u.full_name || u.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{u.phone || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{u.orders_count}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ₹{Number(u.spent_total).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell>
                    <Badge className={u.is_active ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-700 border-0"}>
                      {u.is_active ? "active" : "inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("en-GB")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {u.is_active ? (
                          <DropdownMenuItem className="text-destructive" onClick={() => void toggleActive(u.id, false)}>
                            <Ban className="h-4 w-4 mr-2" /> Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => void toggleActive(u.id, true)}>
                            <CheckCircle className="h-4 w-4 mr-2" /> Activate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteUser(u)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(v) => { if (!v) setDeleteUser(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete B2B User</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground space-y-1">
            <p>Are you sure you want to permanently delete:</p>
            <p className="font-semibold text-foreground">
              {deleteUser?.full_name ?? deleteUser?.email}
            </p>
            <p className="text-xs mt-2 text-destructive">
              This will delete the user account and all their custom price records. This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting} className="gap-2">
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : <><Trash2 className="h-4 w-4" /> Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
