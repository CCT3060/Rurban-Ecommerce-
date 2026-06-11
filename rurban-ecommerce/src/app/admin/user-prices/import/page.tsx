"use client";

import { useRef, useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft, Upload, Download, FileText, AlertCircle,
  CheckCircle, XCircle, Loader2, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ImportError = {
  line: number;
  product_name: string;
  error: string;
};

type ImportResult = {
  total: number;
  created: number;
  updated: number;
  failed: number;
  skipped: number;
  errors: ImportError[];
};

type CustomerRow = { id: string; full_name: string | null; email: string };

// â”€â”€â”€ CSV Sample â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SAMPLE_CSV = `product_name,custom_price,status\nProduct Alpha,299.00,active\nProduct Beta,499.50,active\nProduct Gamma,,active\nProduct Delta,,active\n`;

// Note: Leave custom_price blank to skip a product (it won’t be added to the user’s catalogue)

function downloadSample() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "admin_prices_sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function downloadErrors(errors: ImportError[]) {
  const header = "line,product_name,error\n";
  const rows = errors
    .map((e) => [e.line, `"${e.product_name.replace(/"/g, '""')}"`, `"${e.error.replace(/"/g, '""')}"`].join(","))
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "import_errors.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AdminUserPricesImportContent() {
  const searchParams = useSearchParams();
  const prefilledUserId = searchParams.get("userId") ?? "";

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(prefilledUserId);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  // Load B2B customers
  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/customers?user_type=b2b");
      if (res.ok) {
        const j = (await res.json()) as { data?: CustomerRow[] };
        setCustomers(j.data ?? []);
      }
    })();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setServerError(null);
    setProgress(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".csv")) {
      setFile(f);
      setResult(null);
      setServerError(null);
      setProgress(0);
    } else {
      toast.error("Please drop a CSV file");
    }
  };

  const handleUpload = useCallback(async () => {
    if (!selectedUserId) { toast.error("Please select a customer first"); return; }
    if (!file) { toast.error("Please select a CSV file first"); return; }

    setUploading(true);
    setResult(null);
    setServerError(null);
    setProgress(20);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_id", selectedUserId);
      if (startDate) formData.append("start_date", startDate);
      if (endDate) formData.append("end_date", endDate);

      setProgress(50);
      const res = await fetch("/api/admin/user-prices/import", {
        method: "POST",
        body: formData,
      });
      setProgress(90);

      const json = (await res.json()) as { data?: ImportResult; error?: string };

      if (!res.ok) {
        setServerError(json.error ?? "Upload failed");
        return;
      }

      setResult(json.data ?? null);
      setProgress(100);

      const r = json.data;
      if (r) {
        if (r.failed === 0) {
          toast.success(`Import complete: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped`);
        } else {
          toast.warning(`Import finished with ${r.failed} errors`);
        }
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [selectedUserId, file, startDate, endDate]);

  const resetForm = () => {
    setFile(null);
    setResult(null);
    setServerError(null);
    setProgress(0);
    setStartDate("");
    setEndDate("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const exportAllItems = async () => {
    try {
      toast.info("Fetching all products…");
      const allProducts: { name: string }[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const res = await fetch(`/api/admin/products?page=${Math.floor(from / PAGE) + 1}&limit=${PAGE}`);
        const json = (await res.json()) as { data?: { name: string }[]; total?: number };
        const batch = json.data ?? [];
        allProducts.push(...batch);
        if (allProducts.length >= (json.total ?? 0) || batch.length === 0) break;
      }
      const rows = allProducts.map((p) => `"${p.name.replace(/"/g, '""')}",`).join("\n");
      const csv = `product_name,custom_price,status\n${rows}\n`;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "all_items_template.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${allProducts.length} products as template`);
    } catch {
      toast.error("Export failed");
    }
  };

  const selectedCustomer = customers.find((c) => c.id === selectedUserId) ?? null;

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/user-prices">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Import User Prices via CSV</h1>
          <p className="text-sm text-muted-foreground">
            Bulk-upload custom pricing for a customer using a CSV file.
          </p>
        </div>
      </div>

      {/* Customer selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Select Customer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <Label htmlFor="customer-select" className="mb-1.5 block">Customer (B2B)</Label>
            <Select value={selectedUserId} onValueChange={(v) => setSelectedUserId(v ?? "")}>
              <SelectTrigger id="customer-select">
                <SelectValue placeholder="Choose a customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name ? `${c.full_name} â€” ` : ""}{c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedCustomer && (
            <p className="text-xs text-muted-foreground mt-2">
              Prices will be imported for <strong>{selectedCustomer.full_name ?? selectedCustomer.email}</strong>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            CSV Format
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Your CSV file must include the following columns:
          </p>
          <div className="overflow-x-auto">
            <table className="text-xs font-mono border-collapse w-full">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border px-3 py-1.5 text-left">Column</th>
                  <th className="border border-border px-3 py-1.5 text-left">Required</th>
                  <th className="border border-border px-3 py-1.5 text-left">Description</th>
                  <th className="border border-border px-3 py-1.5 text-left">Example</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-border px-3 py-1.5">product_name</td>
                  <td className="border border-border px-3 py-1.5 text-green-600">Yes</td>
                  <td className="border border-border px-3 py-1.5">Exact product name (case-insensitive)</td>
                  <td className="border border-border px-3 py-1.5">Product Alpha</td>
                </tr>
                <tr className="bg-muted/30">
                  <td className="border border-border px-3 py-1.5">custom_price</td>
                  <td className="border border-border px-3 py-1.5 text-green-600">Yes</td>
                  <td className="border border-border px-3 py-1.5">Custom price (&gt; 0) — leave blank to exclude from catalogue</td>
                  <td className="border border-border px-3 py-1.5">299.00</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-1.5">status</td>
                  <td className="border border-border px-3 py-1.5 text-muted-foreground">No</td>
                  <td className="border border-border px-3 py-1.5">active / inactive (default: active)</td>
                  <td className="border border-border px-3 py-1.5">active</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="text-muted-foreground list-disc list-inside space-y-0.5">
            <li>Rows with a <strong>blank or zero</strong> price are skipped — that product will <strong>not</strong> appear in the user&apos;s catalogue.</li>
            <li>If a record already exists for this customer + product, it will be <strong>updated</strong>.</li>
            <li>Maximum <strong>5,000 rows</strong> and file size <strong>5 MB</strong> per upload.</li>
            <li>Rows with errors are skipped; valid rows are still processed.</li>
          </ul>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" onClick={downloadSample}>
              <Download className="h-4 w-4" /> Download Sample CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void exportAllItems()}>
              <Download className="h-4 w-4" /> Export All Items
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload area */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              file ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            {file ? (
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Drop CSV file here or click to browse</p>
                <p className="text-sm text-muted-foreground mt-0.5">Accepts .csv files up to 5 MB</p>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Optional date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="adm-start">Prices Valid From</Label>
              <input
                id="adm-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adm-end">Prices Valid Until</Label>
              <input
                id="adm-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">Leave blank for no date restriction.</p>

          {uploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Uploading and processing...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {serverError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={() => void handleUpload()}
              disabled={!file || !selectedUserId || uploading}
              className="gap-2"
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                <><Upload className="h-4 w-4" /> Upload &amp; Import</>
              )}
            </Button>
            {file && !uploading && (
              <Button variant="ghost" onClick={resetForm}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import result summary */}
      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {result.failed === 0 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                )}
                Import Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="p-4 bg-muted/40 rounded-lg text-center">
                  <div className="text-2xl font-bold">{result.total}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Rows</div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{result.created}</div>
                  <div className="text-xs text-muted-foreground mt-1">Created</div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{result.updated}</div>
                  <div className="text-xs text-muted-foreground mt-1">Updated</div>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-amber-600">{result.skipped}</div>
                  <div className="text-xs text-muted-foreground mt-1">Skipped (no price)</div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-600">{result.failed}</div>
                  <div className="text-xs text-muted-foreground mt-1">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {result.errors.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Failed Rows ({result.errors.length})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => downloadErrors(result.errors)}
                  >
                    <Download className="h-4 w-4" /> Download Error File
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Line</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((err, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{err.line}</TableCell>
                          <TableCell className="text-sm">{err.product_name || "â€”"}</TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="text-xs font-normal">
                              {err.error}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={resetForm}>
              Import Another File
            </Button>
            <Link href="/admin/user-prices">
              <Button>View All Prices</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUserPricesImportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8"><span className="text-muted-foreground">Loading...</span></div>}>
      <AdminUserPricesImportContent />
    </Suspense>
  );
}
