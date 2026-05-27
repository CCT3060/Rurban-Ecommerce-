"use client";

import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Info, Loader2, BookOpen, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ZohoStatus {
  configured: boolean;
  connected: boolean | null;
  orgName: string | null;
  region: string;
  error?: string;
}

interface SyncResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  durationMs: number;
  syncedAt?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminZohoPage() {
  const [status, setStatus] = useState<ZohoStatus | null>(null);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Load connection status and last sync result
  const loadData = useCallback(async () => {
    try {
      const [statusRes, syncRes] = await Promise.all([
        fetch("/api/admin/zoho/status", { cache: "no-store" }),
        fetch("/api/admin/zoho/sync", { cache: "no-store" }),
      ]);

      const statusJson = (await statusRes.json()) as { data?: ZohoStatus };
      const syncJson = (await syncRes.json()) as { data?: SyncResult | null };

      setStatus(statusJson.data ?? null);
      setLastSync(syncJson.data ?? null);
    } catch {
      toast.error("Failed to load Zoho status");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Test the connection live
  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/zoho/status?test=1", { cache: "no-store" });
      const json = (await res.json()) as { data?: ZohoStatus };
      setStatus(json.data ?? null);
      if (json.data?.connected) {
        toast.success(`Connected to Zoho Books — ${json.data.orgName ?? "org"}`);
      } else {
        toast.error(`Connection failed: ${json.data?.error ?? "unknown error"}`);
      }
    } catch {
      toast.error("Network error testing connection");
    } finally {
      setTesting(false);
    }
  };

  // Trigger a full sync
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/zoho/sync", { method: "POST" });
      const json = (await res.json()) as { data?: SyncResult; error?: string };

      if (!res.ok) {
        toast.error(json.error ?? "Sync failed");
        return;
      }

      const r = json.data!;
      setLastSync({ ...r, syncedAt: new Date().toISOString() });

      if (r.errors.length === 0) {
        toast.success(
          `Sync complete — ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`
        );
      } else {
        toast.warning(
          `Sync finished with ${r.errors.length} error(s). Check the details below.`
        );
      }
    } catch {
      toast.error("Network error during sync");
    } finally {
      setSyncing(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConfigured = status?.configured ?? false;
  const isConnected = status?.connected ?? null;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Zoho Books Integration</h1>
        <p className="text-muted-foreground mt-1">
          Sync products (items) from your Zoho Books account into the store catalog.
        </p>
      </div>

      {/* Connection status card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Connection Status
            </CardTitle>
            <ConnectionBadge configured={isConfigured} connected={isConnected} />
          </div>
          <CardDescription>
            Credentials are read from environment variables on the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusRow label="ZOHO_CLIENT_ID" ok={isConfigured} />
          <StatusRow label="ZOHO_CLIENT_SECRET" ok={isConfigured} />
          <StatusRow label="ZOHO_REFRESH_TOKEN" ok={isConfigured} />
          <StatusRow label="ZOHO_ORG_ID" ok={isConfigured} />
          <StatusRow
            label={`Region (ZOHO_REGION = "${status?.region ?? "in"}")`}
            ok={true}
          />

          {status?.orgName && (
            <div className="pt-2 text-sm text-muted-foreground">
              Connected to organisation: <span className="font-medium text-foreground">{status.orgName}</span>
            </div>
          )}

          {status?.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {status.error}
            </div>
          )}

          <Separator />

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={!isConfigured || testing}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Test Connection
            </Button>

            {!isConfigured && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0" />
                Add the environment variables below, then redeploy.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manual sync card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Product Sync
          </CardTitle>
          <CardDescription>
            Imports all items from Zoho Books into your product catalog. Existing
            products are matched by SKU or Zoho item ID and updated in place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleSync}
            disabled={!isConfigured || syncing}
            className="gap-2"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncing ? "Syncing…" : "Sync Now"}
          </Button>

          {lastSync && <SyncResultPanel result={lastSync} />}
        </CardContent>
      </Card>

      {/* Setup guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup Guide</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-4">
          <Step n={1} title="Create a Zoho API app">
            Go to{" "}
            <a
              href="https://api-console.zoho.in"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary"
            >
              api-console.zoho.in
            </a>{" "}
            → Server-based Applications → get your <code>Client ID</code> and{" "}
            <code>Client Secret</code>.
          </Step>

          <Step n={2} title="Generate a refresh token">
            Use the Zoho OAuth Playground or the authorization URL below (replace
            values). The scope needed is{" "}
            <code>ZohoBooks.items.READ</code>. Run this once and save the{" "}
            <code>refresh_token</code> — it does not expire.
            <div className="mt-2 rounded bg-muted px-3 py-2 font-mono text-xs break-all leading-relaxed">
              {`https://accounts.zoho.in/oauth/v2/auth`}
              {`?scope=ZohoBooks.items.READ`}
              {`&client_id=YOUR_CLIENT_ID`}
              {`&response_type=code`}
              {`&redirect_uri=https://your-domain.com/oauth/callback`}
              {`&access_type=offline`}
            </div>
          </Step>

          <Step n={3} title="Find your Organisation ID">
            In Zoho Books → Settings → Organisation Profile → the numeric ID in
            the URL or the profile page.
          </Step>

          <Step n={4} title="Add environment variables">
            In your <code>.env.local</code> (local) or Vercel project settings (production):
            <pre className="mt-2 rounded bg-muted p-3 text-xs overflow-x-auto">
{`ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_REFRESH_TOKEN=your_refresh_token
ZOHO_ORG_ID=your_org_id
ZOHO_REGION=in          # in | com | eu | au | jp`}
            </pre>
          </Step>

          <Step n={5} title="Optional: map custom fields">
            In Zoho Books, add custom fields to items for extra data the store
            uses:
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              <li><code>cf_sale_price</code> — sale / discounted price (number)</li>
              <li><code>cf_brand</code> — brand name (text)</li>
              <li><code>cf_category_id</code> — Supabase category UUID (text)</li>
              <li><code>cf_is_featured</code> — boolean</li>
              <li><code>cf_is_trending</code> — boolean</li>
              <li><code>cf_is_new_arrival</code> — boolean</li>
            </ul>
          </Step>

          <Step n={6} title="Enable automatic sync (Vercel Cron)">
            Add a <code>vercel.json</code> at the project root:
            <pre className="mt-2 rounded bg-muted p-3 text-xs overflow-x-auto">
{`{
  "crons": [
    {
      "path": "/api/cron/zoho-sync",
      "schedule": "0 * * * *"
    }
  ]
}`}
            </pre>
            Set <code>CRON_SECRET</code> to a random secret in Vercel
            environment variables — Vercel passes it automatically.
          </Step>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConnectionBadge({
  configured,
  connected,
}: {
  configured: boolean;
  connected: boolean | null;
}) {
  if (!configured) return <Badge variant="secondary">Not Configured</Badge>;
  if (connected === null) return <Badge variant="outline">Configured</Badge>;
  if (connected) return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200">Connected</Badge>;
  return <Badge variant="destructive">Connection Failed</Badge>;
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive shrink-0" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function SyncResultPanel({ result }: { result: SyncResult }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
      {result.syncedAt && (
        <p className="text-xs text-muted-foreground">
          Last synced: {new Date(result.syncedAt).toLocaleString()}
          {" "}({Math.round(result.durationMs / 1000)}s)
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total" value={result.total} />
        <StatTile label="Created" value={result.created} color="emerald" />
        <StatTile label="Updated" value={result.updated} color="blue" />
        <StatTile label="Skipped" value={result.skipped} />
      </div>

      {result.errors.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {result.errors.length} error(s)
          </div>
          <ul className="text-xs text-destructive/80 space-y-0.5 max-h-32 overflow-y-auto">
            {result.errors.map((e, i) => (
              <li key={i} className="font-mono bg-destructive/5 px-2 py-0.5 rounded">
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "emerald" | "blue";
}) {
  const colorClass =
    color === "emerald"
      ? "text-emerald-600"
      : color === "blue"
        ? "text-blue-600"
        : "text-foreground";
  return (
    <div className="rounded-md bg-background border p-3 text-center">
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
        {n}
      </div>
      <div>
        <div className="font-medium mb-1 flex items-center gap-1">
          {title}
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
