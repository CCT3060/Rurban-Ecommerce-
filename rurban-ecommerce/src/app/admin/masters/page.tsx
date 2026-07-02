"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Loader2, MapPin, CreditCard, Tag, Hash, Save } from "lucide-react";
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

function OrderNumberCard() {
  type Config = {
    prefix: string;
    separator: string;
    year_format: "none" | "YY" | "YYYY" | "FY";
    date_format: "none" | "YYMMDD" | "MMDD" | "DDMMYY" | "MMYYYY";
    sequence_digits: number;
    sequence_reset: "daily" | "monthly" | "yearly" | "never";
  };

  const DEFAULTS: Config = {
    prefix: "RIPL-Ecom-MH",
    separator: "-",
    year_format: "YY",
    date_format: "YYMMDD",
    sequence_digits: 5,
    sequence_reset: "daily",
  };

  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const json = (await res.json()) as { data?: { key: string; value: string }[] };
        const row = json.data?.find((r) => r.key === "order_number_config");
        if (row?.value) {
          try { setCfg({ ...DEFAULTS, ...(JSON.parse(row.value) as Partial<Config>) }); } catch { /* ignore */ }
        }
      } finally { setLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setCfg(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "order_number_config", value: JSON.stringify(cfg), type: "json", group: "orders" }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Order number config saved");
    } catch { toast.error("Failed to save config"); }
    finally { setSaving(false); }
  };

  // Live preview
  const buildPreview = () => {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const yy   = yyyy.slice(-2);
    const mm   = String(now.getMonth() + 1).padStart(2, "0");
    const dd   = String(now.getDate()).padStart(2, "0");
    const fyStart = now.getMonth() >= 3 ? Number(yy) : Number(yy) - 1;
    const fy = `${fyStart}-${String(fyStart + 1).padStart(2, "0")}`;
    const sep = cfg.separator;
    const parts: string[] = [cfg.prefix];
    if (cfg.year_format === "YY")   parts.push(yy);
    if (cfg.year_format === "YYYY") parts.push(yyyy);
    if (cfg.year_format === "FY")   parts.push(fy);
    if (cfg.date_format === "YYMMDD")  parts.push(`${yy}${mm}${dd}`);
    if (cfg.date_format === "MMDD")    parts.push(`${mm}${dd}`);
    if (cfg.date_format === "DDMMYY")  parts.push(`${dd}${mm}${yy}`);
    if (cfg.date_format === "MMYYYY")  parts.push(`${mm}${yyyy}`);
    parts.push("1".padStart(cfg.sequence_digits, "0"));
    return parts.join(sep);
  };

  const Sel = ({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: { value: string; label: string }[] }) => (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  if (loading) return <Card><CardContent className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Hash className="h-4 w-4 text-muted-foreground" /> Order Number Format
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 max-w-xl">
        {/* Prefix */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Prefix</label>
          <Input value={cfg.prefix} onChange={e => set("prefix", e.target.value)} className="font-mono" placeholder="RIPL-Ecom-MH" />
          <p className="text-xs text-muted-foreground">The fixed text at the start of every order number.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Separator */}
          <Sel label="Separator" value={cfg.separator} onChange={v => set("separator", v)} opts={[
            { value: "-", label: "Hyphen  (-)"},
            { value: "/", label: "Slash   (/)" },
            { value: "_", label: "Underscore (_)" },
            { value: ".", label: "Dot     (.)" },
          ]} />

          {/* Year format */}
          <Sel label="Year Format" value={cfg.year_format} onChange={v => set("year_format", v as Config["year_format"])} opts={[
            { value: "none",  label: "None (skip year)" },
            { value: "YY",   label: "YY  — 26" },
            { value: "YYYY", label: "YYYY — 2026" },
            { value: "FY",   label: "FY  — 26-27 (financial year)" },
          ]} />

          {/* Date format */}
          <Sel label="Date Format" value={cfg.date_format} onChange={v => set("date_format", v as Config["date_format"])} opts={[
            { value: "none",   label: "None (skip date)" },
            { value: "YYMMDD",  label: "YYMMDD — 260702" },
            { value: "MMDD",    label: "MMDD — 0702" },
            { value: "DDMMYY",  label: "DDMMYY — 020726" },
            { value: "MMYYYY",  label: "MMYYYY — 072026" },
          ]} />

          {/* Sequence digits */}
          <Sel label="Sequence Digits" value={String(cfg.sequence_digits)} onChange={v => set("sequence_digits", Number(v))} opts={[
            { value: "3", label: "3 digits — 001" },
            { value: "4", label: "4 digits — 0001" },
            { value: "5", label: "5 digits — 00001" },
            { value: "6", label: "6 digits — 000001" },
          ]} />

          {/* Sequence reset */}
          <Sel label="Sequence Resets" value={cfg.sequence_reset} onChange={v => set("sequence_reset", v as Config["sequence_reset"])} opts={[
            { value: "daily",   label: "Daily (restart each day)" },
            { value: "monthly", label: "Monthly (restart each month)" },
            { value: "yearly",  label: "Yearly (restart each year)" },
            { value: "never",   label: "Never (global counter)" },
          ]} />
        </div>

        {/* Live preview */}
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Live Preview</p>
          <p className="font-mono text-base font-semibold tracking-wide">{buildPreview()}</p>
        </div>

        <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminMastersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Masters</h1>
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
          <TabsTrigger value="order_number" className="gap-2">
            <Hash className="h-4 w-4" />
            Order Number
          </TabsTrigger>
        </TabsList>
        {SECTIONS.map((section) => (
          <TabsContent key={section.type} value={section.type}>
            <MasterCard section={section} />
          </TabsContent>
        ))}
        <TabsContent value="order_number">
          <OrderNumberCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
