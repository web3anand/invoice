import { formatSq, inrWords, parseNum, round2 } from "@/features/bills/money";

export type DocKind = "invoice" | "quotation" | "gst";
export type CopyType = "original" | "transport";

export type SizePart = {
  id: string;
  size: string;
  quantity: string;
};

export type Line = {
  id: string;
  description: string;
  hsn: string;
  sizes: SizePart[];
  quantity: string;
  rate: string;
  sqft: string;
  manual: boolean;
  manualAmount: string;
};

export type Bill = {
  id: string;
  kind: DocKind;
  date: string;
  number: string;
  customerId: string;
  customerName: string;
  buyer: string;
  buyerGstin: string;
  phone: string;
  state: string;
  code: string;
  vehicleNumber: string;
  destination: string;
  copyType: CopyType;
  lines: Line[];
  advance: string;
  updatedAt: number;
};

export type Customer = {
  id: string;
  name: string;
  address: string;
  phone: string;
  state: string;
  code: string;
};

export type Profile = {
  name: string;
  address: string;
  gstin: string;
  mobile: string;
  email: string;
  accountName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
  bank: string;
  declarationInvoice: string;
  declarationQuote: string;
  signature: string | null;
};

export const SAMPLE_PROFILE: Profile = {
  name: "AV INTERIOR DECORATION",
  address: "2H/785B ANNAI THERESA NAGAR\nTHOOTHUKUDI - 628002",
  gstin: "33AYTPN6465F1ZY",
  mobile: "9715032513",
  email: "avinterior.info@gmail.com",
  accountName: "AV INTERIOR DECORATION",
  accountNo: "50200074494600",
  ifsc: "HDFC0001104",
  branch: "TUTICORIN",
  bank: "HDFC Bank ( India )",
  declarationInvoice: "We declare that this invoice shows the actual price of the goods",
  declarationQuote: "We declare that this quotation shows the actual price of the goods",
  signature: "/signature.png",
};

export function isGst(kind: DocKind): boolean {
  return kind === "gst";
}

