import Link from "next/link";
import { CheckCircle, Package, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  const orderNumber = order?.trim() || "Processing";

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-16 md:py-24 text-center max-w-lg">
        <div className="h-20 w-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">Order Placed Successfully!</h1>
        <p className="text-muted-foreground mt-3">
          Thank you for your order. We&apos;ll send you a confirmation email shortly.
        </p>
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Order Number</p>
          <p className="text-lg font-bold text-primary">{orderNumber}</p>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/account/orders">
            <Button variant="outline" className="gap-2 rounded-full px-6">
              <Package className="h-4 w-4" /> Track Order
            </Button>
          </Link>
          <Link href="/">
            <Button className="gap-2 rounded-full px-6">
              Continue Shopping <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
