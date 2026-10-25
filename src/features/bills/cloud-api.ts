import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import {
  billSchema,
  customerSchema,
  idSchema,
  normalizeLines,
  profileSchema,
  trashSchema,
  workspaceSeedSchema,
} from "@/features/bills/cloud-contract";
import type { Bill, Customer, DocKind, Profile } from "@/features/bills/model";

/**
 * Server functions for the cloud bill workspace.
 *
 * These run on the server only (Neon when `DATABASE_URL` is set, PGLite in the
 * live preview). The browser calls them directly; all inputs are parsed with the
 * schemas in `cloud-contract.ts` before touching SQL.
 */

export type CloudWorkspace = {
  docs: Bill[];
  trashed: Bill[];
  customers: Customer[];
  profile: Profile | null;
  savedAt: number;
};

type DocRow = {
  id: string;
  kind: string;
  doc_date: string;
  number: string;
  customer_id: string;
  customer_name: string;
  buyer: string;
  buyer_gstin: string;
  phone: string;
  state: string;
  code: string;
  vehicle_number: string;
  destination: string;
  copy_type: string;
  advance: string;
  lines: unknown;
  deleted_at: number | null;
  updated_at: number;
};

type CustomerRow = {
  id: string;
  name: string;
  address: string;
  phone: string;
  state: string;
  code: string;
};

function toBill(row: DocRow): Bill {
  const kind: DocKind =
    row.kind === "quotation" || row.kind === "gst" ? row.kind : "invoice";
  return {
    id: row.id,
    kind,
    date: row.doc_date ?? "",
    number: row.number ?? "",
    customerId: row.customer_id ?? "",
    customerName: row.customer_name ?? "",
    buyer: row.buyer ?? "",
    buyerGstin: row.buyer_gstin ?? "",
    phone: row.phone ?? "",
    state: row.state ?? "",
    code: row.code ?? "",
    vehicleNumber: row.vehicle_number ?? "",
    destination: row.destination ?? "",
    copyType: row.copy_type === "transport" ? "transport" : "original",
    lines: normalizeLines(row.lines),
    advance: row.advance ?? "",
    updatedAt: Number(row.updated_at) || 0,
  };
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name ?? "",
    address: row.address ?? "",
    phone: row.phone ?? "",
    state: row.state ?? "",
    code: row.code ?? "",
  };
}

async function insertDocument(sql: Sql, bill: Bill, at: number): Promise<void> {
  await sql`
    insert into documents (
      id, kind, doc_date, number, customer_id, customer_name, buyer,
      buyer_gstin, phone, state, code, vehicle_number, destination, copy_type, advance,
      lines, deleted_at, updated_at
    ) values (
      ${bill.id}, ${bill.kind}, ${bill.date}, ${bill.number}, ${bill.customerId},
      ${bill.customerName}, ${bill.buyer}, ${bill.buyerGstin}, ${bill.phone},
      ${bill.state}, ${bill.code}, ${bill.vehicleNumber}, ${bill.destination},
      ${bill.copyType}, ${bill.advance}, ${JSON.stringify(bill.lines)}::jsonb, null, ${at}
    )
    on conflict (id) do nothing
  `;
}

export const getCloudWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<CloudWorkspace> => {
    const sql = await getSql();
    return loadAll(sql);
  },
);

async function loadAll(sql: Sql): Promise<CloudWorkspace> {
  const activeRows = await sql<DocRow>`
    select id, kind, doc_date, number, customer_id, customer_name, buyer,
           buyer_gstin, phone, state, code, vehicle_number, destination, copy_type, advance,
           lines, deleted_at, updated_at
    from documents
    where deleted_at is null
    order by updated_at desc
  `;
  const trashedRows = await sql<DocRow>`
    select id, kind, doc_date, number, customer_id, customer_name, buyer,
           buyer_gstin, phone, state, code, vehicle_number, destination, copy_type, advance,
           lines, deleted_at, updated_at
    from documents
    where deleted_at is not null
    order by deleted_at desc
  `;
  const customerRows = await sql<CustomerRow>`
    select id, name, address, phone, state, code
    from customers
    order by name asc
  `;
  const settings = await sql<{ value: unknown }>`
    select value from workspace_settings where key = 'profile'
  `;
  const profile = settings[0]
    ? profileSchema.safeParse(settings[0].value)
    : null;

  return {
    docs: activeRows.map(toBill),
    trashed: trashedRows.map(toBill),
    customers: customerRows.map(toCustomer),
    profile: profile?.success ? profile.data : null,
    savedAt: Date.now(),
  };
}