export function pdfFileName(bill: Bill): string {
  const label = bill.kind === "gst" ? "GST-Invoice" : bill.kind === "invoice" ? "Invoice" : "Quote";
  const number = bill.number.trim() || "draft";
  const copy = bill.kind === "gst" && bill.copyType === "transport" ? "-Transport" : "";
  return `${label} ${number}${copy}`.replace(/[\\/:*?"<>|]/g, "-");
}

export function sameCustomer(a: string, b: string): boolean {
  const tidy = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  return tidy(a) === tidy(b) && tidy(a).length > 0;
}

export function printedBuyer(bill: Bill): string {
  const name = bill.customerName.trim();
  const address = bill.buyer.trim();
  if (name && address) return `${name}\n${address}`;
  return name || address;
}

export function splitBuyer(buyer: string): { name: string; address: string } {
  const lines = buyer.split("\n");
  const name = (lines[0] ?? "").trim();
  const address = lines.slice(1).join("\n").trim();
  return { name, address };
}

export function numberLabel(kind: DocKind): string {
  if (kind === "gst") return "GST Invoice No.";
  return kind === "invoice" ? "Invoice No." : "Quote No.";
}

export function docTitle(kind: DocKind): string {
  if (kind === "gst") return "GST Invoice";
  return kind === "invoice" ? "Invoice" : "Quotation";
}

export function sheetTitle(kind: DocKind): string {
  if (kind === "gst") return "TAX INVOICE";
  return kind === "invoice" ? "INVOICE" : "QUOTATION";
}

export function copyLabel(copy: CopyType): string {
  return copy === "transport" ? "DUPLICATE FOR TRANSPORT" : "ORIGINAL FOR RECIPIENT";
}

export function nextBillNumber(docs: Bill[], kind: DocKind): string {
  let max = 0;
  for (const doc of docs) {
    if (doc.kind !== kind) continue;
    const match = /(\d+)\s*$/.exec(doc.number.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

export function ensureNumbers(docs: Bill[]): Bill[] {
  const seq: Record<DocKind, number> = { invoice: 0, quotation: 0, gst: 0 };
  const used: Record<DocKind, Set<string>> = {
    invoice: new Set(),
    quotation: new Set(),
    gst: new Set(),
  };
  for (const doc of docs) {
    const n = doc.number.trim();
    if (!n) continue;
    used[doc.kind].add(n);
    const match = /(\d+)\s*$/.exec(n);
    if (match) seq[doc.kind] = Math.max(seq[doc.kind], Number(match[1]));
  }

  // Older bills keep their number when two devices created the same one
  // offline. Newer duplicates move to the next free number instead of
  // silently sharing a number.
  const assigned: Record<DocKind, Set<string>> = {
    invoice: new Set(),
    quotation: new Set(),
    gst: new Set(),
  };
  const fixed = new Map<string, Bill>();
  for (const doc of [...docs].sort((a, b) => a.updatedAt - b.updatedAt)) {
    const n = doc.number.trim();
    if (n && !assigned[doc.kind].has(n)) {
      assigned[doc.kind].add(n);
      fixed.set(doc.id, doc);
      continue;
    }
    let next = seq[doc.kind] + 1;
    while (used[doc.kind].has(String(next)) || assigned[doc.kind].has(String(next))) {
      next += 1;
    }
    seq[doc.kind] = next;
    assigned[doc.kind].add(String(next));
    fixed.set(doc.id, { ...doc, number: String(next) });
  }
  return docs.map((doc) => fixed.get(doc.id) ?? doc);
}

export function advanceLabel(kind: DocKind): string {
  return kind === "quotation" ? "Booking advance" : "Advance";
}

export function balanceLabel(kind: DocKind): string {
  return kind === "quotation" ? "Balance" : "Remaining";
}

export function footerLine(kind: DocKind): string {
  if (kind === "gst") return "This is Computer Generated Invoice";
  return kind === "invoice"
    ? "This is Computer Generated Invoice"
    : "This is Computer Generated Quotation";
}

export function declarationFor(profile: Profile, kind: DocKind): string {
  return kind === "quotation" ? profile.declarationQuote : profile.declarationInvoice;
}

export function wordsLabel(kind: DocKind): string {
  if (kind === "gst") return "Amount chargeable ( in words )";
  return kind === "quotation" ? "Amount Quoted (in words)" : "Amount Chargeable (in words)";
}

export function blankSize(quantity = "1"): SizePart {
  return { id: crypto.randomUUID(), size: "", quantity: quantity.trim() || "1" };
}

export function blankLine(kind?: DocKind): Line {
  return {
    id: crypto.randomUUID(),
    description: "",
    hsn: "",
    sizes: kind === "quotation" ? [blankSize()] : [],
    quantity: "1",
    rate: "",
    sqft: "-",
    manual: false,
    manualAmount: "",
  };
}

export function todayISO(): string {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function sampleBill(
  id = "sample-chair-invoice",
  lineId = "sample-chair-line",
): Bill {
  return {
    id,
    kind: "invoice",
    date: "2026-06-03",
    number: "1",
    customerId: "sample-customer-medical",
    customerName: "Medical Officer ,",
    buyer: "Urban primary health center-madathur , thoothukudi",
    buyerGstin: "",
    phone: "",
    state: "TamilNadu",
    code: "33",
    vehicleNumber: "",
    destination: "",
    copyType: "original",
    lines: [
      {
        id: lineId,
        description: "Three Seater Chair",
        hsn: "",
        sizes: [],
        quantity: "1",
        rate: "3950",
        sqft: "-",
        manual: false,
        manualAmount: "",
      },
    ],
    advance: "",
    updatedAt: 1_780_416_000_000,
  };
}

export function blankBill(kind: DocKind): Bill {
  return {
    id: crypto.randomUUID(),
    kind,
    date: todayISO(),
    number: "",
    customerId: "",
    customerName: "",
    buyer: "",
    buyerGstin: "",
    phone: "",
    state: "TamilNadu",
    code: "33",
    vehicleNumber: "",
    destination: kind === "gst" ? "Thoothukudi" : "",
    copyType: "original",
    lines: [blankLine(kind)],
    advance: "",
    updatedAt: Date.now(),
  };
}

function sqMultiplier(raw: string): number | null {
  const t = raw.trim();
  if (!t || t === "-" || t === "–" || t === "—") return null;
  const n = parseNum(t);
  if (!n) return null;
  return n;
}

export function parseSize(raw: string): { length: number; width: number } | null {
  const match = raw
    .trim()
    .replace(/×/g, "x")
    .match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet|')?\s*[x*]\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|')?$/i);
  if (!match) return null;
  const length = Number(match[1]);
  const width = Number(match[2]);
  if (!length || !width) return null;
  return { length, width };
}

export function prettySize(raw: string): string {
  const dims = parseSize(raw);
  if (!dims) return raw.trim();
  return `${dims.length} × ${dims.width}`;
}

/** Length × width × qty, rounded to a whole number. Qty is 1 when blank. */
export function roundedSqft(size: string, quantity: string): string | null {
  const dims = parseSize(size);
  if (!dims) return null;
  const qty = parseNum(quantity);
  const pieces = qty > 0 ? qty : 1;
  return String(Math.round(dims.length * dims.width * pieces));
}

export function partSqft(part: SizePart): number | null {
  const text = roundedSqft(part.size, part.quantity);
  return text == null ? null : Number(text);
}

export function sizeLabel(part: SizePart): string {
  const pretty = prettySize(part.size);
  const qty = parseNum(part.quantity);
  if (qty > 0 && qty !== 1) return `${pretty} × ${qty}`;
  return pretty;
}

export function filledSizes(line: Line): SizePart[] {
  return line.sizes.filter((part) => parseSize(part.size));
}

/** Sum of each rounded size. Null when no size can be read. */
export function measuresFromSizes(sizes: SizePart[]): { sqft: string; quantity: string } | null {
  let area = 0;
  let pieces = 0;
  let any = false;
  for (const part of sizes) {
    const sq = partSqft(part);
    if (sq == null) continue;
    any = true;
    area += sq;
    const qty = parseNum(part.quantity);
    pieces += qty > 0 ? qty : 1;
  }
  if (!any) return null;
  return { sqft: String(area), quantity: String(pieces) };
}

export function lineAmount(line: Line): number {
  if (line.manual) return round2(parseNum(line.manualAmount));
  const rate = parseNum(line.rate);
  const sq = sqMultiplier(line.sqft);
  if (sq === null) return round2(rate);
  return round2(sq * rate);
}

export function lineFormula(line: Line): string {
  if (line.manual) return "Typed amount";
  if (sqMultiplier(line.sqft) === null) return "Rate";
  return "Sq.ft × Rate";
}

export function billTotal(bill: Bill): number {
  return round2(bill.lines.reduce((sum, line) => sum + lineAmount(line), 0));
}

/** GST invoices use 9% CGST + 9% SGST and round the payable total to a rupee. */
export const GST_RATE = 0.09;

export type GstTotals = {
  taxable: number;
  cgst: number;
  sgst: number;
  gross: number;
  rounded: number;
  roundOff: number;
};

export function gstTotals(bill: Bill): GstTotals {
  const taxable = billTotal(bill);
  const cgst = round2(taxable * GST_RATE);
  const sgst = round2(taxable * GST_RATE);
  const gross = round2(taxable + cgst + sgst);
  const rounded = Math.round(gross);
  return { taxable, cgst, sgst, gross, rounded, roundOff: round2(rounded - gross) };
}

/** The amount a customer actually pays: tax-inclusive for GST, taxable otherwise. */
export function billGrandTotal(bill: Bill): number {
  return bill.kind === "gst" ? gstTotals(bill).rounded : billTotal(bill);
}

export function billAdvance(bill: Bill): number {
  return round2(parseNum(bill.advance));
}

export function billBalance(bill: Bill): number {
  return round2(billGrandTotal(bill) - billAdvance(bill));
}

export function billWords(bill: Bill): string {
  return inrWords(billGrandTotal(bill));
}

export function printSq(raw: string): string {
  return formatSq(raw);
}

export function normalizeCustomer(raw: Partial<Customer> | undefined): Customer | null {
  if (!raw || typeof raw !== "object") return null;
  const name = (raw.name ?? "").trim();
  if (!name) return null;
  return {
    id: raw.id || crypto.randomUUID(),
    name,
    address: raw.address ?? "",
    phone: raw.phone ?? "",
    state: raw.state ?? "",
    code: raw.code ?? "",
  };
}

export function linkCustomers(docs: Bill[], saved: unknown): { docs: Bill[]; customers: Customer[] } {
  const customers: Customer[] = [];
  if (Array.isArray(saved)) {
    for (const item of saved) {
      const customer = normalizeCustomer(item as Partial<Customer>);
      if (customer && !customers.some((existing) => existing.id === customer.id)) customers.push(customer);
    }
  }
  const next = docs.map((doc) => {
    const name = doc.customerName.trim();
    if (!name) return { ...doc, customerId: "" };
    let customer = customers.find((item) => item.id === doc.customerId);
    if (!customer) customer = customers.find((item) => sameCustomer(item.name, name));
    if (!customer) {
      customer = {
        id: doc.customerId || crypto.randomUUID(),
        name,
        address: doc.buyer,
        phone: doc.phone,
        state: doc.state,
        code: doc.code,
      };
      customers.push(customer);
    }
    return { ...doc, customerId: customer.id };
  });
  customers.sort((a, b) => a.name.localeCompare(b.name));
  return { docs: next, customers };
}

export const MIN_BODY_ROWS = 8;
