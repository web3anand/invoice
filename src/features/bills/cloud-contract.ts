import { z } from "zod";
import type { Bill, Customer, Line, Profile, SizePart } from "@/features/bills/model";

/**
 * Wire format for the cloud workspace. The database stores documents as typed
 * columns + a JSONB line list, so every value that crosses the network is
 * parsed here before it is written — the browser is never trusted blindly.
 */

const shortText = z.string().max(4000).default("");
const quantityText = z.string().max(40).default("");
const idText = z.string().min(1).max(200);

export const sizePartSchema = z.object({
  id: idText,
  size: z.string().max(120).default(""),
  quantity: z.string().max(40).default("1"),
});

export const lineSchema = z.object({
  id: idText,
  description: z.string().max(4000).default(""),
  hsn: z.string().max(40).default(""),
  sizes: z.array(sizePartSchema).max(60).default([]),
  quantity: quantityText,
  rate: quantityText,
  sqft: quantityText,
  manual: z.boolean().default(false),
  manualAmount: quantityText,
});

export const billSchema = z.object({
  id: idText,
  kind: z.enum(["invoice", "quotation", "gst"]),
  date: z.string().max(20).default(""),
  number: z.string().max(80).default(""),
  customerId: z.string().max(200).default(""),
  customerName: z.string().max(500).default(""),
  buyer: z.string().max(6000).default(""),
  buyerGstin: z.string().max(40).default(""),
  phone: z.string().max(80).default(""),
  state: z.string().max(120).default(""),
  code: z.string().max(20).default(""),
  vehicleNumber: z.string().max(40).default(""),
  destination: z.string().max(200).default(""),
  copyType: z.enum(["original", "transport"]).default("original"),
  lines: z.array(lineSchema).max(120).default([]),
  advance: quantityText,
  updatedAt: z.number().int().nonnegative().default(0),
});

export const customerSchema = z.object({
  id: idText,
  name: z.string().max(500).default(""),
  address: z.string().max(6000).default(""),
  phone: z.string().max(80).default(""),
  state: z.string().max(120).default(""),
  code: z.string().max(20).default(""),
});

const profileText = z.string().max(6000).default("");

export const profileSchema = z.object({
  name: profileText,
  address: profileText,
  gstin: z.string().max(40).default(""),
  mobile: z.string().max(80).default(""),
  email: z.string().max(200).default(""),
  accountName: profileText,
  accountNo: z.string().max(80).default(""),
  ifsc: z.string().max(40).default(""),
  branch: z.string().max(200).default(""),
  bank: z.string().max(200).default(""),
  declarationInvoice: profileText,
  declarationQuote: profileText,
  signature: z.string().max(3_000_000).nullable().default(null),
});

export const workspaceSeedSchema = z.object({
  docs: z.array(billSchema).max(500).default([]),
  trashed: z.array(billSchema).max(500).default([]),
  customers: z.array(customerSchema).max(1000).default([]),
  profile: profileSchema,
  at: z.number().int().nonnegative().default(0),
});

export const trashSchema = z.object({
  id: idText,
  at: z.number().int().nonnegative(),
});

export const idSchema = z.object({ id: idText });

/** Cast helpers — each parser returns exactly the app's own model types. */
export function parseBill(value: unknown): Bill {
  return billSchema.parse(value) as Bill;
}

export function parseCustomer(value: unknown): Customer {
  return customerSchema.parse(value) as Customer;
}

export function parseProfile(value: unknown): Profile {
  return profileSchema.parse(value) as Profile;
}

export function normalizeLines(value: unknown): Line[] {
  const parsed = z.array(lineSchema).max(120).safeParse(value);
  return parsed.success ? (parsed.data as Line[]) : [];
}

export function normalizeSizes(value: unknown): SizePart[] {
  const parsed = z.array(sizePartSchema).max(60).safeParse(value);
  return parsed.success ? (parsed.data as SizePart[]) : [];
}
