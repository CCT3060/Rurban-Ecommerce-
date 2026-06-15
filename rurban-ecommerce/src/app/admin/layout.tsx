"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, FolderTree, ImageIcon, TicketPercent,
  ShoppingCart, Users, Star, Settings, Megaphone,
  Menu, PanelLeftClose, PanelLeft,
  Warehouse, BookOpen, Tag, LogOut, Home, UserCheck, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

const sidebarGroups = [
  {
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", href: "/admin/products", icon: Package },
      { label: "Categories", href: "/admin/categories", icon: FolderTree },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Banners", href: "/admin/banners", icon: ImageIcon },
      { label: "Offers", href: "/admin/offers", icon: Megaphone },
      { label: "Coupons", href: "/admin/coupons", icon: TicketPercent },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
      { label: "Customers", href: "/admin/customers", icon: Users },
      { label: "B2B Users", href: "/admin/b2b-users", icon: UserCheck },
      { label: "User Prices", href: "/admin/user-prices", icon: Tag },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Reviews", href: "/admin/reviews", icon: Star },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Warehouses", href: "/admin/warehouses", icon: Warehouse },
      { label: "Lookup Masters", href: "/admin/masters", icon: ListChecks },
      { label: "Zoho Books", href: "/admin/zoho", icon: BookOpen },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="px-3 space-y-5">
      {sidebarGroups.map((group, gi) => (
        <div key={gi}>
          {group.label && !collapsed && (
            <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {group.label}
            </p>
          )}
          {group.label && collapsed && (
            <div className="border-t border-border/50 my-2" />
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/signout";
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div className="min-h-screen bg-muted/20 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r bg-card/80 backdrop-blur transition-all duration-300 sticky top-0 h-screen shrink-0 ${
          collapsed ? "w-[60px]" : "w-60"
        }`}
      >
        {/* Logo area */}
        <div className={`h-14 flex items-center border-b px-3 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <Link href="/admin" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Admin" width={90} height={28} className="h-6 w-auto" />
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-3.5rem)] py-4">
          <SidebarNav collapsed={collapsed} />
        </ScrollArea>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-14 border-b bg-card/80 backdrop-blur flex items-center justify-between px-4 lg:px-5 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent transition-colors"
                aria-label="Open admin menu"
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-60 p-0 bg-card">
                <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
                <div className="h-14 flex items-center border-b px-4">
                  <Image src="/logo.png" alt="Admin" width={90} height={28} className="h-6 w-auto" />
                </div>
                <ScrollArea className="h-[calc(100vh-3.5rem)] py-4">
                  <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
                </ScrollArea>
              </SheetContent>
            </Sheet>
            <span className="text-sm font-semibold text-muted-foreground hidden sm:block">Admin Panel</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground hidden sm:flex">
                <Home className="h-4 w-4" /> View Store
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleSignOut()}
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
              <span className="text-xs font-bold text-primary-foreground">A</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-7 max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
