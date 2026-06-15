"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import Image from "next/image";

/* ─── Types ───────────────────────────────────────────────────────────────── */
type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  variant_info: string | null;
  image_url: string | null;
  hsn_or_sac?: string | null;
  intra_state_tax_rate?: number | null;
  zoho_unit?: string | null;
};

type Address = {
  full_name?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  /* admin-style fallback keys */
  address_line1?: string;
  address_line2?: string;
  pincode?: string;
};

type OrderDetail = {
  id: string;
  order_number: string;
  subtotal: number;
  discount: number;
  tax: number;
  shipping_cost: number;
  total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  shipping_address: Address | null;
  billing_address: Address | null;
  user: { full_name: string | null; email: string | null; phone?: string | null } | null;
  items: OrderItem[];
};

/* ─── Constants ───────────────────────────────────────────────────────────── */
const COMPANY = {
  name: "RURBAN INDIA PRIVATE LIMITED",
  formerly: '"formerly known as Rural Urban Tradelink Pvt. Ltd."',
  address: "Office No 401-402, Yash Tower, D P Road, Opp: D A V Public School, Aundh, Pune - 411007",
  dispatch: "Leelai Park S.N.-42/1, Near, Raghunandan Karyalay,,Dange Chowk,, Pune, Maharashtra - 411033, India",
  gstin: "27AALCR3287Q1ZE",
  fssai: "11522037000299",
  cin: "U51909PN2021PTC204755",
  unit: "MAHARASHTRA",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-indigo-100 text-indigo-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const paymentColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-gray-100 text-gray-700",
};

