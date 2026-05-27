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

  const [{ data: profile }, { count: orderCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name,email,phone")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
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
