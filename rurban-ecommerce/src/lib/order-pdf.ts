/**
 * Generates an Order Summary PDF (matches the admin order page layout)
 * using pdfkit — pure Node.js, no headless browser needed.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfkitModule = require("pdfkit");
// Turbopack/Next.js wraps CJS default exports — handle both shapes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PDFDocument: typeof import("pdfkit") = (pdfkitModule as any).default ?? pdfkitModule;

/* ─── Types ───────────────────────────────────────────────────────────────── */
export interface PdfOrderItem {
  name: string;
  hsn_or_sac?: string | null;
  quantity: number;
  price: number;
  intra_state_tax_rate?: number | null;
  zoho_unit?: string | null;
}

export interface PdfOrderData {
  order_number: string;
  created_at: string;
  notes?: string | null;
  shipping_address?: Record<string, string | undefined | null> | null;
  b2b_payment_terms?: string | null;
  payment_method?: string | null;
  subtotal: number;
  shipping_cost: number;
  discount: number;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  order_items: PdfOrderItem[];
}

/* ─── Constants ───────────────────────────────────────────────────────────── */
const COMPANY = {
  name: "RURBAN INDIA PRIVATE LIMITED",
  dispatch: "Leelai Park S.N.-42/1, Near, Raghunandan Karyalay, Dange Chowk, Pune, Maharashtra - 411033",
  gstin: "27AALCR3287Q1ZE",
  fssai: "11522037000299",
  cin: "U51909PN2021PTC204755",
  unit: "MAHARASHTRA",
};

const COL = {
  dark: "#1a1a1a",
  header: "#4b5563",
  headerText: "#ffffff",
  primary: "#1e3a5f",
  orange: "#ea580c",
  gray: "#6b7280",
  lightGray: "#f3f4f6",
  border: "#d1d5db",
  altRow: "#f9fafb",
};

