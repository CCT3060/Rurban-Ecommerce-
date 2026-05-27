import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getScheduleTimeMs } from "@/lib/utils";

export const metadata = { title: "Offers & Deals" };

type Offer = {
  id: string;
  title: string;
  description: string | null;
  type: "percentage" | "fixed" | "bogo" | "category_discount" | "product_discount";
  value: number;
  status: "active" | "inactive";
  start_date: string;
  end_date: string;
};

function offerValueText(offer: Offer) {
  if (offer.type === "percentage") return `${offer.value}% OFF`;
  if (offer.type === "fixed") return `₹${offer.value} OFF`;
  if (offer.type === "bogo") return "B2G1";
  return offer.type.replace("_", " ").toUpperCase();
}

function offerValidity(offer: Offer) {
  return `Valid till ${new Date(offer.end_date).toLocaleDateString("en-GB")}`;
}

async function getActiveOffers(): Promise<Offer[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("offers")
    .select("id,title,description,type,value,status,start_date,end_date")
    .eq("status", "active")
    .order("is_highlighted", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const now = Date.now();
  return (data as Offer[]).filter((offer) => {
    const start = getScheduleTimeMs(offer.start_date, "start");
    const end = getScheduleTimeMs(offer.end_date, "end");
    return (start === null || now >= start) && (end === null || now <= end);
  });
}

export default async function OffersPage() {
  const offers = await getActiveOffers();

  return (
    <div className="bg-background min-h-screen">
      <div className="bg-gradient-to-br from-cta/10 to-primary/5 py-12 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <Badge className="bg-cta text-white border-0 mb-3">Hot Deals</Badge>
          <h1 className="text-3xl md:text-4xl font-bold">Offers & Deals</h1>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
            Grab the best deals and save big on your favorite products.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 md:py-16">
        {offers.length === 0 ? (
          <div className="rounded-xl border bg-muted/20 p-10 text-center text-muted-foreground">
            No active offers right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {offers.map((offer) => (
              <Card key={offer.id} className="overflow-hidden group hover:shadow-lg transition-shadow border-0">
                <div className="bg-gradient-to-br from-primary to-brand-dark p-6 md:p-8 text-white">
                  <Badge className="bg-white/20 text-white border-0 mb-2">{offerValueText(offer)}</Badge>
                  <h3 className="text-lg font-bold mt-2">{offer.title}</h3>
                  <p className="text-sm text-white/80 mt-1">{offer.description || "Limited-time offer"}</p>
                  <p className="text-xs text-white/60 mt-3">{offerValidity(offer)}</p>
                </div>
                <CardContent className="p-4">
                  <Link href="/">
                    <Button variant="outline" className="w-full gap-2 rounded-full">
                      Shop Now <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
