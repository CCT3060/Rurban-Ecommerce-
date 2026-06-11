"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";
  const signedOut = searchParams.get("signedOut") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If the user arrived via sign-out (?signedOut=1), ensure the
  // client-side Supabase session is fully cleared.
  useEffect(() => {
    if (signedOut) {
      const supabase = createClient();
      void supabase.auth.signOut();
    }
  }, [signedOut]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();

      // If already signed in as a different account, sign out first
      const { data: { user: existing } } = await supabase.auth.getUser();
      if (existing) {
        await supabase.auth.signOut();
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.user) {
        toast.error(error?.message ?? "Login failed");
        return;
      }

      toast.success("Logged in successfully!");

      // If the caller specified an explicit redirect (e.g. /warehouse), honour it
      if (redirectTo && redirectTo !== "/") {
        window.location.href = redirectTo;
        return;
      }

      // Otherwise route based on role / user_type
      const role = (data.user.app_metadata?.role ?? data.user.user_metadata?.role) as string | undefined;
      if (role === "admin") {
        window.location.href = "/admin";
        return;
      }
      if (role === "warehouse_admin") {
        window.location.href = "/warehouse";
        return;
      }

      // For regular users, check if they are B2B
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", data.user.id)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userType = (profile as any)?.user_type as string | undefined;
      if (userType === "b2b") {
        window.location.href = "/my-catalogue";
        return;
      }

      window.location.href = "/";
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-4 shadow-lg border-border/50">
      <CardHeader className="text-center space-y-3">
        <Link href="/">
          <Image src="/logo.png" alt="Rurban" width={120} height={40} className="h-9 w-auto mx-auto" />
        </Link>
        <div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="pl-9 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full rounded-full" size="lg" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <Separator className="my-6" />

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create Account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 w-full max-w-md bg-muted rounded-lg mx-4" />}>
      <LoginForm />
    </Suspense>
  );
}
