const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function parseNum(raw: string): number {
  const n = Number(String(raw).replace(/,/g, "").replace(/₹/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export function formatInr(n: number): string {
  const rounded = round2(n);
  const whole = Math.abs(rounded - Math.trunc(rounded)) < 0.001;
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function formatPlain(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const n = Number(t.replace(/,/g, ""));
  if (!Number.isFinite(n)) return t;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}

export function formatSq(raw: string): string {
  const t = raw.trim();
  if (!t || t === "-" || t === "–" || t === "—") return "-";
  return formatPlain(t);
}

export function formatDocDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return iso;
  return `${String(day).padStart(2, "0")}-${MONTHS[month - 1]}-${String(year).slice(2)}`;
}

/** The GST tax invoice reference uses a plain DD-MM-YYYY date. */
export function formatGstDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** GST table money: no rupee symbol, always two decimals. */
export function formatGstMoney(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(round2(n));
}

/** Tax rows in the reference omit the thousands separator (3074.40). */
export function formatGstTax(n: number): string {
  return round2(n).toFixed(2);
}

function two(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]} ${ONES[o]}` : (TENS[t] ?? "");
}

function three(n: number): string {
  if (n < 100) return two(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return rest ? `${ONES[h]} Hundred and ${two(rest)}` : `${ONES[h]} Hundred`;
}

function chunk(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1_000);
  const rest = n % 1_000;
  const parts: string[] = [];
  if (crore > 999) parts.push(`${chunk(crore)} Crore`);
  else if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  return parts.join(" ");
}

/** Indian invoice style: "INR Three Thousand Nine Hundred Fifty Only". */
export function inrWords(amount: number): string {
  const negative = amount < -0.001;
  const abs = Math.abs(amount);
  let rupees = Math.floor(abs + 1e-8);
  let paise = Math.round((abs - rupees) * 100);
  if (paise === 100) {
    rupees += 1;
    paise = 0;
  }
  const head = negative ? "Minus " : "";
  if (rupees === 0 && paise === 0) return `INR ${head}Zero Only`;
  const body =
    rupees === 0
      ? `${chunk(paise)} Paise`
      : paise === 0
        ? chunk(rupees)
        : `${chunk(rupees)} and ${chunk(paise)} Paise`;
  return `INR ${head}${body} Only`;
}
