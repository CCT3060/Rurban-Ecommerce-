"use client";

import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  LogOut,
  Package,
  MapPin,
  LayoutDashboard,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV_LINKS } from "@/lib/constants";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { createClient, resetClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

type NavCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
};

export default function Navbar({ initialUser = null }: { initialUser?: import("@/types").Profile | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<Profile | null>(initialUser);

  // When the server re-renders the layout with a new initialUser (e.g. after
  // client-side navigation to a new layout segment), sync the state.
  useEffect(() => {
    setUser(initialUser ?? null);
  }, [initialUser]);
  const [navCategories, setNavCategories] = useState<NavCategory[]>([]);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [activeParentCategoryId, setActiveParentCategoryId] = useState<string | null>(null);
  const [activeChildCategoryId, setActiveChildCategoryId] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>("Detect location");
  const [locationLoading, setLocationLoading] = useState(false);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const cartItemCount = useCartStore((s) => s.getItemCount());
  const wishlistCount = useWishlistStore((s) => s.items.length);

  const { topLevelCategories, childrenByParentId } = useMemo(() => {
    const top: NavCategory[] = [];
    const childrenMap = new Map<string, NavCategory[]>();

    for (const category of navCategories) {
      if (!category.parent_id) {
        top.push(category);
        continue;
      }

      const children = childrenMap.get(category.parent_id) ?? [];
      children.push(category);
      childrenMap.set(category.parent_id, children);
    }

    return { topLevelCategories: top, childrenByParentId: childrenMap };
  }, [navCategories]);

  const resolvedParentCategoryId =
    topLevelCategories.some((category) => category.id === activeParentCategoryId)
      ? activeParentCategoryId
      : (topLevelCategories[0]?.id ?? null);
  const activeParentCategory =
    topLevelCategories.find((category) => category.id === resolvedParentCategoryId) ?? null;
  const middleColumnCategories = activeParentCategory
    ? (childrenByParentId.get(activeParentCategory.id) ?? [])
    : [];
  const resolvedChildCategoryId =
    middleColumnCategories.some((category) => category.id === activeChildCategoryId)
      ? activeChildCategoryId
      : (middleColumnCategories[0]?.id ?? null);
  const activeMiddleCategory =
    middleColumnCategories.find((category) => category.id === resolvedChildCategoryId) ?? null;
  const rightColumnCategories = activeMiddleCategory
    ? (childrenByParentId.get(activeMiddleCategory.id) ?? [])
    : [];

  const mapAuthUserToProfile = (authUser: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string; role?: string };
    app_metadata?: { [key: string]: unknown };
  }): Profile => {
    const r = authUser.app_metadata?.role ?? authUser.user_metadata?.role ?? "user";
    const ut = (authUser.app_metadata?.user_type as string | undefined) ?? "b2c";
    return {
      id: authUser.id,
      full_name: authUser.user_metadata?.full_name ?? null,
      email: authUser.email ?? "",
      phone: null,
      avatar_url: null,
      role: r as "user" | "admin" | "warehouse_admin",
      user_type: ut as "b2c" | "b2b",
      is_active: true,
      created_at: "",
      updated_at: "",
    };
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadCategories = async () => {
      try {
        const response = await fetch("/api/categories", { cache: "no-store" });
        const json = (await response.json()) as { data?: Array<{ id: string; name: string; slug: string; parent_id: string | null }> };
        if (!mounted || !response.ok) return;
        setNavCategories(json.data ?? []);
      } catch {
        if (!mounted) return;
      }
    };

    void loadCategories();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    // Subscribe to auth state changes for live updates (sign-in / sign-out / token refresh).
    // Skip INITIAL_SESSION — the correct user is already provided via the initialUser prop
    // from the server-side layout, which reads cookies reliably.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;
        // INITIAL_SESSION fires when the subscription is first set up.
        // We already have the correct user from SSR, so skip it.
        if (event === "INITIAL_SESSION") return;
        if (session?.user) {
          const basicProfile = mapAuthUserToProfile(session.user);
          setUser(basicProfile);
          // Refresh user_type from DB on auth state changes
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", session.user.id)
            .single();
          if (mounted && profile) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ut = ((profile as any).user_type as "b2c" | "b2b") ?? "b2c";
            setUser((prev) =>
              prev ? { ...prev, user_type: ut } : null
            );
          }
        } else {
          setUser(null);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationLabel("Geolocation not supported");
      return;
    }
    setLocationLoading(true);
    setLocationLabel("Detecting...");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const json = await res.json() as { address?: { suburb?: string; neighbourhood?: string; city?: string; state?: string } };
          const a = json.address ?? {};
          const label = [a.suburb ?? a.neighbourhood, a.city ?? a.state]
            .filter(Boolean)
            .slice(0, 2)
            .join(", ");
          setLocationLabel(label || "Current Location");
        } catch {
          setLocationLabel("Current Location");
        } finally {
          setLocationLoading(false);
        }
      },
      () => {
        setLocationLabel("Location denied");
        setLocationLoading(false);
      },
      { timeout: 8000 }
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setMobileMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    resetClient();
    setUser(null);
    // Call the server-side signout API which clears the httpOnly session cookies
    // and revokes the token on Supabase's servers. We await the fetch so the
    // browser processes the Set-Cookie (maxAge=0) response headers BEFORE we
    // navigate — this is what the form-submit approach failed to guarantee.
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // If the request fails, proceed anyway — cookies may already be expired
    }
    // Full page navigation so the server re-renders with cleared cookies.
    // replace() avoids pushing a logged-in page onto the history stack.
    window.location.replace("/login");
  };

  const isB2B = user?.user_type === "b2b";

  return (
    <header
      className={`w-full bg-white transition-all sticky top-0 z-50 ${isScrolled ? "shadow-md" : "border-b border-border"}`}
    >
      {/* 1. Top Utility Bar — hidden for B2B users */}
      {!isB2B && (
      <div className="bg-muted/50 text-muted-foreground text-[11px] py-1.5 hidden md:block">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div
            className="flex items-center gap-1 hover:opacity-80 cursor-pointer transition-opacity"
            onClick={detectLocation}
            title="Click to detect your location"
          >
            <span className="flex items-center gap-1 font-medium text-foreground">
              <MapPin className="h-3 w-3 text-primary" />
              Deliver to:{" "}
              <span className="text-primary font-semibold">
                {locationLoading ? "Detecting..." : locationLabel}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/contact" className="hover:underline">
              Customer Service
            </Link>
            <Link href="/account/orders" className="hover:underline">
              Track Order
            </Link>
          </div>
        </div>
      </div>
      )}

      {/* 2. Main Navigation Bar */}
      <div className="container mx-auto px-2 md:px-4 py-2.5 md:py-4">
        <div className="flex items-center justify-between gap-3 lg:gap-8">
          {/* Mobile Menu & Logo */}
          <div className="flex items-center gap-1 md:gap-3 shrink-0">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger className="lg:hidden hover:bg-muted p-1.5 md:p-2 rounded-md transition-colors text-foreground">
                <Menu className="h-5 w-5 md:h-6 md:w-6" />
                <span className="sr-only">Open menu</span>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[300px] p-0 flex flex-col bg-background"
              >
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <div className="p-4 border-b flex items-center justify-between">
                  <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                    <Image
                      src="/logo.png"
                      alt="Rurban"
                      width={120}
                      height={40}
                      className="h-8 w-auto"
                    />
                  </Link>
                </div>
                <div className="p-4 border-b bg-muted/20">
                  <form onSubmit={handleSearch}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search products..."
                        className="pl-9 bg-background h-10 shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </form>
                </div>
                <nav className="flex-1 overflow-y-auto py-2">
                  <div className="px-4 py-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      {isB2B ? "My Account" : "Categories"}
                    </p>
                  </div>
                  {isB2B ? (
                    <>
                      <Link
                        href="/my-catalogue"
                        onClick={() => setMobileMenuOpen(false)}
                        className={
                          "flex px-4 py-3 text-[15px] font-medium hover:bg-accent transition-colors " +
                          (pathname === "/my-catalogue" ? "text-primary bg-primary/5" : "text-foreground")
                        }
                      >
                        My Catalogue
                      </Link>
                      <Link
                        href="/account/orders"
                        onClick={() => setMobileMenuOpen(false)}
                        className={
                          "flex px-4 py-3 text-[15px] font-medium hover:bg-accent transition-colors " +
                          (pathname === "/account/orders" ? "text-primary bg-primary/5" : "text-foreground")
                        }
                      >
                        My Orders
                      </Link>
                      <Link
                        href="/account"
                        onClick={() => setMobileMenuOpen(false)}
                        className={
                          "flex px-4 py-3 text-[15px] font-medium hover:bg-accent transition-colors " +
                          (pathname === "/account" ? "text-primary bg-primary/5" : "text-foreground")
                        }
                      >
                        My Profile
                      </Link>
                    </>
                  ) : (
                    <>
                      {NAV_LINKS.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={
                            "flex px-4 py-3 text-[15px] font-medium hover:bg-accent transition-colors " +
                            (pathname === link.href ? "text-primary bg-primary/5" : "text-foreground")
                          }
                        >
                          {link.label}
                        </Link>
                      ))}
                      {user && user.role === "user" && (
                        <Link
                          href="/my-catalogue"
                          onClick={() => setMobileMenuOpen(false)}
                          className={
                            "flex px-4 py-3 text-[15px] font-medium hover:bg-accent transition-colors " +
                            (pathname === "/my-catalogue" ? "text-primary bg-primary/5" : "text-foreground")
                          }
                        >
                          My Catalogue
                        </Link>
                      )}
                    </>
                  )}
                </nav>
                {/* Mobile Auth Bottom Frame */}
                {user ? (
                  <div className="border-t p-4 space-y-3 bg-muted/10">
                    <p className="text-sm font-medium truncate">
                      Hi, {user.full_name || user.email}
                    </p>
                    <Link
                      href="/account"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start shadow-sm"
                      >
                        <User className="h-4 w-4 mr-2" /> My Profile
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-destructive hover:bg-destructive/10"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4 mr-2" /> Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="border-t p-4 bg-muted/10">
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button className="w-full shadow-sm">
                        Sign In / Register
                      </Button>
                    </Link>
                  </div>
                )}
              </SheetContent>
            </Sheet>

            <Link href="/" className="flex items-center group ml-1 md:ml-0">
              <Image
                src="/logo.png"
                alt="Rurban"
                width={160}
                height={40}
                className="h-7 md:h-10 w-auto group-hover:opacity-90 transition-opacity"
                priority
              />
            </Link>
          </div>

          {/* Large Center Search Bar */}
          <form
            onSubmit={handleSearch}
            className="hidden lg:flex flex-1 max-w-[600px] mx-8"
          >
            <div className="relative w-full flex group">
              <Input
                type="search"
                placeholder="Search for premium products, brands and more..."
                className="w-full h-11 rounded-r-none rounded-l-md bg-muted/30 border-r-0 focus-visible:ring-0 focus-visible:border-primary focus-visible:bg-transparent text-sm px-4 shadow-sm transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button
                type="submit"
                className="h-11 rounded-l-none rounded-r-md px-7 shadow-sm transition-all group-focus-within:bg-primary/90"
              >
                <Search className="h-[18px] w-[18px]" />
                <span className="sr-only">Search</span>
              </Button>
            </div>
          </form>

          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-4 shrink-0">
            {/* Mobile Search Icon */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden rounded-full hover:bg-muted"
              onClick={() => router.push("/search")}
            >
              <Search className="h-[20px] w-[20px] text-foreground/80" />
            </Button>

            {/* Profile Section */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 hover:bg-muted/50 p-1.5 md:px-2 md:py-1.5 rounded-lg transition-colors outline-none">
                  <div className="h-[30px] w-[30px] md:h-[34px] md:w-[34px] rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm border border-primary/20">
                    {(user.full_name || user.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden xl:flex flex-col items-start text-left">
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      Hello,
                    </span>
                    <span className="text-sm font-semibold leading-tight truncate max-w-[120px] text-foreground">
                      {user.full_name?.split(" ")[0] || "User"}
                    </span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 shadow-lg border-border/50"
                >
                  <div className="px-2 py-1.5 mb-1 bg-muted/30 rounded-t-sm">
                    <p className="text-sm font-medium truncate">
                      {user.full_name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                  <DropdownMenuItem className="cursor-pointer py-2">
                    <Link href="/account" className="flex items-center w-full">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />{" "}
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer py-2">
                    <Link
                      href="/account/orders"
                      className="flex items-center w-full"
                    >
                      <Package className="mr-2 h-4 w-4 text-muted-foreground" />{" "}
                      Orders
                    </Link>
                  </DropdownMenuItem>
                  {(user.role === "admin" ||
                    user.role === "warehouse_admin") && (
                    <DropdownMenuItem className="cursor-pointer py-2">
                      <Link
                        href={user.role === "admin" ? "/admin" : "/warehouse"}
                        className="flex items-center w-full"
                      >
                        <LayoutDashboard className="mr-2 h-4 w-4 text-muted-foreground" />{" "}
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:bg-destructive/10 flex items-center w-full cursor-pointer py-2"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href="/login"
                className="hidden md:flex items-center gap-2 hover:bg-muted/50 px-2 py-1.5 rounded-lg transition-colors group"
              >
                <User className="h-6 w-6 text-foreground/70 group-hover:text-primary transition-colors" />
                <div className="flex flex-col items-start leading-none opacity-90 group-hover:opacity-100">
                  <span className="text-[10px] text-muted-foreground">
                    Sign In
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    Account
                  </span>
                </div>
              </Link>
            )}

            {/* Wishlist — hidden for B2B users */}
            {!isB2B && (
            <Link
              href="/wishlist"
              className="relative flex items-center gap-2 hover:bg-muted/50 p-1.5 md:px-2 md:py-1.5 rounded-lg transition-colors group"
            >
              <div className="relative">
                <Heart className="h-6 w-6 text-foreground/70 group-hover:text-red-500 transition-colors" />
                {isClient && wishlistCount > 0 && (
                  <Badge className="absolute -top-1.5 -right-2 h-[18px] min-w-[18px] flex items-center justify-center p-0 text-[10px] font-bold bg-red-500 hover:bg-red-600 border-0 rounded-full shadow-sm animate-in fade-in zoom-in">
                    {wishlistCount > 9 ? "9+" : wishlistCount}
                  </Badge>
                )}
              </div>
              <span className="hidden xl:block text-[13px] font-bold text-foreground opacity-90 group-hover:opacity-100">
                Wishlist
              </span>
            </Link>
            )}

            {/* Cart */}
            <Link
              href="/cart"
              className="relative flex items-center gap-2 hover:bg-muted/50 p-1.5 md:px-2 md:py-1.5 rounded-lg transition-colors group pl-2 md:pl-2 border-l border-border/50 ml-1 md:ml-2"
            >
              <div className="relative">
                <ShoppingCart className="h-6 w-6 text-foreground/70 group-hover:text-primary transition-colors" />
                {isClient && cartItemCount > 0 && (
                  <Badge className="absolute -top-1.5 -right-2 h-[18px] min-w-[18px] flex items-center justify-center p-0 text-[10px] font-bold bg-primary border-0 rounded-full shadow-sm animate-in fade-in zoom-in">
                    {cartItemCount > 9 ? "9+" : cartItemCount}
                  </Badge>
                )}
              </div>
              <div className="hidden xl:flex flex-col items-start leading-none opacity-90 group-hover:opacity-100">
                <span className="text-[10px] text-muted-foreground">My</span>
                <span className="text-[14px] font-bold text-foreground">
                  Cart
                </span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Bottom Strip — B2B: catalogue nav, B2C: category strip + mega menu */}
      {isB2B ? (
        /* B2B simplified nav bar */
        <div className="hidden lg:block bg-[#1878c9] text-white shadow-sm">
          <div className="container mx-auto px-4">
            <nav className="flex items-center gap-2 h-12">
              <Link
                href="/my-catalogue"
                className={`rounded-md px-5 py-2.5 text-[13px] font-semibold text-white/95 transition-colors hover:bg-white/10 ${pathname === "/my-catalogue" ? "bg-white/20" : ""}`}
              >
                My Catalogue
              </Link>
              <Link
                href="/account/orders"
                className={`rounded-md px-5 py-2.5 text-[13px] font-semibold text-white/95 transition-colors hover:bg-white/10 ${pathname === "/account/orders" ? "bg-white/20" : ""}`}
              >
                My Orders
              </Link>
              <Link
                href="/cart"
                className={`rounded-md px-5 py-2.5 text-[13px] font-semibold text-white/95 transition-colors hover:bg-white/10 ${pathname === "/cart" ? "bg-white/20" : ""}`}
              >
                Cart
              </Link>
            </nav>
          </div>
        </div>
      ) : (
      /* B2C full category strip + mega menu */
      <div
        className="relative hidden lg:block bg-[#1878c9] text-white shadow-sm"
        onMouseLeave={() => setIsCategoryMenuOpen(false)}
      >
        <div className="container relative mx-auto px-4">
          <nav className="flex items-center">
            <button
              type="button"
              className="inline-flex h-14 min-w-[250px] items-center gap-3 bg-[#1469af] px-5 text-left transition-colors hover:bg-[#0f5f9f]"
              onMouseEnter={() => setIsCategoryMenuOpen(true)}
              onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
            >
              <Menu className="h-[18px] w-[18px]" />
              <span className="text-sm font-bold tracking-wide leading-none">ALL CATEGORIES</span>
              <ChevronDown
                className={`ml-auto h-4 w-4 transition-transform ${isCategoryMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            <div className="ml-6 flex items-center gap-1 overflow-x-auto py-1 no-scrollbar">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-6 py-3 text-[13px] font-semibold text-white/95 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
              {user && user.role === "user" && (
                <Link
                  href="/my-catalogue"
                  className="rounded-md px-6 py-3 text-[13px] font-semibold text-white/95 transition-colors hover:bg-white/10 hover:text-white"
                >
                  My Catalogue
                </Link>
              )}
            </div>
          </nav>

          {isCategoryMenuOpen && topLevelCategories.length > 0 && (
            <div className="absolute left-4 right-4 top-full z-50 pt-2" onMouseEnter={() => setIsCategoryMenuOpen(true)}>
              <div className="grid grid-cols-[260px_1fr_1fr] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
                <div className="max-h-[530px] overflow-y-auto bg-[#1a1d22] p-3 text-white">
                  {topLevelCategories.map((category) => {
                    const isActive = activeParentCategory?.id === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onMouseEnter={() => setActiveParentCategoryId(category.id)}
                        className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-base font-medium transition-colors ${
                          isActive ? "bg-white/15" : "hover:bg-white/10"
                        }`}
                      >
                        <span className="truncate">{category.name}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="max-h-[530px] overflow-y-auto border-l border-border/40 bg-white p-3">
                  {middleColumnCategories.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No sub categories</p>
                  ) : (
                    middleColumnCategories.map((category) => {
                      const isActive = activeMiddleCategory?.id === category.id;
                      return (
                        <Link
                          key={category.id}
                          href={`/category/${category.slug}`}
                          onMouseEnter={() => setActiveChildCategoryId(category.id)}
                          className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-2.5 text-base font-medium transition-colors ${
                            isActive ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/60"
                          }`}
                        >
                          <span className="truncate">{category.name}</span>
                        </Link>
                      );
                    })
                  )}
                </div>

                <div className="max-h-[530px] overflow-y-auto border-l border-border/40 bg-white p-3">
                  {rightColumnCategories.length > 0 ? (
                    rightColumnCategories.map((category) => (
                      <Link
                        key={category.id}
                        href={`/category/${category.slug}`}
                        className="mb-1 flex w-full items-center rounded-md px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-muted/60"
                      >
                        <span className="truncate">{category.name}</span>
                      </Link>
                    ))
                  ) : activeMiddleCategory ? (
                    <Link
                      href={`/category/${activeMiddleCategory.slug}`}
                      className="mb-1 flex w-full items-center rounded-md bg-muted px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-muted/80"
                    >
                      Shop {activeMiddleCategory.name}
                    </Link>
                  ) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Select a category</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </header>
  );
}