export const saveDocument = createServerFn({ method: "POST" })
  .validator((value: unknown) => billSchema.parse(value))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await sql`
      insert into documents (
        id, kind, doc_date, number, customer_id, customer_name, buyer,
        buyer_gstin, phone, state, code, vehicle_number, destination, copy_type, advance,
        lines, deleted_at, updated_at
      ) values (
        ${data.id}, ${data.kind}, ${data.date}, ${data.number}, ${data.customerId},
        ${data.customerName}, ${data.buyer}, ${data.buyerGstin}, ${data.phone},
        ${data.state}, ${data.code}, ${data.vehicleNumber}, ${data.destination},
        ${data.copyType}, ${data.advance}, ${JSON.stringify(data.lines)}::jsonb, null, ${data.updatedAt}
      )
      on conflict (id) do update set
        kind = excluded.kind,
        doc_date = excluded.doc_date,
        number = excluded.number,
        customer_id = excluded.customer_id,
        customer_name = excluded.customer_name,
        buyer = excluded.buyer,
        buyer_gstin = excluded.buyer_gstin,
        phone = excluded.phone,
        state = excluded.state,
        code = excluded.code,
        vehicle_number = excluded.vehicle_number,
        destination = excluded.destination,
        copy_type = excluded.copy_type,
        advance = excluded.advance,
        lines = excluded.lines,
        deleted_at = null,
        updated_at = excluded.updated_at
      where documents.updated_at <= excluded.updated_at
    `;
    return { ok: true };
  });

export const moveDocumentToTrash = createServerFn({ method: "POST" })
  .validator((value: unknown) => trashSchema.parse(value))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await sql`
      update documents
      set deleted_at = ${data.at}, updated_at = ${data.at}
      where id = ${data.id} and (deleted_at is null or updated_at <= ${data.at})
    `;
    return { ok: true };
  });

export const deleteDocumentForever = createServerFn({ method: "POST" })
  .validator((value: unknown) => idSchema.parse(value))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await sql`delete from documents where id = ${data.id}`;
    return { ok: true };
  });

export const saveCustomer = createServerFn({ method: "POST" })
  .validator((value: unknown) => customerSchema.parse(value))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    const at = Date.now();
    await sql`
      insert into customers (id, name, address, phone, state, code, updated_at)
      values (
        ${data.id}, ${data.name}, ${data.address}, ${data.phone},
        ${data.state}, ${data.code}, ${at}
      )
      on conflict (id) do update set
        name = excluded.name,
        address = excluded.address,
        phone = excluded.phone,
        state = excluded.state,
        code = excluded.code,
        updated_at = excluded.updated_at
    `;
    return { ok: true };
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .validator((value: unknown) => idSchema.parse(value))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await sql`delete from customers where id = ${data.id}`;
    return { ok: true };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .validator((value: unknown) => profileSchema.parse(value))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await sql`
      insert into workspace_settings (key, value, updated_at)
      values ('profile', ${JSON.stringify(data)}::jsonb, ${Date.now()})
      on conflict (key) do update set
        value = excluded.value,
        updated_at = excluded.updated_at
    `;
    return { ok: true };
  });

export const seedCloudWorkspace = createServerFn({ method: "POST" })
  .validator((value: unknown) => workspaceSeedSchema.parse(value))
  .handler(async ({ data }): Promise<{ seeded: boolean }> => {
    const sql = await getSql();
    const [counts] = await sql<{ docs: number; customers: number; settings: number }>`
      select
        (select count(*)::int from documents) as docs,
        (select count(*)::int from customers) as customers,
        (select count(*)::int from workspace_settings) as settings
    `;
    if (counts && (counts.docs > 0 || counts.customers > 0 || counts.settings > 0)) {
      return { seeded: false };
    }

    const at = data.at || Date.now();
    for (const bill of data.docs) await insertDocument(sql, bill, bill.updatedAt || at);
    for (const bill of data.trashed) {
      await insertDocument(sql, bill, bill.updatedAt || at);
      await sql`
        update documents set deleted_at = ${bill.updatedAt || at}
        where id = ${bill.id}
      `;
    }
    for (const customer of data.customers) {
      await sql`
        insert into customers (id, name, address, phone, state, code, updated_at)
        values (
          ${customer.id}, ${customer.name}, ${customer.address}, ${customer.phone},
          ${customer.state}, ${customer.code}, ${at}
        )
        on conflict (id) do nothing
      `;
    }
    await sql`
      insert into workspace_settings (key, value, updated_at)
      values ('profile', ${JSON.stringify(data.profile)}::jsonb, ${at})
      on conflict (key) do nothing
    `;
    return { seeded: true };
  });
