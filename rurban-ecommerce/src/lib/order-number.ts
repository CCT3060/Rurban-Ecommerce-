/**
 * Order Number Generator
 *
 * All options stored as JSON in settings key: order_number_config
 *
 * Config shape:
 *   prefix          – e.g. "RIPL-Ecom-MH"
 *   separator       – "-" | "/" | "_" | "."
 *   year_format     – "none" | "YY" | "YYYY" | "FY"  (FY = "26-27")
 *   date_format     – "none" | "YYMMDD" | "MMDD" | "DDMMYY" | "MMYYYY"
 *   sequence_digits – 3 | 4 | 5 | 6
 *   sequence_reset  – "daily" | "monthly" | "yearly" | "never"
 */
import { createAdminClient } from "@/lib/supabase/admin";

export interface OrderNumberConfig {
  prefix: string;
  separator: string;
  year_format: "none" | "YY" | "YYYY" | "FY";
  date_format: "none" | "YYMMDD" | "MMDD" | "DDMMYY" | "MMYYYY";
  sequence_digits: number;
  sequence_reset: "daily" | "monthly" | "yearly" | "never";
}

export const DEFAULT_CONFIG: OrderNumberConfig = {
  prefix: "RIPL-Ecom-MH",
  separator: "-",
  year_format: "YY",
  date_format: "YYMMDD",
  sequence_digits: 5,
  sequence_reset: "daily",
};

export async function getOrderNumberConfig(): Promise<OrderNumberConfig> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: setting } = await admin
    .from("settings")
    .select("value")
    .eq("key", "order_number_config")
    .maybeSingle();
  if (!setting?.value) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(setting.value as string) as Partial<OrderNumberConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function dateParts(now: Date) {
  const yyyy = String(now.getFullYear());
  const yy   = yyyy.slice(-2);
  const mm   = String(now.getMonth() + 1).padStart(2, "0");
  const dd   = String(now.getDate()).padStart(2, "0");
  const fyStart = now.getMonth() >= 3 ? Number(yy) : Number(yy) - 1;
  const fy = `${fyStart}-${String(fyStart + 1).padStart(2, "0")}`;
  return { yyyy, yy, mm, dd, fy };
}

export function buildOrderNumberBase(config: OrderNumberConfig, now: Date): string {
  const sep = config.separator;
  const { yyyy, yy, mm, dd, fy } = dateParts(now);
  const parts: string[] = [config.prefix];
  if (config.year_format === "YY")   parts.push(yy);
  if (config.year_format === "YYYY") parts.push(yyyy);
  if (config.year_format === "FY")   parts.push(fy);
  if (config.date_format === "YYMMDD")  parts.push(`${yy}${mm}${dd}`);
  if (config.date_format === "MMDD")    parts.push(`${mm}${dd}`);
  if (config.date_format === "DDMMYY")  parts.push(`${dd}${mm}${yy}`);
  if (config.date_format === "MMYYYY")  parts.push(`${mm}${yyyy}`);
  return parts.join(sep);
}

function buildPattern(config: OrderNumberConfig, now: Date): string {
  const sep = config.separator;
  const { yyyy, yy, mm, dd, fy } = dateParts(now);
  const parts: string[] = [config.prefix];

  const addYear = () => {
    if (config.year_format === "YY")   parts.push(yy);
    if (config.year_format === "YYYY") parts.push(yyyy);
    if (config.year_format === "FY")   parts.push(fy);
  };

  if (config.sequence_reset === "never") {
    // match all orders with this prefix
  } else if (config.sequence_reset === "yearly") {
    addYear();
  } else if (config.sequence_reset === "monthly") {
    addYear();
    if (config.date_format === "YYMMDD")  parts.push(`${yy}${mm}__`);
    else if (config.date_format === "MMDD")    parts.push(`${mm}__`);
    else if (config.date_format === "DDMMYY")  parts.push(`__${mm}${yy}`);
    else if (config.date_format === "MMYYYY")  parts.push(`${mm}${yyyy}`);
  } else {
    // daily
    addYear();
    if (config.date_format === "YYMMDD")  parts.push(`${yy}${mm}${dd}`);
    else if (config.date_format === "MMDD")    parts.push(`${mm}${dd}`);
    else if (config.date_format === "DDMMYY")  parts.push(`${dd}${mm}${yy}`);
    else if (config.date_format === "MMYYYY")  parts.push(`${mm}${yyyy}`);
  }

  return parts.join(sep) + sep + "%";
}

export async function generateOrderNumber(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const config = await getOrderNumberConfig();
  const now = new Date();

  const pattern = buildPattern(config, now);
  const { data: latest } = await admin
    .from("orders")
    .select("order_number")
    .like("order_number", pattern)
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSeq = 1;
  if (latest?.order_number) {
    const parts = (latest.order_number as string).split(config.separator);
    const last = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(last)) nextSeq = last + 1;
  }

  const base = buildOrderNumberBase(config, now);
  const sequence = String(nextSeq).padStart(config.sequence_digits, "0");
  return `${base}${config.separator}${sequence}`;
}
