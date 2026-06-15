"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Loader2, MapPin, CreditCard, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type LookupValue = { id: string; value: string; sort_order: number; is_active: boolean };

type MasterSection = {
  type: string;
  title: string;
  description: string;
  icon: React.ElementType;
  placeholder: string;
};

const SECTIONS: MasterSection[] = [
  {
    type: "indian_state",
    title: "States / UTs",
    description: "States and Union Territories shown in address dropdowns",
    icon: MapPin,
    placeholder: "e.g. Karnataka",
  },
  {
    type: "payment_term",
    title: "Payment Terms",
    description: "Payment terms shown when creating B2B customers",
    icon: CreditCard,
    placeholder: "e.g. Net 90",
  },
  {
    type: "gst_treatment",
    title: "GST Treatments",
    description: "GST treatment options shown when creating B2B customers",
    icon: Tag,
    placeholder: "e.g. SEZ Developer",
  },
];

function MasterCard({ section }: { section: MasterSection }) {
  const [items, setItems] = useState<LookupValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteItem, setDeleteItem] = useState<LookupValue | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.fetch(`/api/admin/masters/${section.type}`);
      const json = (await res.json()) as { data?: LookupValue[] };
      setItems(json.data ?? []);
    } catch {
      toast.error(`Failed to load ${section.title}`);
    } finally {
      setLoading(false);
    }
  }, [section.type]);

  useEffect(() => { void fetch(); }, [fetch]);

  const handleAdd = async () => {
    const val = newValue.trim();
    if (!val) return;
    setAdding(true);
    try {
      const res = await window.fetch(`/api/admin/masters/${section.type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: val }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to add");
      toast.success(`"${val}" added`);
      setNewValue("");
      await fetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await window.fetch(`/api/admin/masters/${section.type}/${deleteItem.id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to delete");
      toast.success(`"${deleteItem.value}" removed`);
      setDeleteItem(null);
      await fetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const Icon = section.icon;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-primary" />
            {section.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{section.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new */}
          <div className="flex gap-2">
            <Input
              placeholder={section.placeholder}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAdd(); } }}
              className="flex-1"
            />
            <Button onClick={() => void handleAdd()} disabled={adding || !newValue.trim()} className="gap-2 shrink-0">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>

          {/* List */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                      No entries yet. Add one above.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && items.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                    <TableCell className="font-medium text-sm">{item.value}</TableCell>
                    <TableCell>
                      <Badge className={item.is_active ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-600 border-0"}>
                        {item.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteItem(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">{items.length} {section.title.toLowerCase()} total</p>
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <Dialog open={!!deleteItem} onOpenChange={(v) => { if (!v) setDeleteItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Entry</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong className="text-foreground">"{deleteItem?.value}"</strong> from {section.title}?
            Existing B2B customers that use this value won't be affected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting} className="gap-2">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminMastersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lookup Masters</h1>
        <p className="text-sm text-muted-foreground">
          Manage dropdown values used across the platform — states, payment terms, and GST treatments.
        </p>
      </div>

      <Tabs defaultValue="indian_state">
        <TabsList className="mb-6">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <TabsTrigger key={section.type} value={section.type} className="gap-2">
                <Icon className="h-4 w-4" />
                {section.title}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {SECTIONS.map((section) => (
          <TabsContent key={section.type} value={section.type}>
            <MasterCard section={section} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
