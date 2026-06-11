import { NextResponse } from "next/server";
import { requireWarehouseAdminContext } from "@/lib/auth/request-context";
import { createAdminClient } from "@/lib/supabase/admin";

type CsvRow = {
  line: number;
  product_name: string;
  custom_price: string;
  status: string;
};

type ImportResult = {
  total: number;
  created: number;
  updated: number;
  failed: number;
  skipped: number;
  errors: Array<{ line: number; product_name: string; error: string }>;
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const required = ["product_name", "custom_price"];
  for (const col of required) {
    if (!header.includes(col)) throw new Error(`Missing required column: ${col}`);
  }

  const idx = {
    product_name: header.indexOf("product_name"),
    custom_price: header.indexOf("custom_price"),
    status: header.indexOf("status"),
  };

  return lines.slice(1).map((line, i) => {
    const fields = parseCsvLine(line);
    return {
      line: i + 2,
      product_name: (fields[idx.product_name] ?? "").trim(),
      custom_price: (fields[idx.custom_price] ?? "").trim(),
      status: idx.status >= 0 ? (fields[idx.status] ?? "").trim() : "active",
    };
  });
}

export async function POST(request: Request) {
  const auth = await requireWarehouseAdminContext();
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const file = formData.get("file");
  const userId = String(formData.get("user_id") ?? "").trim();
  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  const endDateRaw = String(formData.get("end_date") ?? "").trim();

  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No CSV file uploaded" }, { status: 400 });
  }
  if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
    return NextResponse.json({ error: "File must be a CSV" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File size must be under 5 MB" }, { status: 400 });
  }

  const startDate = startDateRaw || null;
  const endDate = endDateRaw || null;
  if (startDate && endDate && endDate < startDate) {
    return NextResponse.json({ error: "end_date must be after start_date" }, { status: 400 });
  }

  // Verify the user belongs to this warehouse
  const admin = createAdminClient();
  const { data: targetUser } = await admin
    .from("profiles")
    .select("id, email, warehouse_id")
    .eq("id", userId)
    .maybeSingle() as unknown as { data: { id: string; email: string; warehouse_id: string | null } | null };

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (targetUser.warehouse_id !== auth.context.warehouseId) {
    return NextResponse.json({ error: "User does not belong to your warehouse" }, { status: 403 });
  }

  let rows: CsvRow[];
  try {
    const text = await file.text();
    rows = parseCsv(text);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid CSV format" },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV file has no data rows" }, { status: 400 });
  }
  if (rows.length > 5000) {
    return NextResponse.json({ error: "CSV must not exceed 5000 rows" }, { status: 400 });
  }

  // Pre-fetch ALL products for case-insensitive name matching (paginate past Supabase 1000-row limit)
  const allProducts: { id: string; name: string }[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data: page } = await admin
      .from("products")
      .select("id, name")
      .range(from, from + PAGE - 1) as unknown as { data: { id: string; name: string }[] | null };
    if (!page || page.length === 0) break;
    allProducts.push(...page);
    if (page.length < PAGE) break;
  }

  const productByName = new Map(
    allProducts.map((p) => [p.name.toLowerCase().trim(), p.id])
  );

  const result: ImportResult = { total: rows.length, created: 0, updated: 0, failed: 0, skipped: 0, errors: [] };
  const seenProductIds = new Set<string>();

  for (const row of rows) {
    const addError = (error: string) => {
      result.failed++;
      result.errors.push({ line: row.line, product_name: row.product_name, error });
    };

    if (!row.product_name) { addError("product_name is empty"); continue; }

    // Skip rows where price is blank or zero — product will not be added to user's catalogue
    if (!row.custom_price || row.custom_price === "0" || row.custom_price === "0.00") {
      result.skipped++;
      continue;
    }

    const price = Number(row.custom_price);
    if (isNaN(price) || price <= 0) { addError("custom_price must be a positive number"); continue; }

    const rowStatus = row.status === "inactive" ? "inactive" : "active";

    const productId = productByName.get(row.product_name.toLowerCase().trim());
    if (!productId) { addError(`Product not found: "${row.product_name}"`); continue; }

    if (seenProductIds.has(productId)) { addError("Duplicate product in CSV"); continue; }
    seenProductIds.add(productId);

    const { data: existing } = await admin
      .from("user_product_prices")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .maybeSingle() as unknown as { data: { id: string } | null };

    const payload = {
      custom_price: price,
      status: rowStatus,
      ...(startDate !== null ? { start_date: startDate } : {}),
      ...(endDate !== null ? { end_date: endDate } : {}),
    };

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin as any)
        .from("user_product_prices")
        .update(payload)
        .eq("id", existing.id);
      if (error) { addError((error as { message: string }).message); continue; }
      result.updated++;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin as any)
        .from("user_product_prices")
        .insert({ user_id: userId, product_id: productId, ...payload });
      if (error) { addError((error as { message: string }).message); continue; }
      result.created++;
    }
  }

  return NextResponse.json({ data: result });
}
