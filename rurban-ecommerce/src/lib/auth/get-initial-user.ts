import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

/**
 * Fetches the currently authenticated user's profile on the server side.
 * Use this in layouts/pages to pass an initialUser prop to the Navbar so
 * the correct user is shown immediately on first render — no client-side
 * session fetch needed.
 */
export async function getInitialUser(): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, avatar_url, role, user_type, is_active")
      .eq("id", user.id)
      .maybeSingle();

    return {
      id: user.id,
      email: user.email ?? "",
      full_name:
        (profile?.full_name as string | null | undefined) ??
        (user.user_metadata?.full_name as string | undefined) ??
        null,
      phone: (profile?.phone as string | null | undefined) ?? null,
      avatar_url: (profile?.avatar_url as string | null | undefined) ?? null,
      role: ((profile?.role as string | undefined) ??
        (user.app_metadata?.role as string | undefined) ??
        (user.user_metadata?.role as string | undefined) ??
        "user") as "user" | "admin" | "warehouse_admin",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user_type: (((profile as any)?.user_type as string | undefined) ?? "b2c") as "b2c" | "b2b",
      is_active: (profile?.is_active as boolean | undefined) ?? true,
      created_at: "",
      updated_at: "",
    };
  } catch {
    return null;
  }
}
