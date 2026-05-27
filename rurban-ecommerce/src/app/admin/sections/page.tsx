"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type SectionRow = {
  id: string;
  title: string | null;
  subtitle: string | null;
  type: string;
  sort_order: number;
  status: "active" | "inactive";
};

export default function AdminSectionsPage() {
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("");

  const fetchSections = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/sections", { cache: "no-store" });
      const json = (await response.json()) as { data?: SectionRow[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to load sections");
      setSections(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load sections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSections();
  }, []);

  const updateSection = async (id: string, payload: Partial<SectionRow>) => {
    try {
      const response = await fetch(`/api/admin/sections/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to update section");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update section");
      throw error;
    }
  };

  const toggleSection = async (id: string, currentStatus: "active" | "inactive") => {
    await updateSection(id, { status: currentStatus === "active" ? "inactive" : "active" });
    toast.success("Section updated");
    await fetchSections();
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Delete this section?");
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/admin/sections/${id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to delete section");
      toast.success("Section deleted");
      await fetchSections();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete section");
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch("/api/admin/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim() || null,
          type: newType.trim(),
          sort_order: sections.length + 1,
          status: "active",
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to create section");
      toast.success("Section created");
      setDialogOpen(false);
      setNewTitle("");
      setNewType("");
      await fetchSections();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create section");
    }
  };

  const saveLayout = async () => {
    try {
      setSavingOrder(true);
      await Promise.all(
        sections.map((section, index) =>
          updateSection(section.id, { sort_order: index + 1 })
        )
      );
      toast.success("Layout saved");
      await fetchSections();
    } catch {
      // Error handling done in updateSection.
    } finally {
      setSavingOrder(false);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length) return;
    const copy = [...sections];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    setSections(copy);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Homepage Sections</h1>
          <p className="text-sm text-muted-foreground">Enable, disable, and reorder homepage sections</p>
        </div>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Add Section</Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Section</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2"><Label>Title</Label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Section title" /></div>
            <div className="space-y-2"><Label>Type *</Label><Input required value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="hero_slider" /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {loading && <div className="p-8 text-center text-sm text-muted-foreground">Loading sections...</div>}
            {!loading && sections.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No sections found.</div>}
            {!loading && sections.map((section, index) => (
              <div key={section.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                <button type="button" onClick={() => move(index, index - 1)} className="text-xs text-muted-foreground hover:text-foreground">↑</button>
                <button type="button" onClick={() => move(index, index + 1)} className="text-xs text-muted-foreground hover:text-foreground">↓</button>
                <span className="text-sm font-mono text-muted-foreground w-6">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{section.title || section.type}</p>
                  <p className="text-xs text-muted-foreground">{section.type}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">{section.type}</Badge>
                <Switch
                  checked={section.status === "active"}
                  onCheckedChange={() => void toggleSection(section.id, section.status)}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void handleDelete(section.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void saveLayout()} disabled={savingOrder}>{savingOrder ? "Saving..." : "Save Layout"}</Button>
      </div>
    </div>
  );
}
