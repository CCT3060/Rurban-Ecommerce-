"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type ContentPageRow = {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: "active" | "inactive";
  updated_at: string;
};

type SettingRow = {
  id: string;
  key: string;
  value: string;
  type: string;
  group: string;
};

type SocialLinkRow = {
  id: string;
  platform: string;
  url: string;
  icon: string | null;
  sort_order: number;
};

export default function AdminContentPage() {
  const [pages, setPages] = useState<ContentPageRow[]>([]);
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLinkRow[]>([]);

  const [loadingPages, setLoadingPages] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingSocial, setLoadingSocial] = useState(true);

  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState("");
  const [pageSlug, setPageSlug] = useState("");
  const [pageStatus, setPageStatus] = useState<"active" | "inactive">("active");
  const [pageContent, setPageContent] = useState("");

  const [footerDescription, setFooterDescription] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");

  const [socialPlatform, setSocialPlatform] = useState("");
  const [socialUrl, setSocialUrl] = useState("");

  const settingByKey = useMemo(() => {
    const map = new Map<string, SettingRow>();
    for (const setting of settings) map.set(setting.key, setting);
    return map;
  }, [settings]);

  const loadPages = async () => {
    try {
      setLoadingPages(true);
      const response = await fetch("/api/admin/content-pages", { cache: "no-store" });
      const json = (await response.json()) as { data?: ContentPageRow[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to load pages");
      setPages(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load pages");
    } finally {
      setLoadingPages(false);
    }
  };

  const loadSettings = async () => {
    try {
      setLoadingSettings(true);
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      const json = (await response.json()) as { data?: SettingRow[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to load settings");
      const rows = json.data ?? [];
      setSettings(rows);
      const get = (key: string) => rows.find((row) => row.key === key)?.value || "";
      setFooterDescription(get("footer_description"));
      setSupportEmail(get("contact_email"));
      setSupportPhone(get("contact_phone"));
      setContactAddress(get("contact_address"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load settings");
    } finally {
      setLoadingSettings(false);
    }
  };

  const loadSocialLinks = async () => {
    try {
      setLoadingSocial(true);
      const response = await fetch("/api/admin/social-links", { cache: "no-store" });
      const json = (await response.json()) as { data?: SocialLinkRow[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to load social links");
      setSocialLinks(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load social links");
    } finally {
      setLoadingSocial(false);
    }
  };

  useEffect(() => {
    void loadPages();
    void loadSettings();
    void loadSocialLinks();
  }, []);

  const upsertSetting = async (key: string, value: string, type: string, group: string) => {
    const existingId = settingByKey.get(key)?.id;
    if (existingId) {
      const response = await fetch(`/api/admin/settings/${existingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, type, group }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || `Failed to update setting: ${key}`);
      return;
    }

    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, type, group }),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(json.error || `Failed to create setting: ${key}`);
  };

  const saveFooter = async () => {
    try {
      await upsertSetting("footer_description", footerDescription, "text", "content");
      await upsertSetting("contact_email", supportEmail, "text", "contact");
      await upsertSetting("contact_phone", supportPhone, "text", "contact");
      await upsertSetting("contact_address", contactAddress, "text", "contact");
      toast.success("Footer and contact settings updated");
      await loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save footer settings");
    }
  };

  const openCreatePage = () => {
    setEditingPageId(null);
    setPageTitle("");
    setPageSlug("");
    setPageStatus("active");
    setPageContent("");
    setPageDialogOpen(true);
  };

  const openEditPage = (page: ContentPageRow) => {
    setEditingPageId(page.id);
    setPageTitle(page.title);
    setPageSlug(page.slug);
    setPageStatus(page.status);
    setPageContent(page.content);
    setPageDialogOpen(true);
  };

  const savePage = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        title: pageTitle.trim(),
        slug: pageSlug.trim(),
        status: pageStatus,
        content: pageContent,
      };
      const response = await fetch(
        editingPageId ? `/api/admin/content-pages/${editingPageId}` : "/api/admin/content-pages",
        {
          method: editingPageId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to save page");
      toast.success(editingPageId ? "Page updated" : "Page created");
      setPageDialogOpen(false);
      await loadPages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save page");
    }
  };

  const deletePage = async (id: string) => {
    const confirmed = window.confirm("Delete this page?");
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/admin/content-pages/${id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to delete page");
      toast.success("Page deleted");
      await loadPages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete page");
    }
  };

  const addSocialLink = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch("/api/admin/social-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: socialPlatform.trim(),
          url: socialUrl.trim(),
          sort_order: socialLinks.length + 1,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to add social link");
      toast.success("Social link added");
      setSocialPlatform("");
      setSocialUrl("");
      await loadSocialLinks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add social link");
    }
  };

  const deleteSocialLink = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/social-links/${id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to delete social link");
      toast.success("Social link deleted");
      await loadSocialLinks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete social link");
    }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Content Management</h1><p className="text-sm text-muted-foreground">Manage pages, footer, and social links</p></div>

      <Dialog open={pageDialogOpen} onOpenChange={setPageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingPageId ? "Edit Page" : "Add Page"}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={savePage}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Title *</Label><Input required value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label>Slug *</Label><Input required value={pageSlug} onChange={(e) => setPageSlug(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select className="h-9 w-full rounded-lg border border-input px-3 text-sm" value={pageStatus} onChange={(e) => setPageStatus(e.target.value as "active" | "inactive")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="space-y-2"><Label>Content *</Label><Textarea required rows={10} value={pageContent} onChange={(e) => setPageContent(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPageDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="pages">
        <TabsList>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="footer">Footer</TabsTrigger>
          <TabsTrigger value="social">Social Links</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pages</CardTitle>
              <Button size="sm" className="gap-2" onClick={openCreatePage}><Plus className="h-4 w-4" /> Add Page</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Slug</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {loadingPages && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Loading pages...</TableCell></TableRow>
                  )}
                  {!loadingPages && pages.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No pages found.</TableCell></TableRow>
                  )}
                  {!loadingPages && pages.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{p.title}</div></TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">/{p.slug}</TableCell>
                      <TableCell><Badge className={p.status === "active" ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-700 border-0"}>{p.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(p.updated_at).toLocaleDateString("en-GB")}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPage(p)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void deletePage(p.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="footer" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Footer Content</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Footer Description</Label><Textarea rows={3} value={footerDescription} onChange={(e) => setFooterDescription(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Support Email</Label><Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Support Phone</Label><Input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Address</Label><Input value={contactAddress} onChange={(e) => setContactAddress(e.target.value)} /></div>
              <Button onClick={() => void saveFooter()} disabled={loadingSettings}>{loadingSettings ? "Loading..." : "Save Changes"}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Social Media Links</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <form className="grid grid-cols-2 gap-3" onSubmit={addSocialLink}>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Input placeholder="Instagram" value={socialPlatform} onChange={(e) => setSocialPlatform(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input placeholder="https://instagram.com/rurban" value={socialUrl} onChange={(e) => setSocialUrl(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Button type="submit" className="gap-2"><Plus className="h-4 w-4" /> Add Social Link</Button>
                </div>
              </form>

              <div className="space-y-2">
                {loadingSocial && <p className="text-sm text-muted-foreground">Loading social links...</p>}
                {!loadingSocial && socialLinks.length === 0 && <p className="text-sm text-muted-foreground">No social links added.</p>}
                {!loadingSocial && socialLinks.map((row) => (
                  <div key={row.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">{row.platform}</p>
                      <p className="text-xs text-muted-foreground">{row.url}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void deleteSocialLink(row.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
