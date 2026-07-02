"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  User, Building2, MapPin, Phone, Mail, CreditCard,
  FileText, Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CustomerDetails = {
  display_name: string | null;
  customer_number: string | null;
  company_name: string | null;
  contact_name: string | null;
  payment_terms: string | null;
  gst_treatment: string | null;
  gstin: string | null;
  billing_attention: string | null;
  billing_address: string | null;
  billing_street2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_country: string | null;
  billing_county: string | null;
  billing_phone: string | null;
  shipping_attention: string | null;
  shipping_address: string | null;
  shipping_street2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_country: string | null;
  shipping_code: string | null;
  shipping_phone: string | null;
};

type CustomerData = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  details: CustomerDetails | null;
};

function formatAddress(
  attention: string | null,
  address: string | null,
  street2: string | null,
  city: string | null,
  state: string | null,
  country: string | null,
  zip?: string | null
): string {
  return [attention, address, street2, city, state, zip, country]
    .filter(Boolean)
    .join(", ");
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground min-w-[140px]">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function CustomerDetailsPage() {
  const params = useParams<{ token: string }>();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/b2b-customer/${params.token}`)
      .then((r) => r.json() as Promise<{ data?: CustomerData; error?: string }>)
      .then((j) => {
        if (j.error) setError(j.error);
        else setCustomer(j.data ?? null);
      })
      .catch(() => setError("Failed to load details"))
      .finally(() => setLoading(false));
  }, [params.token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">Loading your details...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-6">
        <div className="text-center max-w-sm">
          <p className="text-lg font-semibold mb-2">Link Invalid or Expired</p>
          <p className="text-sm text-muted-foreground">{error ?? "This customer link is not valid."}</p>
        </div>
      </div>
    );
  }

  const d = customer.details;
  const billingAddress = d
    ? formatAddress(d.billing_attention, d.billing_address, d.billing_street2, d.billing_city, d.billing_state, d.billing_country)
    : null;
  const shippingAddress = d
    ? formatAddress(d.shipping_attention, d.shipping_address, d.shipping_street2, d.shipping_city, d.shipping_state, d.shipping_country, d.shipping_code)
    : null;

  return (
    <div className="min-h-screen bg-muted/20 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">
            {d?.display_name ?? customer.full_name ?? "Your Account"}
          </h1>
          {d?.company_name && (
            <p className="text-muted-foreground text-sm">{d.company_name}</p>
          )}
          <div className="flex items-center justify-center gap-2">
            <Badge className={customer.is_active ? "bg-green-100 text-green-700 border-0" : "bg-gray-100 text-gray-700 border-0"}>
              {customer.is_active ? "Active Account" : "Inactive"}
            </Badge>
            <Badge className="bg-blue-100 text-blue-700 border-0">B2B Customer</Badge>
          </div>
        </div>

        {/* Account Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" /> Account Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Name" value={customer.full_name} />
            <InfoRow label="Email" value={customer.email} />
            <InfoRow label="Phone" value={customer.phone} />
            {d?.customer_number && <InfoRow label="Ecom Customer No." value={d.customer_number} />}
            <InfoRow
              label="Member Since"
              value={new Date(customer.created_at).toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric",
              })}
            />
          </CardContent>
        </Card>

        {/* Company / Tax Details */}
        {d && (d.company_name || d.gstin || d.gst_treatment || d.payment_terms) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Company &amp; Tax Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Contact Person" value={d.contact_name} />
              <InfoRow label="Company" value={d.company_name} />
              <InfoRow label="GST Treatment" value={d.gst_treatment} />
              <InfoRow label="GSTIN" value={d.gstin} />
              <InfoRow label="Payment Terms" value={d.payment_terms} />
            </CardContent>
          </Card>
        )}

        {/* Billing Address */}
        {billingAddress && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Billing Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{billingAddress}</p>
              {d?.billing_phone && (
                <p className="text-sm mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {d.billing_phone}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Shipping Address */}
        {shippingAddress && shippingAddress !== billingAddress && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" /> Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{shippingAddress}</p>
              {d?.shipping_phone && (
                <p className="text-sm mt-1.5 flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {d.shipping_phone}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Login prompt */}
        <div className="rounded-lg border bg-card p-5 text-center space-y-2">
          <Mail className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Ready to start ordering?</p>
          <p className="text-xs text-muted-foreground">
            Log in with your email <strong>{customer.email}</strong> and the password shared with you.
          </p>
          <a
            href="/login"
            className="inline-flex items-center justify-center mt-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <FileText className="mr-2 h-4 w-4" /> Go to Login
          </a>
        </div>

      </div>
    </div>
  );
}
