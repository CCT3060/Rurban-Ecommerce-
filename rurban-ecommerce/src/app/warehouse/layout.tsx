"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Building2, LayoutDashboard, Package, FolderTree, ShoppingCart, Home, LogOut, Tag, UserCheck, UserRound, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const navItems = [
  { label: "Dashboard", href: "/warehouse", icon: LayoutDashboard },
  { label: "Categories", href: "/warehouse/categories", icon: FolderTree },
  { label: "Products", href: "/warehouse/products", icon: Package },
  { label: "Orders", href: "/warehouse/orders", icon: ShoppingCart },
  { label: "Customer", href: "/warehouse/b2b-users", icon: UserCheck },
  { label: "Price List", href: "/warehouse/user-prices", icon: Tag },
  { label: "Profile", href: "/warehouse/profile", icon: UserRound },
];

function SidebarContent({ pathname, onNav, onSignOut }: { pathname: string; onNav?: () => void; onSignOut: () => void }) {
  return (
    <>
      <div className="h-16 flex items-center gap-2 border-b px-4 shrink-0">
        <Building2 className="h-5 w-5 text-primary" />
        <p className="font-semibold">Warehouse Panel</p>
      </div>
      <ScrollArea className="flex-1">
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/warehouse" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNav}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="border-t p-3 space-y-1 shrink-0">
        <Link href="/" onClick={onNav}>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Home className="h-4 w-4" /> View Store
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onSignOut}
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
    </>
  );
}

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // Proceed regardless — cookies may already be expired.
    }
    window.location.replace("/login");
  };

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card sticky top-0 h-screen self-start">
        <SidebarContent pathname={pathname} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 flex flex-col border-r bg-card transition-transform duration-300 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarContent
          pathname={pathname}
          onNav={() => setSidebarOpen(false)}
          onSignOut={handleSignOut}
        />
      </aside>

      <div className="flex-1 min-w-0">
        <header className="h-16 border-b bg-card px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile/tablet only */}
            <button
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold">Warehouse Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button size="sm" variant="outline">Go to Main Admin</Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={handleSignOut} className="text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