function fmt(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseDeliveryDate(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = notes.match(/Requested delivery date:\s*(.+)/i);
  return m ? m[1].trim() : null;
}

/* ─── PDF generator ───────────────────────────────────────────────────────── */
export async function generateOrderSummaryPdf(order: PdfOrderData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `Order ${order.order_number}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const M = 36;          // page margin
    const PW = 595.28;     // A4 width
    const CW = PW - M * 2; // content width
    let y = M;

    /* ── helpers ──────────────────────────────────────────────────────────── */
    function line(x1: number, y1: number, x2: number, y2: number, color = COL.border, w = 0.5) {
      doc.save().strokeColor(color).lineWidth(w).moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
    }
    function rect(x: number, ry: number, w: number, h: number, color: string) {
      doc.save().fillColor(color).rect(x, ry, w, h).fill().restore();
    }
    function text(str: string, x: number, ty: number, opts: Record<string, unknown> = {}) {
      doc.text(str, x, ty, opts);
    }

    /* ── 1. HEADER ────────────────────────────────────────────────────────── */
    // Left: company info
    doc.fontSize(11).fillColor(COL.primary).font("Helvetica-Bold");
    text(COMPANY.name, M, y);
    y += 14;
    doc.fontSize(8).fillColor(COL.dark).font("Helvetica-Bold");
    text(COMPANY.name, M, y);
    y += 10;
    doc.font("Helvetica").fillColor(COL.orange).fontSize(7);
    text(`"formerly known as Rural Urban Tradelink Pvt. Ltd."`, M, y);
    y += 10;
    text(`Dispatched From: ${COMPANY.dispatch}`, M, y, { width: CW * 0.55 });
    y += 18;
    text(`FSSAI NO: ${COMPANY.fssai}`, M, y);
    y += 9;
    text(`GSTIN ${COMPANY.gstin}`, M, y);
    y += 9;
    text(`UNIT NAME: ${COMPANY.unit}`, M, y);

    // Right: "ORDER SUMMARY" title
    doc.fontSize(22).font("Helvetica-Bold").fillColor(COL.dark);
    text("ORDER SUMMARY", M + CW * 0.58, M + 8, { width: CW * 0.42, align: "right" });

    y += 14;
    line(M, y, M + CW, y);
    y += 8;

    /* ── 2. ORDER META (2-column) ─────────────────────────────────────────── */
    const orderDate = new Date(order.created_at).toLocaleDateString("en-IN", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
    const deliveryDate = parseDeliveryDate(order.notes);
    const terms = order.b2b_payment_terms ?? order.payment_method ?? "Advance Payment";

    const metaRows: [string, string][] = [
      ["Order Summary", order.order_number],
      ["Date", orderDate],
      ["Terms", terms],
      ["Delivery Date", deliveryDate ?? "—"],
    ];

    const col1X = M;
    const col2X = M + CW / 2 + 8;
    const labelW = 90;
    const startY = y;

    doc.fontSize(8);
    metaRows.forEach(([label, value], i) => {
      const ry = startY + i * 13;
      doc.font("Helvetica-Bold").fillColor(COL.dark);
      text(label, col1X, ry, { width: labelW });
      doc.font("Helvetica").fillColor(COL.dark);
      text(`: ${value}`, col1X + labelW, ry);
    });

    // Right column
    const rightRows: [string, string][] = [
      ["Place Of Supply", "Maharashtra (27)"],
      ["Delivery Date", deliveryDate ?? "—"],
    ];
    rightRows.forEach(([label, value], i) => {
      const ry = startY + i * 13;
      doc.font("Helvetica-Bold").fillColor(COL.dark);
      text(label, col2X, ry, { width: labelW });
      doc.font("Helvetica").fillColor(COL.dark);
      text(`: ${value}`, col2X + labelW, ry);
    });

    y = startY + metaRows.length * 13 + 8;
    line(M, y, M + CW, y);
    y += 8;

    /* ── 3. ADDRESSES ─────────────────────────────────────────────────────── */
    // Section headers
    const halfW = CW / 2 - 4;
    rect(M, y, halfW, 16, COL.lightGray);
    rect(M + halfW + 8, y, halfW, 16, COL.lightGray);
    doc.fontSize(8).font("Helvetica-Bold").fillColor(COL.dark);
    text("Vendor Address", M + 4, y + 4);
    text("Deliver To", M + halfW + 12, y + 4);
    y += 16;
    line(M, y, M + CW, y);
    y += 6;

    // Left: Rurban as vendor
    const vendorLines = [
      COMPANY.name,
      '"formerly known as Rural Urban Tradelink Pvt. Ltd."',
      `Dispatched From: ${COMPANY.dispatch}`,
      `FSSAI NO: ${COMPANY.fssai}`,
      `GSTIN ${COMPANY.gstin}`,
      `UNIT NAME: ${COMPANY.unit}`,
    ];

    // Right: customer delivery
    const addr = order.shipping_address;
    const deliverLines: string[] = [];
    if (order.customer_name) deliverLines.push(order.customer_name);
    if (order.customer_email) deliverLines.push(order.customer_email);
    if (order.customer_phone) deliverLines.push(`Ph: ${order.customer_phone}`);
    if (addr) {
      if (addr.street || addr.address_line1) deliverLines.push(addr.street ?? addr.address_line1 ?? "");
      const cityLine = [addr.city, addr.state, addr.pincode ?? addr.zip].filter(Boolean).join(" ");
      if (cityLine) deliverLines.push(cityLine);
    }

    const addrStartY = y;
    doc.fontSize(7);

    // Draw vendor lines (left column) — track actual height via doc.y
    let vendorEndY = addrStartY;
    vendorLines.forEach((l, i) => {
      const isOrange = i === 1;
      doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica")
        .fillColor(isOrange || i >= 3 ? COL.orange : COL.dark);
      doc.text(l, M + 4, vendorEndY, { width: halfW - 8, lineBreak: true });
      vendorEndY = doc.y + 1;
    });

    // Draw deliver lines (right column) — start at same addrStartY
    let deliverEndY = addrStartY;
    deliverLines.forEach((l, i) => {
      doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fillColor(COL.dark);
      doc.text(l, M + halfW + 12, deliverEndY, { width: halfW - 8, lineBreak: true });
      deliverEndY = doc.y + 1;
    });

    y = Math.max(vendorEndY, deliverEndY) + 6;
    line(M, y, M + CW, y);
    y += 8;

    /* ── 4. LINE ITEMS TABLE ──────────────────────────────────────────────── */
    const tCols = { num: 18, item: 180, hsn: 55, qty: 42, rate: 62, cgst: 55, sgst: 55, amt: 62 };
    const tX = {
      num:  M,
      item: M + tCols.num,
      hsn:  M + tCols.num + tCols.item,
      qty:  M + tCols.num + tCols.item + tCols.hsn,
      rate: M + tCols.num + tCols.item + tCols.hsn + tCols.qty,
      cgst: M + tCols.num + tCols.item + tCols.hsn + tCols.qty + tCols.rate,
      sgst: M + tCols.num + tCols.item + tCols.hsn + tCols.qty + tCols.rate + tCols.cgst,
      amt:  M + tCols.num + tCols.item + tCols.hsn + tCols.qty + tCols.rate + tCols.cgst + tCols.sgst,
    };

    // Table header
    rect(M, y, CW, 18, COL.header);
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(COL.headerText);
    const headerY = y + 5;
    text("#",               tX.num  + 2, headerY);
    text("Item & Description", tX.item + 2, headerY, { width: tCols.item - 4 });
    text("HSN/SAC",         tX.hsn  + 2, headerY, { width: tCols.hsn - 4, align: "center" });
    text("Qty",             tX.qty  + 2, headerY, { width: tCols.qty - 4, align: "center" });
    text("Rate",            tX.rate + 2, headerY, { width: tCols.rate - 4, align: "right" });
    text("CGST",            tX.cgst + 2, headerY, { width: tCols.cgst - 4, align: "center" });
    text("SGST",            tX.sgst + 2, headerY, { width: tCols.sgst - 4, align: "center" });
    text("Amount",          tX.amt  + 2, headerY, { width: tCols.amt - 4, align: "right" });
    y += 18;

    // Table rows
    let subtotalCalc = 0;
    const taxGroups = new Map<number, { cgst: number; sgst: number }>();

    order.order_items.forEach((item, idx) => {
      const rowH = 22;
      const bg = idx % 2 === 0 ? "#ffffff" : COL.altRow;
      rect(M, y, CW, rowH, bg);

      const lineAmt = Number(item.price) * item.quantity;
      const totalRate = item.intra_state_tax_rate ?? 0;
      const halfRate = totalRate / 2;
      const cgstAmt = (lineAmt * halfRate) / 100;
      const sgstAmt = (lineAmt * halfRate) / 100;
      subtotalCalc += lineAmt;

      // accumulate tax groups
      const existing = taxGroups.get(totalRate) ?? { cgst: 0, sgst: 0 };
      taxGroups.set(totalRate, { cgst: existing.cgst + cgstAmt, sgst: existing.sgst + sgstAmt });

      const cellY = y + 4;
      doc.fontSize(7).font("Helvetica").fillColor(COL.primary);
      text(String(idx + 1), tX.num + 2, cellY);

      doc.fillColor("#2563eb");
      text(item.name, tX.item + 2, cellY, { width: tCols.item - 4 });

      doc.fillColor(COL.dark);
      text(item.hsn_or_sac ?? "—", tX.hsn + 2, cellY, { width: tCols.hsn - 4, align: "center" });
      text(`${item.quantity}.000${item.zoho_unit ? `\n${item.zoho_unit}` : ""}`, tX.qty + 2, cellY, { width: tCols.qty - 4, align: "center" });
      text(fmt(Number(item.price)), tX.rate + 2, cellY, { width: tCols.rate - 4, align: "right" });

      // CGST cell
      doc.fillColor(COL.gray).fontSize(6.5);
      text(`${halfRate}%`, tX.cgst + 2, cellY, { width: tCols.cgst - 4, align: "center" });
      doc.fillColor(COL.dark).fontSize(7);
      text(fmt(cgstAmt), tX.cgst + 2, cellY + 9, { width: tCols.cgst - 4, align: "center" });

      // SGST cell
      doc.fillColor(COL.gray).fontSize(6.5);
      text(`${halfRate}%`, tX.sgst + 2, cellY, { width: tCols.sgst - 4, align: "center" });
      doc.fillColor(COL.dark).fontSize(7);
      text(fmt(sgstAmt), tX.sgst + 2, cellY + 9, { width: tCols.sgst - 4, align: "center" });

      doc.fillColor(COL.dark).fontSize(7).font("Helvetica");
      text(fmt(lineAmt), tX.amt + 2, cellY, { width: tCols.amt - 4, align: "right" });

      // Draw column dividers
      [tX.item, tX.hsn, tX.qty, tX.rate, tX.cgst, tX.sgst, tX.amt].forEach(cx => {
        line(cx, y, cx, y + rowH, COL.border, 0.3);
      });
      y += rowH;
    });

    line(M, y, M + CW, y);
    y += 8;

    /* ── 5. FOOTER: notes + totals ────────────────────────────────────────── */
    const totalTax = Array.from(taxGroups.values()).reduce((s, t) => s + t.cgst + t.sgst, 0);
    const grandTotal = Number(order.subtotal || subtotalCalc) + totalTax
      + Number(order.shipping_cost ?? 0) - Number(order.discount ?? 0);

    // If remaining page space < 80pt, add a new page
    const PAGE_H = 841.89;
    if (y > PAGE_H - 80) {
      doc.addPage();
      y = M;
    }

    const footerStartY = y;
    const footerX = M + CW * 0.56;
    const footerLabelW = 90;
    const footerValX = footerX + footerLabelW;
    const footerValW = M + CW - footerValX;

    // Right totals — draw first so we know their height
    let totalY = footerStartY;
    const addTotalRow = (label: string, value: string, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 8.5 : 7.5).fillColor(COL.dark);
      text(label, footerX, totalY, { width: footerLabelW });
      text(value, footerValX, totalY, { width: footerValW, align: "right" });
      totalY += 13;
      line(footerX, totalY - 1, M + CW, totalY - 1, COL.border, 0.3);
    };

    addTotalRow("Sub Total", fmt(subtotalCalc));
    taxGroups.forEach((amounts, rate) => {
      addTotalRow(`CGST (${rate / 2}%)`, fmt(amounts.cgst));
      addTotalRow(`SGST (${rate / 2}%)`, fmt(amounts.sgst));
    });
    if (Number(order.shipping_cost) > 0) addTotalRow("Shipping", fmt(Number(order.shipping_cost)));
    if (Number(order.discount) > 0) addTotalRow("Discount", `-${fmt(Number(order.discount))}`);
    addTotalRow("Total", `₹${fmt(grandTotal)}`, true);

    // Left: items in total + notes
    let leftY = footerStartY;
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(COL.dark);
    text(`Items in Total ${order.order_items.reduce((s, i) => s + i.quantity, 0)}.000`, M, leftY);
    leftY += 12;
    if (order.notes) {
      doc.fontSize(7).font("Helvetica").fillColor(COL.gray);
      text(order.notes, M, leftY, { width: CW * 0.5 });
      leftY += 14;
    }

    y = Math.max(leftY, totalY) + 12;

    // Signature
    line(M, y, M + 100, y);
    y += 4;
    doc.fontSize(7).font("Helvetica").fillColor(COL.gray);
    text("Authorized Signature", M, y);
    y += 20;

    /* ── 6. DOC FOOTER ────────────────────────────────────────────────────── */
    line(M, y, M + CW, y);
    y += 5;
    doc.fontSize(6.5).fillColor(COL.gray).font("Helvetica");
    text(
      `Corp Add: Office No 401-402, Yash Tower, D P Road, Opp: D A V Public School, Aundh, Pune - 411007  |  Company ID :: ${COMPANY.cin}`,
      M, y, { width: CW, align: "center" }
    );

    doc.end();
  });
}
