"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type LookupValue = { id: string; value: string };

function useLookup(type: string) {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    fetch(`/api/lookup/${type}`)
      .then((r) => r.json() as Promise<{ data?: LookupValue[] }>)
      .then((j) => setItems((j.data ?? []).map((d) => d.value)))
      .catch(() => { /* silently use empty list */ });
  }, [type]);
  return items;
}

type FormData = {
  full_name: string; email: string; phone: string; password: string;
  display_name: string; customer_number: string; company_name: string; contact_name: string;
  payment_terms: string; gst_treatment: string; gstin: string;
  billing_attention: string; billing_address: string; billing_street2: string;
  billing_city: string; billing_state: string; billing_country: string;
  billing_county: string; billing_phone: string;
  shipping_attention: string; shipping_address: string; shipping_street2: string;
  shipping_city: string; shipping_state: string; shipping_country: string;
  shipping_code: string; shipping_phone: string;
};

const EMPTY: FormData = {
  full_name: "", email: "", phone: "", password: "",
  display_name: "", customer_number: "", company_name: "", contact_name: "",
  payment_terms: "Advance Payment", gst_treatment: "Business - Registered", gstin: "",
  billing_attention: "", billing_address: "", billing_street2: "",
  billing_city: "", billing_state: "Maharashtra", billing_country: "India",
  billing_county: "", billing_phone: "",
  shipping_attention: "", shipping_address: "", shipping_street2: "",
  shipping_city: "", shipping_state: "Maharashtra", shipping_country: "India",
  shipping_code: "", shipping_phone: "",
};

