"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Loader2, CheckCircle2, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal","Delhi","Jammu & Kashmir","Ladakh",
];

const PAYMENT_TERMS = [
  "Advance Payment","Net 15","Net 30","Net 45","Net 60","Due on Receipt",
  "End of Month","Due on Delivery",
];

const GST_TREATMENTS = [
  "Business - Registered","Business - Unregistered","Consumer","Overseas",
  "Special Economic Zone","Deemed Export",
];

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

type FormData = {
  full_name: string; email: string; phone: string; password: string; confirm_password: string;
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
  full_name: "", email: "", phone: "", password: "", confirm_password: "",
  display_name: "", customer_number: "", company_name: "", contact_name: "",
  payment_terms: "Advance Payment", gst_treatment: "Business - Registered", gstin: "",
  billing_attention: "", billing_address: "", billing_street2: "",
  billing_city: "", billing_state: "Maharashtra", billing_country: "India",
  billing_county: "", billing_phone: "",
  shipping_attention: "", shipping_address: "", shipping_street2: "",
  shipping_city: "", shipping_state: "Maharashtra", shipping_country: "India",
  shipping_code: "", shipping_phone: "",
};

function Field({ label, id, required, children }: { label: string; id?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1 pb-0.5 border-b">{children}</h3>;
}

function RegisterForm({ invite }: { invite: string }) {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const setSelect = (key: keyof FormData) => (val: string | null) =>
    setForm((p) => ({ ...p, [key]: val ?? "" }));

  const copyBillingToShipping = () =>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name) { toast.error("Full name is required"); return; }
    if (!form.email) { toast.error("Email is required"); return; }
    if (!form.password || form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (form.password !== form.confirm_password) { toast.error("Passwords do not match"); return; }
    if (!form.company_name) { toast.error("Company name is required"); return; }
    if (form.gstin && !GSTIN_RE.test(form.gstin)) {
      toast.error("Invalid GSTIN format. Please enter a valid 15-character GSTIN (e.g. 22AAAAA0000A1Z5).");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/b2b-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite, ...form }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Registration failed");
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
            <CheckCircle2 className="h-9 w-9 text-green-600" />
          </div>
          <h1 className="text-xl font-bold">Account Created!</h1>
          <p className="text-sm text-muted-foreground">
            Your B2B account has been set up. You can now log in to start placing orders.
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 justify-center mt-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Login <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-1">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Create Your B2B Account</h1>
          <p className="text-sm text-muted-foreground">You have been invited to join as a B2B customer. Fill in your details below.</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">

          {/* Account */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Login Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name" id="full_name" required>
                  <Input id="full_name" value={form.full_name} onChange={set("full_name")} placeholder="Your full name" required />
                </Field>
                <Field label="Phone" id="phone">
                  <Input id="phone" value={form.phone} onChange={set("phone")} placeholder="+91 XXXXX XXXXX" />
                </Field>
                <Field label="Email Address" id="email" required>
                  <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" required />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Password" id="password" required>
                  <div className="relative">
                    <Input
                      id="password" type={showPass ? "text" : "password"}
                      value={form.password} onChange={set("password")}
                      placeholder="Min 6 characters" required className="pr-10"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass((p) => !p)}>
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm Password" id="confirm_password" required>
                  <Input id="confirm_password" type={showPass ? "text" : "password"} value={form.confirm_password} onChange={set("confirm_password")} placeholder="Repeat password" required />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Company */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Company Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Company / Business Name" id="company_name" required>
                  <Input id="company_name" value={form.company_name} onChange={set("company_name")} placeholder="e.g. EK Milky Dairy" required />
                </Field>
                <Field label="Display Name" id="display_name">
                  <Input id="display_name" value={form.display_name} onChange={set("display_name")} placeholder="Name on invoices" />
                </Field>
                <Field label="Contact Person" id="contact_name">
                  <Input id="contact_name" value={form.contact_name} onChange={set("contact_name")} placeholder="Primary contact name" />
                </Field>
                {/* Customer number is auto-generated server-side */}
              </div>
              <SectionTitle>GST &amp; Payment</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="GST Treatment" id="gst_treatment">
                  <Select value={form.gst_treatment} onValueChange={setSelect("gst_treatment")}>
                    <SelectTrigger id="gst_treatment"><SelectValue /></SelectTrigger>
                    <SelectContent>{GST_TREATMENTS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="GSTIN" id="gstin">
                  <Input
                    id="gstin"
                    value={form.gstin}
                    onChange={(e) => {
                      const upper = e.target.value.toUpperCase();
                      setForm((p) => ({ ...p, gstin: upper }));
                    }}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    className={`uppercase ${form.gstin !== "" && !GSTIN_RE.test(form.gstin) ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    aria-invalid={form.gstin !== "" && !GSTIN_RE.test(form.gstin)}
                  />
                  {form.gstin !== "" && !GSTIN_RE.test(form.gstin) && (
                    <p className="text-xs text-red-500 mt-1">⚠ Invalid GSTIN format (expected: 22AAAAA0000A1Z5)</p>
                  )}
                  {form.gstin !== "" && GSTIN_RE.test(form.gstin) && (
                    <p className="text-xs text-green-600 mt-1">✓ Valid GSTIN format</p>
                  )}
                </Field>
                <Field label="Payment Terms" id="payment_terms">
                  <Select value={form.payment_terms} onValueChange={setSelect("payment_terms")}>
                    <SelectTrigger id="payment_terms"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Billing */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Billing Address</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Attention" id="billing_attention">
                  <Input id="billing_attention" value={form.billing_attention} onChange={set("billing_attention")} placeholder="e.g. Accounts Dept" />
                </Field>
                <Field label="Phone" id="billing_phone">
                  <Input id="billing_phone" value={form.billing_phone} onChange={set("billing_phone")} placeholder="Billing contact phone" />
                </Field>
              </div>
              <Field label="Address Line 1" id="billing_address">
                <Input id="billing_address" value={form.billing_address} onChange={set("billing_address")} placeholder="Street address" />
              </Field>
              <Field label="Address Line 2" id="billing_street2">
                <Input id="billing_street2" value={form.billing_street2} onChange={set("billing_street2")} placeholder="Apartment, area, landmark" />
              </Field>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="City" id="billing_city">
                  <Input id="billing_city" value={form.billing_city} onChange={set("billing_city")} placeholder="City" />
                </Field>
                <Field label="State" id="billing_state">
                  <Select value={form.billing_state} onValueChange={setSelect("billing_state")}>
                    <SelectTrigger id="billing_state"><SelectValue placeholder="State" /></SelectTrigger>
                    <SelectContent>{INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="PIN Code" id="billing_county">
                  <Input id="billing_county" value={form.billing_county} onChange={set("billing_county")} placeholder="400001" maxLength={6} />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Shipping */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Shipping Address</CardTitle>
              <Button type="button" variant="link" size="sm" className="text-xs h-auto p-0" onClick={copyBillingToShipping}>
                Same as billing
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Attention" id="shipping_attention">
                  <Input id="shipping_attention" value={form.shipping_attention} onChange={set("shipping_attention")} placeholder="e.g. Warehouse" />
                </Field>
                <Field label="Phone" id="shipping_phone">
                  <Input id="shipping_phone" value={form.shipping_phone} onChange={set("shipping_phone")} placeholder="Delivery contact phone" />
                </Field>
              </div>
              <Field label="Address Line 1" id="shipping_address">
                <Input id="shipping_address" value={form.shipping_address} onChange={set("shipping_address")} placeholder="Street address" />
              </Field>
              <Field label="Address Line 2" id="shipping_street2">
                <Input id="shipping_street2" value={form.shipping_street2} onChange={set("shipping_street2")} placeholder="Apartment, area, landmark" />
              </Field>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="City" id="shipping_city">
                  <Input id="shipping_city" value={form.shipping_city} onChange={set("shipping_city")} placeholder="City" />
                </Field>
                <Field label="State" id="shipping_state">
                  <Select value={form.shipping_state} onValueChange={setSelect("shipping_state")}>
                    <SelectTrigger id="shipping_state"><SelectValue placeholder="State" /></SelectTrigger>
                    <SelectContent>{INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="PIN Code" id="shipping_code">
                  <Input id="shipping_code" value={form.shipping_code} onChange={set("shipping_code")} placeholder="400001" maxLength={6} />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account…</> : "Create My Account"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function RegisterPageInner() {
  const searchParams = useSearchParams();
  const invite = searchParams.get("invite") ?? "";

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-6">
        <div className="text-center max-w-sm">
          <p className="text-lg font-semibold mb-2">Invalid Invite Link</p>
          <p className="text-sm text-muted-foreground">This link is missing the invite token. Please ask your account manager for a new link.</p>
        </div>
      </div>
    );
  }

  return <RegisterForm invite={invite} />;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <RegisterPageInner />
    </Suspense>
  );
}
