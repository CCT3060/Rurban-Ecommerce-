"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Package, FolderTree, ShoppingCart, Home, LogOut, Tag, UserCheck, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const navItems = [
  { label: "Dashboard", href: "/warehouse", icon: LayoutDashboard },
  { label: "Categories", href: "/warehouse/categories", icon: FolderTree },
  { label: "Products", href: "/warehouse/products", icon: Package },
  { label: "Orders", href: "/warehouse/orders", icon: ShoppingCart },
  { label: "Customer", href: "/warehouse/b2b-users", icon: UserCheck },
  { label: "User Prices", href: "/warehouse/user-prices", icon: Tag },
];

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<{
    full_name: string | null;
    email: string | null;
    phone: string | null;
    warehouse_name: string | null;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/warehouse/me", { cache: "no-store" });
        if (!response.ok) return;
        const json = (await response.json()) as {
          data?: {
            full_name: string | null;
            email: string | null;
            phone: string | null;
            warehouse_name: string | null;
          };
        };
        setProfile(json.data ?? null);
      } catch {
        // ignore profile card errors to avoid blocking the layout
      }
    })();
  }, []);

  const handleSignOut = () => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/signout";
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card">
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
        <div className="border-t p-3 space-y-3 shrink-0">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Logged in as</p>
            <p className="mt-1 text-sm font-semibold truncate">{profile?.full_name?.trim() || "Warehouse Admin"}</p>
            <p className="text-xs text-muted-foreground truncate">{profile?.warehouse_name || "Assigned warehouse"}</p>
            <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5 truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{profile?.email || "-"}</span>
              </p>
              <p className="flex items-center gap-1.5 truncate">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{profile?.phone || "Not set"}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="border-t p-3 space-y-1 shrink-0">
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Home className="h-4 w-4" /> View Store
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="h-16 border-b bg-card px-4 md:px-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Warehouse Admin</h1>
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