function Field({ label, id, required, children }: {
  label: string; id?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function WarehouseNewB2BUserPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  const states = useLookup("indian_state");
  const paymentTerms = useLookup("payment_term");
  const gstTreatments = useLookup("gst_treatment");

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const setSelect = (key: keyof FormData) => (val: string | null) =>
    setForm((p) => ({ ...p, [key]: val ?? "" }));

  const copyBillingToShipping = () => {
    setForm((p) => ({
      ...p,
      shipping_attention: p.billing_attention,
      shipping_address: p.billing_address,
      shipping_street2: p.billing_street2,
      shipping_city: p.billing_city,
      shipping_state: p.billing_state,
      shipping_country: p.billing_country,
      shipping_code: p.billing_county,
      shipping_phone: p.billing_phone,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error("Email and password are required"); return; }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/warehouse/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to create user");
      toast.success("B2B user created successfully");
      router.push("/warehouse/b2b-users");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const stateItems = Object.fromEntries(states.map((s) => [s, s]));
  const gstItems = Object.fromEntries(gstTreatments.map((g) => [g, g]));
  const paymentItems = Object.fromEntries(paymentTerms.map((p) => [p, p]));

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add B2B Customer</h1>
          <p className="text-sm text-muted-foreground">Fill in the customer details to create a B2B account</p>
        </div>
      </div>

      {/* ── Section 1: Account Credentials ───────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Account Credentials</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" id="full_name">
            <Input id="full_name" placeholder="Raj Kumar" value={form.full_name} onChange={set("full_name")} />
          </Field>
          <Field label="Email" id="email" required>
            <Input id="email" type="email" placeholder="raj@company.com" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Phone" id="phone">
            <Input id="phone" placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} />
          </Field>
          <Field label="Password" id="password" required>
            <Input id="password" type="password" placeholder="Min 6 characters" value={form.password} onChange={set("password")} />
          </Field>
        </CardContent>
      </Card>

      {/* ── Section 2: Company / Contact Info ────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Company &amp; Contact Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Display Name" id="display_name">
            <Input id="display_name" placeholder="Name shown on invoices" value={form.display_name} onChange={set("display_name")} />
          </Field>
          <Field label="Company Name" id="company_name">
            <Input id="company_name" placeholder="Acme Pvt. Ltd." value={form.company_name} onChange={set("company_name")} />
          </Field>
          <Field label="Contact Name" id="contact_name">
            <Input id="contact_name" placeholder="Primary contact person" value={form.contact_name} onChange={set("contact_name")} />
          </Field>
          <Field label="Customer Number" id="customer_number">
            <Input id="customer_number" placeholder="e.g. CUST-001" value={form.customer_number} onChange={set("customer_number")} />
          </Field>
          <Field label="GST Treatment" id="gst_treatment">
            <Select value={form.gst_treatment} onValueChange={setSelect("gst_treatment")} items={gstItems}>
              <SelectTrigger id="gst_treatment" className="w-full">
                <SelectValue placeholder="Select GST treatment" />
              </SelectTrigger>
              <SelectContent>
                {gstTreatments.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="GST Identification Number (GSTIN)" id="gstin">
            <Input id="gstin" placeholder="27XXXXX0000X1ZX" value={form.gstin} onChange={set("gstin")} className="uppercase" />
          </Field>
          <Field label="Payment Terms" id="payment_terms">
            <Select value={form.payment_terms} onValueChange={setSelect("payment_terms")} items={paymentItems}>
              <SelectTrigger id="payment_terms" className="w-full">
                <SelectValue placeholder="Select payment terms" />
              </SelectTrigger>
              <SelectContent>
                {paymentTerms.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {/* ── Section 3: Billing Address ────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Billing Address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Attention" id="billing_attention">
            <Input id="billing_attention" placeholder="Attn: Finance Dept" value={form.billing_attention} onChange={set("billing_attention")} />
          </Field>
          <Field label="Billing Phone" id="billing_phone">
            <Input id="billing_phone" placeholder="+91 98765 43210" value={form.billing_phone} onChange={set("billing_phone")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address (Street 1)" id="billing_address">
              <Input id="billing_address" placeholder="Building, Street name" value={form.billing_address} onChange={set("billing_address")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address (Street 2)" id="billing_street2">
              <Input id="billing_street2" placeholder="Locality, Landmark" value={form.billing_street2} onChange={set("billing_street2")} />
            </Field>
          </div>
          <Field label="City" id="billing_city">
            <Input id="billing_city" placeholder="Pune" value={form.billing_city} onChange={set("billing_city")} />
          </Field>
          <Field label="State" id="billing_state">
            <Select value={form.billing_state} onValueChange={setSelect("billing_state")} items={stateItems}>
              <SelectTrigger id="billing_state" className="w-full">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {states.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Country" id="billing_country">
            <Input id="billing_country" placeholder="India" value={form.billing_country} onChange={set("billing_country")} />
          </Field>
          <Field label="County / District" id="billing_county">
            <Input id="billing_county" placeholder="e.g. Haveli" value={form.billing_county} onChange={set("billing_county")} />
          </Field>
        </CardContent>
      </Card>

      {/* ── Section 4: Shipping Address ───────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Shipping Address</CardTitle>
            <Button type="button" variant="outline" size="sm" className="gap-2 text-xs" onClick={copyBillingToShipping}>
              <Copy className="h-3.5 w-3.5" /> Same as Billing
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Attention" id="shipping_attention">
            <Input id="shipping_attention" placeholder="Attn: Warehouse" value={form.shipping_attention} onChange={set("shipping_attention")} />
          </Field>
          <Field label="Shipping Phone" id="shipping_phone">
            <Input id="shipping_phone" placeholder="+91 98765 43210" value={form.shipping_phone} onChange={set("shipping_phone")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address (Street 1)" id="shipping_address">
              <Input id="shipping_address" placeholder="Building, Street name" value={form.shipping_address} onChange={set("shipping_address")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address (Street 2)" id="shipping_street2">
              <Input id="shipping_street2" placeholder="Locality, Landmark" value={form.shipping_street2} onChange={set("shipping_street2")} />
            </Field>
          </div>
          <Field label="City" id="shipping_city">
            <Input id="shipping_city" placeholder="Pune" value={form.shipping_city} onChange={set("shipping_city")} />
          </Field>
          <Field label="State" id="shipping_state">
            <Select value={form.shipping_state} onValueChange={setSelect("shipping_state")} items={stateItems}>
              <SelectTrigger id="shipping_state" className="w-full">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {states.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Country" id="shipping_country">
            <Input id="shipping_country" placeholder="India" value={form.shipping_country} onChange={set("shipping_country")} />
          </Field>
          <Field label="Postal / ZIP Code" id="shipping_code">
            <Input id="shipping_code" placeholder="411007" value={form.shipping_code} onChange={set("shipping_code")} />
          </Field>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pb-10">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving} className="gap-2 min-w-[140px]">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create B2B Customer"}
        </Button>
      </div>
    </form>
  );
}
