import Link from "next/link";
import Image from "next/image";
import {
  Globe,
  MessageCircle,
  Camera,
  Play,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { APP_NAME } from "@/lib/constants";

const footerLinks = {
  shop: [
    { label: "All Categories", href: "/categories" },
    { label: "Offers & Deals", href: "/offers" },
  ],
  account: [
    { label: "My Account", href: "/account" },
    { label: "My Orders", href: "/account/orders" },
    { label: "Wishlist", href: "/wishlist" },
    { label: "Cart", href: "/cart" },
    { label: "Addresses", href: "/account/addresses" },
  ],
  company: [
    { label: "About Us", href: "/about" },
    { label: "Contact Us", href: "/contact" },
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms & Conditions", href: "/terms" },
  ],
};

const socialLinks = [
  { icon: Globe, href: "#", label: "Facebook" },
  { icon: MessageCircle, href: "#", label: "Twitter" },
  { icon: Camera, href: "#", label: "Instagram" },
  { icon: Play, href: "#", label: "YouTube" },
];

export default function Footer() {
  return (
    <footer className="bg-foreground text-background/80 mt-auto">

      {/* Main footer */}
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/">
              <Image
                src="/logo.png"
                alt={APP_NAME}
                width={140}
                height={45}
                className="h-9 w-auto brightness-0 invert"
              />
            </Link>
            <p className="mt-4 text-sm text-background/60 leading-relaxed">
              Your one-stop shop for premium products. Quality, style, and value
              — all in one place. We deliver trust and excellence to your
              doorstep.
            </p>
            <div className="mt-5 space-y-2 text-sm">
              <a
                href="mailto:support@rurban.com"
                className="flex items-center gap-2 text-background/60 hover:text-background transition-colors"
              >
                <Mail className="h-4 w-4 shrink-0" /> support@rurban.com
              </a>
              <a
                href="tel:+911234567890"
                className="flex items-center gap-2 text-background/60 hover:text-background transition-colors"
              >
                <Phone className="h-4 w-4 shrink-0" /> +91 123 456 7890
              </a>
              <p className="flex items-start gap-2 text-background/60">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" /> Mumbai,
                Maharashtra, India
              </p>
            </div>
          </div>

          {/* Shop links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-background mb-4">
              Shop
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.shop.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-background/60 hover:text-background transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-background mb-4">
              My Account
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.account.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-background/60 hover:text-background transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-background mb-4">
              Company
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-background/60 hover:text-background transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Separator className="bg-background/10" />

      {/* Bottom bar */}
      <div className="container mx-auto px-4 py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-background/50">
            © {new Date().getFullYear()} {APP_NAME} Ecommerce. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                className="h-8 w-8 rounded-full bg-background/10 flex items-center justify-center text-background/60 hover:bg-primary hover:text-white transition-all"
              >
                <social.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
