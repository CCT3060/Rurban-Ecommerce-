import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Contact Us" };

export default function ContactPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="bg-gradient-to-br from-primary/10 to-cta/5 py-12 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold">Contact Us</h1>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
            Have a question or need help? We&apos;d love to hear from you.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact info */}
          <div className="space-y-4">
            {[
              { icon: Mail, title: "Email", detail: "support@rurban.com", sub: "We reply within 24 hours" },
              { icon: Phone, title: "Phone", detail: "+91 123 456 7890", sub: "Mon - Sat, 9 AM - 6 PM IST" },
              { icon: MapPin, title: "Address", detail: "123, Business Park", sub: "Mumbai, Maharashtra 400001" },
              { icon: Clock, title: "Working Hours", detail: "Monday - Saturday", sub: "9:00 AM - 6:00 PM IST" },
            ].map((item) => (
              <Card key={item.title}>
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{item.title}</h3>
                    <p className="text-sm text-foreground mt-0.5">{item.detail}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Contact form */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6 md:p-8">
                <h2 className="text-xl font-bold mb-6">Send us a Message</h2>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Name *</Label><Input required placeholder="Your name" /></div>
                    <div className="space-y-2"><Label>Email *</Label><Input type="email" required placeholder="you@example.com" /></div>
                  </div>
                  <div className="space-y-2"><Label>Subject</Label><Input placeholder="How can we help?" /></div>
                  <div className="space-y-2"><Label>Message *</Label><Textarea required rows={5} placeholder="Your message..." /></div>
                  <Button type="submit" className="rounded-full px-8">Send Message</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
