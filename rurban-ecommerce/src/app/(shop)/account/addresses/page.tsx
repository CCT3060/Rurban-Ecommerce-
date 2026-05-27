import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "My Addresses" };

export default async function AccountAddressesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/account/addresses");
  }

  const { data: addresses, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="container mx-auto px-4 py-10 text-sm text-destructive">
        Failed to load your addresses: {error.message}
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 md:py-12 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">My Addresses</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {addresses?.length ?? 0} saved address(es)
            </p>
          </div>
          <Link href="/account">
            <Button variant="outline" size="sm">Back to Account</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saved Addresses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(addresses ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No addresses found. Add one during checkout and it will appear here.
              </p>
            )}

            {(addresses ?? []).map((address) => (
              <div key={address.id} className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{address.label}</p>
                  {address.is_default && (
                    <span className="text-[10px] uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm mt-1">{address.full_name}</p>
                <p className="text-sm text-muted-foreground">{address.phone}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {address.street}, {address.city}, {address.state} {address.zip}, {address.country}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
