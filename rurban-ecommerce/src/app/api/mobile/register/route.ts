import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown; full_name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "").trim();
  const fullName = String(body.full_name ?? "").trim();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create user with email already confirmed — no verification email sent
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "Registration failed" }, { status: 400 });
  }

  // Immediately sign in to get a session token
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError || !signIn.session) {
    return NextResponse.json({ error: signInError?.message ?? "Login after registration failed" }, { status: 400 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id,full_name,email,phone,avatar_url,role")
    .eq("id", created.user.id)
    .single();

  return NextResponse.json({
    access_token: signIn.session.access_token,
    refresh_token: signIn.session.refresh_token,
    user: {
      id: created.user.id,
      email: created.user.email ?? email,
      full_name: profile?.full_name ?? fullName,
      phone: profile?.phone ?? "",
      avatar_url: profile?.avatar_url ?? "",
      role: profile?.role ?? "user",
    },
  });
}
