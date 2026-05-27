"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Ban, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search } from "lucide-react";
import { toast } from "sonner";

type CustomerRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  orders_count: number;
  spent_total: number;
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/customers", { cache: "no-store" });
      const json = (await response.json()) as { data?: CustomerRow[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to load customers");
      setCustomers(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCustomers();
  }, []);

  const filtered = useMemo(
    () =>
      customers.filter((customer) => {
        const query = search.toLowerCase();
        return (
          (customer.full_name || "").toLowerCase().includes(query) ||
          customer.email.toLowerCase().includes(query)
        );
      }),
    [customers, search]
  );

  const setCustomerActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to update customer status");
      toast.success("Customer status updated");
      await fetchCustomers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update customer status");
    }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Customers</h1><p className="text-sm text-muted-foreground">{customers.length} registered users</p></div>
      <Card>
        <div className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customers..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead className="text-center">Orders</TableHead><TableHead className="text-right">Total Spent</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading customers...</TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No customers found.</TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center"><span className="text-sm font-semibold text-primary">{(c.full_name || c.email).charAt(0)}</span></div>
                      <div><p className="text-sm font-medium">{c.full_name || "Customer"}</p><p className="text-xs text-muted-foreground">{c.email}</p></div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{c.phone || "-"}</TableCell>
                  <TableCell className="text-center"><Badge variant="secondary">{c.orders_count}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">₹{Number(c.spent_total).toLocaleString("en-IN")}</TableCell>
                  <TableCell><Badge className={c.is_active ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-700 border-0"}>{c.is_active ? "active" : "inactive"}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(c.created_at).toLocaleDateString("en-GB")}</TableCell>
                  <TableCell>
                    <DropdownMenu><DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {c.is_active ? (
                        <DropdownMenuItem className="text-destructive" onClick={() => void setCustomerActive(c.id, false)}><Ban className="h-4 w-4 mr-2" /> Deactivate</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => void setCustomerActive(c.id, true)}><CheckCircle className="h-4 w-4 mr-2" /> Activate</DropdownMenuItem>
                      )}
                    </DropdownMenuContent></DropdownMenu>
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
