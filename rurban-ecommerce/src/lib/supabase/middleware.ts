import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api");

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — wrapped in try/catch so a Supabase outage
  // doesn't crash the middleware with "TypeError: fetch failed".
  let user: Awaited<
    ReturnType<typeof supabase.auth.getUser>
  >["data"]["user"] = null;

  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // If Supabase is unreachable, treat as unauthenticated and continue.
    return supabaseResponse;
  }

  let profileRole: string | null = null;
  let profileWarehouseId: string | null = null;
  let profileUserType: string | null = null;
  let metadataRole: string | null = null;

  if (user) {
    // Only trust app_metadata — it is set by service role only.
    // user_metadata is user-controlled and must NOT be trusted for role checks.
    metadataRole = (user.app_metadata?.role as string | undefined) ?? null;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role,warehouse_id,user_type")
        .eq("id", user.id)
        .maybeSingle();

      profileRole = (profile?.role as string | undefined) ?? null;
      profileWarehouseId =
        (profile?.warehouse_id as string | null | undefined) ?? null;
      // Prefer DB value; fall back to app_metadata (set reliably at user creation)
      profileUserType =
        (profile?.user_type as string | undefined) ??
        (user.app_metadata?.user_type as string | undefined) ??
        null;
    } catch {
      // Profile fetch failed — rely on metadata role and app_metadata user_type.
      profileUserType = (user.app_metadata?.user_type as string | undefined) ?? null;
    }
  }

  const isAdminRole = profileRole === "admin" || metadataRole === "admin";
  const isWarehouseAdminRole =
    profileRole === "warehouse_admin" || metadataRole === "warehouse_admin";
  const isB2BUser = profileUserType === "b2b" && !isAdminRole && !isWarehouseAdminRole;

  // B2B users are restricted to their catalogue and transactional pages.
  // Block them from all B2C-only shop pages and redirect to /my-catalogue.
  if (isB2BUser && !isApiRoute) {
    const b2cOnlyPrefixes = [
      "/category",
      "/categories",
      "/shop",
      "/search",
      "/offers",
      "/wishlist",
    ];
    const isB2COnly =
      pathname === "/" ||
      b2cOnlyPrefixes.some((p) => pathname.startsWith(p));
    if (isB2COnly) {
      const url = request.nextUrl.clone();
      url.pathname = "/my-catalogue";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const unauthorizedResponse = (redirectTo: string) => {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", redirectTo);
    return NextResponse.redirect(url);
  };

  const forbiddenResponse = (redirectTo?: string) => {
    if (isApiRoute) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    if (redirectTo) {
      url.pathname = "/login";
      url.searchParams.set("redirectTo", redirectTo);
    } else {
      url.pathname = "/";
      url.search = "";
    }
    return NextResponse.redirect(url);
  };

  // Protected routes for authenticated users
  const protectedPaths = ["/account", "/checkout", "/wishlist"];
  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (isProtectedPath && !user) {
    return unauthorizedResponse(pathname);
  }

  const isAdminSurface =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const isWarehouseProductUploadRoute =
    pathname === "/api/admin/uploads/product-image";

  // Admin surfaces protection
  if (isAdminSurface) {
    if (!user) {
      return unauthorizedResponse(
        pathname.startsWith("/api/") ? pathname : "/admin"
      );
    }
    const canWarehouseAdminUploadProducts =
      isWarehouseProductUploadRoute && isWarehouseAdminRole;
    // Warehouse admins may call the zoho-post endpoint (it does its own role check)
    const canWarehouseAdminPostToZoho =
      isWarehouseAdminRole && /^\/api\/admin\/orders\/[^/]+\/zoho-post$/.test(pathname);
    if (!isAdminRole && !canWarehouseAdminUploadProducts && !canWarehouseAdminPostToZoho) {
      return forbiddenResponse();
    }
  }

  const isWarehouseSurface =
    pathname.startsWith("/warehouse") || pathname.startsWith("/api/warehouse");

  // Warehouse surfaces protection
  if (isWarehouseSurface) {
    if (!user) {
      return unauthorizedResponse(
        pathname.startsWith("/api/") ? pathname : "/warehouse"
      );
    }
    // If logged in but not a warehouse admin, redirect to login so the
    // user can sign in with a warehouse-admin account.
    if (!isWarehouseAdminRole) {
      return forbiddenResponse("/warehouse");
    }
    // Warehouse admin without an assigned warehouse — let them in and
    // show them a helpful message on the dashboard.
    if (!profileWarehouseId) {
      return supabaseResponse;
    }
  }

  // Redirect logged-in users away from auth pages to their appropriate dashboard.
  // Exception: if a redirectTo param is present the user may be trying
  // to re-authenticate with a different account, so let them through.
  const authPaths = ["/login", "/signup", "/forgot-password"];
  const isAuthPath = authPaths.some((path) => pathname === path);
  const hasRedirectTo = request.nextUrl.searchParams.has("redirectTo");
  const hasSignedOut = request.nextUrl.searchParams.has("signedOut");
  const redirectToValue = request.nextUrl.searchParams.get("redirectTo");

  if (isAuthPath && user && !hasSignedOut) {
    const url = request.nextUrl.clone();

    // If the caller supplied a ?redirectTo, send them there directly
    // (they're already logged in, no need to show login form)
    if (hasRedirectTo && redirectToValue) {
      url.pathname = redirectToValue;
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Otherwise route to the role-appropriate home
    if (isAdminRole) {
      url.pathname = "/admin";
    } else if (isWarehouseAdminRole) {
      url.pathname = "/warehouse";
    } else {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_type")
          .eq("id", user.id)
          .maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userType = (profile as any)?.user_type as string | undefined;
        url.pathname = userType === "b2b" ? "/my-catalogue" : "/";
      } catch {
        url.pathname = "/";
      }
    }
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
