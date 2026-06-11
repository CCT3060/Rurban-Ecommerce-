import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();

  // Return JSON instead of a redirect. The client (handleLogout in navbar)
  // awaits this fetch so the browser has already processed the Set-Cookie
  // headers (clearing auth cookies) before navigating to /login.
  // A 302 redirect approach is unreliable because the browser may follow
  // the redirect before processing the Set-Cookie headers on the 302 itself.
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Revoke the session on Supabase's servers (invalidates the refresh token).
  await supabase.auth.signOut();

  // Explicitly delete every Supabase auth cookie. This is a fallback in case
  // signOut() above didn't call setAll() (e.g. token already revoked by the
  // client-side signOut call that may have run before this request).
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name.includes("supabase")) {
      response.cookies.set(cookie.name, "", {
        maxAge: 0,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
  }

  return response;
}
