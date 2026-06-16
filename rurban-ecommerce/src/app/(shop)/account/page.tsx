import Link from "next/link";
import { redirect } from "next/navigation";
import { User, Package, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "My Account" };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/account");
  }

  const [{ data: profile }, { count: orderCount }, { data: customerDetails }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name,email,phone,user_type")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("b2b_customer_details")
      .select("display_name,customer_number,company_name,contact_name,payment_terms,gst_treatment,gstin,billing_attention,billing_address,billing_street2,billing_city,billing_state,billing_country,billing_county,billing_phone,shipping_attention,shipping_address,shipping_street2,shipping_city,shipping_state,shipping_country,shipping_code,shipping_phone")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 md:py-12 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">My Account</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your profile, orders, and saved addresses.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span>{" "}
              {profile?.full_name?.trim() || "Not set"}
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span>{" "}
              {profile?.email || user.email || "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Phone:</span>{" "}
              {profile?.phone || "Not set"}
            </p>
            <p>
              <span className="text-muted-foreground">Orders placed:</span>{" "}
              {orderCount ?? 0}
            </p>
          </CardContent>
        </Card>

        {profile?.user_type === "b2b" && customerDetails && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <div className="space-y-1">
                <p><span className="text-muted-foreground">Display Name:</span> {customerDetails.display_name || "-"}</p>
                <p><span className="text-muted-foreground">Customer #:</span> {customerDetails.customer_number || "-"}</p>
                <p><span className="text-muted-foreground">Company:</span> {customerDetails.company_name || "-"}</p>
                <p><span className="text-muted-foreground">Contact:</span> {customerDetails.contact_name || "-"}</p>
                <p><span className="text-muted-foreground">Payment Terms:</span> {customerDetails.payment_terms || "-"}</p>
                <p><span className="text-muted-foreground">GST Treatment:</span> {customerDetails.gst_treatment || "-"}</p>
                <p><span className="text-muted-foreground">GSTIN:</span> {customerDetails.gstin || "-"}</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase text-muted-foreground">Billing Address</p>
                  <p>{customerDetails.billing_attention || "-"}</p>
                  <p>{customerDetails.billing_address || "-"}</p>
                  <p>{customerDetails.billing_street2 || "-"}</p>
                  <p>{customerDetails.billing_city || "-"}, {customerDetails.billing_state || "-"}</p>
                  <p>{customerDetails.billing_country || "-"} {customerDetails.billing_county || ""}</p>
                  <p>{customerDetails.billing_phone || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase text-muted-foreground">Shipping Address</p>
                  <p>{customerDetails.shipping_attention || "-"}</p>
                  <p>{customerDetails.shipping_address || "-"}</p>
                  <p>{customerDetails.shipping_street2 || "-"}</p>
                  <p>{customerDetails.shipping_city || "-"}, {customerDetails.shipping_state || "-"}</p>
                  <p>{customerDetails.shipping_country || "-"} {customerDetails.shipping_code || ""}</p>
                  <p>{customerDetails.shipping_phone || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-semibold">My Orders</p>
                <p className="text-xs text-muted-foreground">Track and review your purchases</p>
              </div>
              <Link href="/account/orders">
                <Button variant="outline" size="sm" className="gap-2">
                  <Package className="h-4 w-4" /> Open
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-semibold">My Addresses</p>
                <p className="text-xs text-muted-foreground">Manage shipping and billing locations</p>
              </div>
              <Link href="/account/addresses">
                <Button variant="outline" size="sm" className="gap-2">
                  <MapPin className="h-4 w-4" /> Open
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="pt-1">
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <User className="h-4 w-4" /> Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
