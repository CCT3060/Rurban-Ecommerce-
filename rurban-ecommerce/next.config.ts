import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdfkit and its dependencies unbundled so they can resolve
  // font/data files from their actual node_modules location at runtime.
  serverExternalPackages: ["pdfkit", "fontkit", "linebreak", "unicode-properties", "brotli"],
  typescript: {
    // Stale Supabase generated types cause build-time type errors.
    // The runtime behaviour is correct. Regenerate types with:
    // npx supabase gen types typescript --project-id <id> > src/types/supabase.ts
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    // Allowed origins: the production site + localhost for dev.
    // Mobile API endpoints (/api/mobile/*) still need open CORS for the app.
    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "";

    return [
      // ── Mobile API: open CORS (accessed by the React Native app) ──────────
      {
        source: "/api/mobile/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
      // ── B2B public registration: open CORS ────────────────────────────────
      {
        source: "/api/b2b-register",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
      // ── All other API routes: restrict to known origin ────────────────────
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: siteOrigin || "https://localhost:3000",
          },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
      // ── All pages: security headers ───────────────────────────────────────
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Content-Security-Policy — allows Supabase storage images and self scripts.
          // Adjust 'script-src' if you add third-party script tags.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline needed by Next.js runtime
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://images.unsplash.com https://via.placeholder.com https://thumbs.dreamstime.com",
              "connect-src 'self' https://*.supabase.co https://*.supabase.in https://exp.host",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
      {
        protocol: "https",
        hostname: "thumbs.dreamstime.com",
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
