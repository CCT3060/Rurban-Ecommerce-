import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Rurban Ecommerce — Premium Products, Unbeatable Value",
    template: "%s | Rurban Ecommerce",
  },
  description:
    "Discover premium products at Rurban Ecommerce — your one-stop shop for quality, style, and value. Shop trending products, grab exclusive offers, and enjoy fast delivery.",
  keywords: [
    "ecommerce",
    "online shopping",
    "rurban",
    "premium products",
    "best deals",
  ],
  openGraph: {
    title: "Rurban Ecommerce",
    description: "Premium Products, Unbeatable Value",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased overflow-x-hidden">
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 3000,
          }}
        />
      </body>
    </html>
  );
}
