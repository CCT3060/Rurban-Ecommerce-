import { Users, Award, Truck, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "About Us" };

export default function AboutPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="bg-gradient-to-br from-primary/10 to-cta/5 py-12 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold">About Rurban</h1>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
            Your one-stop shop for premium products at unbeatable value.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 md:py-16">
        {/* Mission */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            At Rurban Ecommerce, we believe everyone deserves access to premium quality products without breaking the bank. We curate the finest products across electronics, fashion, home essentials, beauty, and more — delivering trust, quality, and value straight to your doorstep.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-16">
          {[
            { icon: Users, value: "50,000+", label: "Happy Customers" },
            { icon: Award, value: "1,000+", label: "Premium Products" },
            { icon: Truck, value: "99%", label: "On-Time Delivery" },
            { icon: Heart, value: "4.8/5", label: "Customer Rating" },
          ].map((stat) => (
            <Card key={stat.label} className="text-center hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <stat.icon className="h-8 w-8 mx-auto text-primary mb-3" />
                <p className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Values */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Why Choose Us?</h2>
          <div className="space-y-6">
            {[
              { title: "Quality First", desc: "We partner with trusted brands and suppliers to ensure every product meets our high quality standards." },
              { title: "Best Prices", desc: "Our direct partnerships and efficient operations allow us to offer competitive prices on all products." },
              { title: "Fast Delivery", desc: "We ship across India with reliable delivery partners to ensure your orders arrive on time." },
              { title: "Easy Returns", desc: "Not satisfied? Our hassle-free 7-day return policy makes it easy to exchange or return products." },
              { title: "Secure Shopping", desc: "Your data and payments are protected with industry-standard security measures." },
            ].map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-sm">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