const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function addrBlock(a: Address | null): string[] {
  if (!a) return [];
  const line1 = a.line1 ?? a.address_line1;
  const line2 = a.line2 ?? a.address_line2;
  const pincode = a.postal_code ?? a.pincode;
  return [
    a.full_name,
    line1,
    line2,
    [a.city, a.state, pincode].filter(Boolean).join(" "),
    a.country,
    a.phone ? `Ph: ${a.phone}` : null,
  ].filter(Boolean) as string[];
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function WarehouseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/warehouse/orders/${id}`);
      const json = (await res.json()) as { data?: OrderDetail; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load order");
      setOrder(json.data ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchOrder(); }, [id]);

  const updateStatus = async (newStatus: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/warehouse/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to update status");
      toast.success("Order status updated");
      await fetchOrder();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground text-sm">Loading order…</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-muted-foreground">Order not found.</p>
        <Button variant="outline" onClick={() => router.back()}>Go back</Button>
      </div>
    );
  }

  const orderDate = new Date(order.created_at);
  const customerName = order.user?.full_name ?? order.shipping_address?.full_name ?? "Customer";
  const customerEmail = order.user?.email ?? "";
  const customerPhone = order.user?.phone ?? "";
  const deliverLines = addrBlock(order.shipping_address);

  // Tax breakdown grouped by rate
  const taxGroups = new Map<number, { cgst: number; sgst: number }>();
  order.items.forEach((item) => {
    const rate = item.intra_state_tax_rate ?? 0;
    const lineTotal = Number(item.price) * item.quantity;
    const existing = taxGroups.get(rate) ?? { cgst: 0, sgst: 0 };
    taxGroups.set(rate, {
      cgst: existing.cgst + (lineTotal * rate) / 100,
      sgst: existing.sgst + (lineTotal * rate) / 100,
    });
  });

  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <>
      {/* ── Screen-only toolbar ──────────────────────────────────── */}
      <div className="no-print mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Order {order.order_number}</h1>
            <p className="text-xs text-muted-foreground">
              Placed on {orderDate.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pl-11 sm:pl-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={updating}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm hover:bg-accent disabled:opacity-50"
            >
              <Badge className={`border-0 pointer-events-none ${statusColors[order.status]}`}>{order.status}</Badge>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {STATUS_FLOW.map((s) => (
                <DropdownMenuItem key={s} disabled={s === order.status} onClick={() => void updateStatus(s)}>
                  <Badge className={`border-0 mr-2 ${statusColors[s]}`}>{s}</Badge>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Badge className={`border-0 ${paymentColors[order.payment_status]}`}>{order.payment_status}</Badge>
          <Button variant="default" size="sm" className="gap-2" onClick={() => window.print()}>
            <Download className="h-3.5 w-3.5" /> Export PDF
          </Button>
        </div>
      </div>

      {/* ── PURCHASE ORDER DOCUMENT ──────────────────────────────── */}
      <div className="po-document bg-white text-[#1a1a1a] border border-[#d1d5db] max-w-[900px] mx-auto text-[13px] print:max-w-none print:border-0 print:shadow-none" style={{ fontFamily: "Arial, sans-serif" }}>

        {/* ── SECTION 1: Company header ──────────────────────────── */}
        <div className="flex items-start border-b border-[#d1d5db]">
          <div className="flex items-start gap-3 flex-1 px-5 pt-4 pb-3">
            <div className="shrink-0 w-[72px]">
              <Image
                src="/images/logo.png"
                alt="RURBAN"
                width={72}
                height={72}
                className="object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <div className="leading-snug">
              <p className="font-bold text-[15px]">{COMPANY.name}</p>
              <p className="font-bold text-[12px]">{COMPANY.name}</p>
              <p className="text-[11px]">{COMPANY.formerly}</p>
              <p className="text-[11px]">Dispatched From: {COMPANY.dispatch}</p>
              <p className="text-[11px]">FSSAI NO: {COMPANY.fssai}</p>
              <p className="text-[11px]">GSTIN {COMPANY.gstin}</p>
              <p className="text-[11px] mt-1">UNIT NAME: {COMPANY.unit}</p>
            </div>
          </div>
          <div className="shrink-0 px-5 pt-4 pb-3 flex items-start">
            <p className="text-[32px] font-black tracking-wide text-[#1a1a1a] uppercase leading-none">PURCHASE ORDER</p>
          </div>
        </div>

        {/* ── SECTION 2: Order meta info ─────────────────────────── */}
        <div className="grid grid-cols-2 border-b border-[#d1d5db]">
          <div className="px-5 py-2 border-r border-[#d1d5db] space-y-[3px]">
            <div className="flex gap-1 text-[11px]">
              <span className="font-semibold w-[110px] shrink-0">Purchase Order# </span>
              <span>: <strong>{order.order_number}</strong></span>
            </div>
            <div className="flex gap-1 text-[11px]">
              <span className="font-semibold w-[110px] shrink-0">Date </span>
              <span>: {orderDate.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
            </div>
            <div className="flex gap-1 text-[11px]">
              <span className="font-semibold w-[110px] shrink-0">Terms </span>
              <span>: <strong className="capitalize">{order.payment_method ?? "Advance Payment"}</strong></span>
            </div>
            <div className="flex gap-1 text-[11px]">
              <span className="font-semibold w-[110px] shrink-0">Payment Status </span>
              <span>: <span className="capitalize">{order.payment_status}</span></span>
            </div>
          </div>
          <div className="px-5 py-2 space-y-[3px]">
            <div className="flex gap-1 text-[11px]">
              <span className="font-semibold w-[110px] shrink-0">Place Of Supply </span>
              <span>: Maharashtra (27)</span>
            </div>
            <div className="flex gap-1 text-[11px]">
              <span className="font-semibold w-[110px] shrink-0">Order Status </span>
              <span>: <span className="capitalize">{order.status}</span></span>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: Vendor Address / Deliver To ─────────────── */}
        <div className="grid grid-cols-2 border-b border-[#d1d5db]">
          <div className="px-5 py-[5px] border-r border-[#d1d5db] bg-[#f3f4f6]">
            <p className="font-bold text-[12px]">Vendor Address</p>
          </div>
          <div className="px-5 py-[5px] bg-[#f3f4f6]">
            <p className="font-bold text-[12px]">Deliver To</p>
          </div>
        </div>
        <div className="grid grid-cols-2 border-b border-[#d1d5db]">
          <div className="px-5 py-3 border-r border-[#d1d5db] leading-[1.6] text-[11px]">
            <p className="font-bold text-[12px]">{COMPANY.name}</p>
            <p>{COMPANY.formerly}</p>
            <p>Dispatched From: {COMPANY.dispatch}</p>
            <p>FSSAI NO: {COMPANY.fssai}</p>
            <p>GSTIN {COMPANY.gstin}</p>
            <p className="mt-1">UNIT NAME: {COMPANY.unit}</p>
          </div>
          <div className="px-5 py-3 leading-[1.6] text-[11px]">
            <p className="font-bold text-[12px]">{customerName}</p>
            {customerEmail && <p>{customerEmail}</p>}
            {customerPhone && <p>{customerPhone}</p>}
            {order.billing_address && addrBlock(order.billing_address).slice(1).map((l, i) => (
              <p key={i}>{l}</p>
            ))}
            {deliverLines.length > 0 && (
              <>
                <p className="mt-2 font-semibold">Delivery Address:</p>
                {deliverLines.map((l, i) => <p key={i}>{l}</p>)}
              </>
            )}
          </div>
        </div>

        {/* ── SECTION 4: Items Table ──────────────────────────────── */}
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr style={{ backgroundColor: "#4b5563", color: "#fff" }}>
              <th className="border border-[#6b7280] px-2 py-[6px] text-center font-semibold w-7">#</th>
              <th className="border border-[#6b7280] px-2 py-[6px] text-left font-semibold">Item &amp; Description</th>
              <th className="border border-[#6b7280] px-2 py-[6px] text-center font-semibold">HSN/SAC</th>
              <th className="border border-[#6b7280] px-2 py-[6px] text-center font-semibold">Qty</th>
              <th className="border border-[#6b7280] px-2 py-[6px] text-right font-semibold">Rate</th>
              <th className="border border-[#6b7280] px-2 py-[6px] text-center font-semibold">CGST</th>
              <th className="border border-[#6b7280] px-2 py-[6px] text-center font-semibold">SGST</th>
              <th className="border border-[#6b7280] px-2 py-[6px] text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => {
              const lineAmt = Number(item.price) * item.quantity;
              const taxRate = item.intra_state_tax_rate ?? 0;
              return (
                <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                  <td className="border border-[#e5e7eb] px-2 py-[5px] text-center">{idx + 1}</td>
                  <td className="border border-[#e5e7eb] px-2 py-[5px]">
                    <span style={{ color: "#2563eb" }} className="font-medium">{item.name}</span>
                    {item.variant_info && <span className="text-gray-500 ml-1">({item.variant_info})</span>}
                  </td>
                  <td className="border border-[#e5e7eb] px-2 py-[5px] text-center">{item.hsn_or_sac ?? "—"}</td>
                  <td className="border border-[#e5e7eb] px-2 py-[5px] text-center">
                    {item.quantity}.000
                    {item.zoho_unit && <><br /><span className="text-gray-500">{item.zoho_unit}</span></>}
                  </td>
                  <td className="border border-[#e5e7eb] px-2 py-[5px] text-right font-mono">{fmt(Number(item.price))}</td>
                  <td className="border border-[#e5e7eb] px-2 py-[5px] text-center">{taxRate}%</td>
                  <td className="border border-[#e5e7eb] px-2 py-[5px] text-center">{taxRate}%</td>
                  <td className="border border-[#e5e7eb] px-2 py-[5px] text-right font-mono">{fmt(lineAmt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── SECTION 5: Footer — Items total / Tax / Signature ───── */}
        <div className="flex border-t border-[#d1d5db]">
          <div className="flex-1 px-5 py-3 border-r border-[#d1d5db]">
            <p className="font-semibold text-[11px]">Items in Total {totalQty}.000</p>
            {order.notes && (
              <p className="text-[11px] text-gray-600 mt-1">{order.notes}</p>
            )}
            <div className="mt-10">
              <div className="border-t border-[#9ca3af] w-44 pt-1">
                <p className="text-[10px] text-gray-500">Authorized Signature</p>
              </div>
            </div>
          </div>

          <div className="w-[280px] shrink-0">
            <div className="flex justify-between px-4 py-[4px] text-[11px] border-b border-[#e5e7eb]">
              <span>Sub Total</span>
              <span className="font-mono">{fmt(Number(order.subtotal))}</span>
            </div>

            {Array.from(taxGroups.entries()).map(([rate, amounts]) => (
              <React.Fragment key={rate}>
                <div className="flex justify-between px-4 py-[4px] text-[11px] border-b border-[#e5e7eb]">
                  <span>CGST{rate} ({rate}%)</span>
                  <span className="font-mono">{fmt(amounts.cgst)}</span>
                </div>
                <div className="flex justify-between px-4 py-[4px] text-[11px] border-b border-[#e5e7eb]">
                  <span>SGST{rate} ({rate}%)</span>
                  <span className="font-mono">{fmt(amounts.sgst)}</span>
                </div>
              </React.Fragment>
            ))}

            {Number(order.discount) > 0 && (
              <div className="flex justify-between px-4 py-[4px] text-[11px] border-b border-[#e5e7eb]">
                <span>Discount</span>
                <span className="font-mono text-green-700">−{fmt(Number(order.discount))}</span>
              </div>
            )}

            {Number(order.shipping_cost) > 0 && (
              <div className="flex justify-between px-4 py-[4px] text-[11px] border-b border-[#e5e7eb]">
                <span>Shipping</span>
                <span className="font-mono">{fmt(Number(order.shipping_cost))}</span>
              </div>
            )}

            <div className="flex justify-between px-4 py-[6px] text-[13px] font-bold">
              <span>Total</span>
              <span className="font-mono">₹{fmt(Number(order.total))}</span>
            </div>
          </div>
        </div>

        {/* ── SECTION 6: Document footer ─────────────────────────── */}
        <div className="border-t border-[#d1d5db] bg-[#f9fafb] px-5 py-2 text-center text-[10px] text-gray-500">
          Corp Add: {COMPANY.address} &nbsp;|&nbsp; Company ID :: {COMPANY.cin}
        </div>
      </div>
    </>
  );
}

