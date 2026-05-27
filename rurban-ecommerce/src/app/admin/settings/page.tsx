"use client";

import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type SettingRow = {
  id: string;
  key: string;
  value: string;
  type: string;
  group: string;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [siteName, setSiteName] = useState("");
  const [tagline, setTagline] = useState("");
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [currencySymbol, setCurrencySymbol] = useState("₹");

  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");

  const [freeShippingAbove, setFreeShippingAbove] = useState("999");
  const [flatShippingRate, setFlatShippingRate] = useState("49");
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState("18");

  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaKeywords, setMetaKeywords] = useState("");

  const settingsByKey = useMemo(() => {
    const map = new Map<string, SettingRow>();
    for (const row of settings) map.set(row.key, row);
    return map;
  }, [settings]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      const json = (await response.json()) as { data?: SettingRow[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to load settings");
      const rows = json.data ?? [];
      setSettings(rows);

      const get = (key: string, fallback = "") => rows.find((row) => row.key === key)?.value ?? fallback;
      setSiteName(get("site_name", "Rurban Ecommerce"));
      setTagline(get("site_tagline", "Premium Products, Unbeatable Value"));
      setCurrencyCode(get("currency", "INR"));
      setCurrencySymbol(get("currency_symbol", "₹"));

      setContactEmail(get("contact_email", "support@rurban.com"));
      setContactPhone(get("contact_phone", "+91 123 456 7890"));
      setContactAddress(get("contact_address", "Mumbai, Maharashtra, India"));

      setFreeShippingAbove(get("shipping_free_above", "999"));
      setFlatShippingRate(get("shipping_flat_rate", "49"));
      setTaxRate(get("tax_rate", "18"));
      setTaxEnabled(get("tax_enabled", "true") !== "false");

      setMetaTitle(get("meta_title", ""));
      setMetaDescription(get("meta_description", ""));
      setMetaKeywords(get("meta_keywords", ""));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const upsertSetting = async (key: string, value: string, type: string, group: string) => {
    const existing = settingsByKey.get(key);
    if (existing) {
      const response = await fetch(`/api/admin/settings/${existing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, type, group }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || `Failed to update ${key}`);
      return;
    }

    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, type, group }),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(json.error || `Failed to create ${key}`);
  };

  const saveGeneral = async () => {
    try {
      await upsertSetting("site_name", siteName, "text", "general");
      await upsertSetting("site_tagline", tagline, "text", "general");
      await upsertSetting("currency", currencyCode, "text", "general");
      await upsertSetting("currency_symbol", currencySymbol, "text", "general");
      toast.success("General settings saved");
      await loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    }
  };

  const saveContact = async () => {
    try {
      await upsertSetting("contact_email", contactEmail, "text", "contact");
      await upsertSetting("contact_phone", contactPhone, "text", "contact");
      await upsertSetting("contact_address", contactAddress, "text", "contact");
      toast.success("Contact settings saved");
      await loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    }
  };

  const saveShippingTax = async () => {
    try {
      await upsertSetting("shipping_free_above", freeShippingAbove, "number", "shipping");
      await upsertSetting("shipping_flat_rate", flatShippingRate, "number", "shipping");
      await upsertSetting("tax_enabled", taxEnabled ? "true" : "false", "boolean", "tax");
      await upsertSetting("tax_rate", taxRate, "number", "tax");
      toast.success("Shipping and tax settings saved");
      await loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    }
  };

  const saveSeo = async () => {
    try {
      await upsertSetting("meta_title", metaTitle, "text", "seo");
      await upsertSetting("meta_description", metaDescription, "text", "seo");
      await upsertSetting("meta_keywords", metaKeywords, "text", "seo");
      toast.success("SEO settings saved");
      await loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Settings</h1><p className="text-sm text-muted-foreground">Configure your store settings</p></div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="shipping">Shipping & Tax</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-6">
          <Card>
            <CardHeader><CardTitle>Store Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Site Name</Label><Input value={siteName} onChange={(e) => setSiteName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Tagline</Label><Input value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Currency Code</Label><Input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} /></div>
                <div className="space-y-2"><Label>Currency Symbol</Label><Input value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} /></div>
              </div>
              <Button onClick={() => void saveGeneral()} className="gap-2" disabled={loading}><Save className="h-4 w-4" /> Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Email</Label><Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={contactAddress} onChange={(e) => setContactAddress(e.target.value)} /></div>
              <Button onClick={() => void saveContact()} className="gap-2" disabled={loading}><Save className="h-4 w-4" /> Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipping" className="mt-4 space-y-6">
          <Card>
            <CardHeader><CardTitle>Shipping Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Free Shipping Above (₹)</Label><Input type="number" value={freeShippingAbove} onChange={(e) => setFreeShippingAbove(e.target.value)} /></div>
              <div className="space-y-2"><Label>Flat Shipping Rate (₹)</Label><Input type="number" value={flatShippingRate} onChange={(e) => setFlatShippingRate(e.target.value)} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Tax Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Tax</Label>
                <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
              </div>
              <div className="space-y-2"><Label>GST Rate (%)</Label><Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></div>
              <Button onClick={() => void saveShippingTax()} className="gap-2" disabled={loading}><Save className="h-4 w-4" /> Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="mt-4">
          <Card>
            <CardHeader><CardTitle>SEO Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Meta Title</Label><Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label>Meta Description</Label><Input value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} /></div>
              <div className="space-y-2"><Label>Meta Keywords</Label><Input value={metaKeywords} onChange={(e) => setMetaKeywords(e.target.value)} /></div>
              <Button onClick={() => void saveSeo()} className="gap-2" disabled={loading}><Save className="h-4 w-4" /> Save</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
