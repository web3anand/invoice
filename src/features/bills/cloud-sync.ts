import { create } from "zustand";
import { ensureNumbers, type Bill, type Customer, type Profile } from "@/features/bills/model";
import {
  deleteCustomer as deleteCustomerCloud,
  deleteDocumentForever,
  getCloudWorkspace,
  moveDocumentToTrash,
  saveCustomer as saveCustomerCloud,
  saveDocument,
  saveProfile,
  seedCloudWorkspace,
  type CloudWorkspace,
} from "@/features/bills/cloud-api";
import { useBills, type WorkspaceSnapshot } from "@/features/bills/store";

/**
 * Automatic cloud sync for the bill desk.
 *
 * The zustand store stays the single source of truth while you type. A small
 * engine mirrors every change to the server (Neon on deploy, PGLite in the
 * preview), debounced so typing does not fire a request per keystroke. The
 * browser also keeps its localStorage copy, so the desk still opens when the
 * network is down; changes are retried when it comes back.
 */

export type CloudStatus = "starting" | "connecting" | "saving" | "saved" | "error";

type CloudSyncState = {
  status: CloudStatus;
  /** Epoch ms of the last successful mirror. */
  lastSavedAt: number;
  /** Epoch ms of the last workspace read from the server. */
  lastLoadedAt: number;
  error: string;
  /** Roughly how many records are waiting to be written. */
  pending: number;
  ready: boolean;
};

export const useCloudSync = create<CloudSyncState>(() => ({
  status: "starting",
  lastSavedAt: 0,
  lastLoadedAt: 0,
  error: "",
  pending: 0,
  ready: false,
}));

const set = useCloudSync.setState;

let baseDocs = new Map<string, Bill>();
let baseTrashed = new Map<string, Bill>();
let baseCustomers = new Map<string, Customer>();
let baseProfile: Profile | null = null;

let revision = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let inflight: Promise<void> | null = null;
let started = false;

type CloudGlobal = typeof globalThis & {
  __avCloudStop?: () => void;
  __avCloudUnsub?: () => void;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Could not reach the cloud workspace.";
}

function resetBaseline(snapshot: WorkspaceSnapshot): void {
  baseDocs = new Map(snapshot.docs.map((bill) => [bill.id, bill]));
  baseTrashed = new Map(snapshot.trashed.map((bill) => [bill.id, bill]));
  baseCustomers = new Map(snapshot.customers.map((customer) => [customer.id, customer]));
  baseProfile = snapshot.profile;
}

function countPending(snapshot: WorkspaceSnapshot): number {
  let count = 0;
  const activeIds = new Set<string>();
  const trashedIds = new Set<string>();

  for (const bill of snapshot.docs) {
    activeIds.add(bill.id);
    if (baseDocs.get(bill.id) !== bill) count += 1;
  }
  for (const bill of snapshot.trashed) {
    trashedIds.add(bill.id);
    if (baseTrashed.get(bill.id) !== bill) count += 1;
  }
  for (const id of baseDocs.keys()) {
    if (!activeIds.has(id) && !trashedIds.has(id)) count += 1;
  }
  for (const id of baseTrashed.keys()) {
    if (!activeIds.has(id) && !trashedIds.has(id)) count += 1;
  }

  const customerIds = new Set<string>();
  for (const customer of snapshot.customers) {
    customerIds.add(customer.id);
    if (baseCustomers.get(customer.id) !== customer) count += 1;
  }
  for (const id of baseCustomers.keys()) {
    if (!customerIds.has(id)) count += 1;
  }

  if (baseProfile !== snapshot.profile) count += 1;
  return count;
}

export function isCloudEmpty(workspace: CloudWorkspace): boolean {
  return (
    workspace.docs.length === 0 &&
    workspace.trashed.length === 0 &&
    workspace.customers.length === 0 &&
    !workspace.profile
  );
}

type MergeResult = {
  workspaces: Partial<WorkspaceSnapshot>;
  uploadDocs: Set<string>;
  uploadTrashed: Set<string>;
  uploadCustomers: Set<string>;
  uploadProfile: boolean;
};

function mergeWorkspace(
  local: WorkspaceSnapshot,
  remote: CloudWorkspace,
): MergeResult {
  type Entry = { bill: Bill; trashed: boolean; fromLocal: boolean };
  const entries = new Map<string, Entry>();
  const uploadDocs = new Set<string>();
  const uploadTrashed = new Set<string>();
  const uploadCustomers = new Set<string>();

  for (const bill of remote.trashed) {
    entries.set(bill.id, { bill, trashed: true, fromLocal: false });
  }
  for (const bill of remote.docs) {
    entries.set(bill.id, { bill, trashed: false, fromLocal: false });
  }

  for (const bill of local.trashed) {
    const existing = entries.get(bill.id);
    if (!existing) {
      entries.set(bill.id, { bill, trashed: true, fromLocal: true });
      uploadTrashed.add(bill.id);
    } else if (bill.updatedAt > existing.bill.updatedAt) {
      entries.set(bill.id, { bill, trashed: true, fromLocal: true });
      uploadTrashed.add(bill.id);
      uploadDocs.delete(bill.id);
    }
  }
  for (const bill of local.docs) {
    const existing = entries.get(bill.id);
    if (!existing) {
      entries.set(bill.id, { bill, trashed: false, fromLocal: true });
      uploadDocs.add(bill.id);
    } else if (bill.updatedAt > existing.bill.updatedAt) {
      entries.set(bill.id, { bill, trashed: false, fromLocal: true });
      uploadDocs.add(bill.id);
      uploadTrashed.delete(bill.id);
    }
  }

  const docs: Bill[] = [];
  const trashed: Bill[] = [];
  for (const entry of entries.values()) {
    (entry.trashed ? trashed : docs).push(entry.bill);
  }
  docs.sort((a, b) => b.updatedAt - a.updatedAt);
  trashed.sort((a, b) => b.updatedAt - a.updatedAt);

  // A bill created before the first cloud load can share a number with a
  // server bill. Renumber the newer one and send the correction back up.
  const numbered = new Map(
    ensureNumbers([...docs, ...trashed]).map((bill) => [bill.id, bill]),
  );
  for (let i = 0; i < docs.length; i += 1) {
    const fixed = numbered.get(docs[i].id);
    if (!fixed) continue;
    if (fixed.number !== docs[i].number) uploadDocs.add(fixed.id);
    docs[i] = fixed;
  }
  for (let i = 0; i < trashed.length; i += 1) {
    const fixed = numbered.get(trashed[i].id);
    if (!fixed) continue;
    if (fixed.number !== trashed[i].number) uploadTrashed.add(fixed.id);
    trashed[i] = fixed;
  }

  const customers = new Map<string, Customer>();
  for (const customer of remote.customers) customers.set(customer.id, customer);
  for (const customer of local.customers) {
    if (!customers.has(customer.id)) {
      customers.set(customer.id, customer);
      uploadCustomers.add(customer.id);
    }
  }
  const customerList = [...customers.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const activeId = docs.some((doc) => doc.id === local.activeId)
    ? local.activeId
    : (docs[0]?.id ?? trashed[0]?.id ?? "");

  return {
    workspaces: {
      docs,
      trashed,
      customers: customerList,
      profile: remote.profile ?? local.profile,
      activeId,
    },
    uploadDocs,
    uploadTrashed,
    uploadCustomers,
    uploadProfile: !remote.profile,
  };
}

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
}

function schedule(delay = 800): void {
  clearTimer();
  timer = setTimeout(() => {
    timer = undefined;
    void saveNow().catch(() => undefined);
  }, delay);
}

function onChange(): void {
  revision += 1;
  if (!useCloudSync.getState().ready) return;
  const pending = countPending(useBills.getState());
  set({ status: pending ? "saving" : "saved", pending });
  if (pending) schedule(800);
}

async function flushOnce(): Promise<void> {
  const snapshot = useBills.getState();
  const pending = countPending(snapshot);
  if (pending === 0) {
    set({ status: "saved", pending: 0, error: "" });
    return;
  }

  const active = new Map(snapshot.docs.map((bill) => [bill.id, bill]));
  const trashed = new Map(snapshot.trashed.map((bill) => [bill.id, bill]));
  const customers = new Map(snapshot.customers.map((customer) => [customer.id, customer]));
  const profile = snapshot.profile;

  set({ status: "saving", pending, error: "" });

  try {
    // Active documents: new ones and edits.
    for (const [id, bill] of active) {
      if (!baseTrashed.has(id) && baseDocs.get(id) === bill) continue;
      await saveDocument({ data: bill });
      baseDocs.set(id, bill);
      baseTrashed.delete(id);
    }

    // Documents moved to Trash.
    for (const [id, bill] of trashed) {
      if (!baseDocs.has(id) && baseTrashed.get(id) === bill) continue;
      await moveDocumentToTrash({
        data: { id, at: bill.updatedAt || Date.now() },
      });
      baseTrashed.set(id, bill);
      baseDocs.delete(id);
    }

    // Documents deleted forever (present in a baseline, gone from both lists).
    const removed = new Set<string>();
    for (const id of baseDocs.keys()) {
      if (!active.has(id) && !trashed.has(id)) removed.add(id);
    }
    for (const id of baseTrashed.keys()) {
      if (!active.has(id) && !trashed.has(id)) removed.add(id);
    }
    for (const id of removed) {
      await deleteDocumentForever({ data: { id } });
      baseDocs.delete(id);
      baseTrashed.delete(id);
    }

    // Saved customers.
    for (const [id, customer] of customers) {
      if (baseCustomers.get(id) === customer) continue;
      await saveCustomerCloud({ data: customer });
      baseCustomers.set(id, customer);
    }
    for (const id of [...baseCustomers.keys()]) {
      if (customers.has(id)) continue;
      await deleteCustomerCloud({ data: { id } });
      baseCustomers.delete(id);
    }

    // Letterhead / signature.
    if (baseProfile !== profile) {
      await saveProfile({ data: profile });
      baseProfile = profile;
    }

    const now = Date.now();
    set({
      status: "saved",
      lastSavedAt: now,
      pending: countPending(useBills.getState()),
      error: "",
    });
  } catch (error) {
    set({
      status: "error",
      error: errorMessage(error),
      pending: countPending(useBills.getState()),
    });
    throw error;
  }
}

/** Flush every pending change now (the debounce is skipped). */
export function saveNow(): Promise<void> {
  clearTimer();
  if (inflight) return inflight;
  const startedRevision = revision;
  inflight = flushOnce().finally(() => {
    inflight = null;
    if (revision !== startedRevision) schedule(60);
  });
  return inflight;
}

async function bootstrap(): Promise<void> {
  set({ status: "connecting", error: "", ready: false });

  try {
    await Promise.resolve(useBills.persist.rehydrate()).catch(() => undefined);
    const remote = await getCloudWorkspace();
    const local = useBills.getState();

    if (isCloudEmpty(remote)) {
      const hasLocal =
        local.docs.length > 0 ||
        local.trashed.length > 0 ||
        local.customers.length > 0;
      if (hasLocal) {
        await seedCloudWorkspace({
          data: {
            docs: local.docs,
            trashed: local.trashed,
            customers: local.customers,
            profile: local.profile,
            at: Date.now(),
          },
        });
      }
      resetBaseline(useBills.getState());
    } else {
      const merged = mergeWorkspace(local, remote);
      useBills.getState().hydrateWorkspace(merged.workspaces);
      const hydrated = useBills.getState();
      resetBaseline(hydrated);

      // Anything newer on this device (or absent from the server) still has to
      // travel up, so remove it from the "already synced" baseline.
      for (const id of merged.uploadDocs) baseDocs.delete(id);
      for (const id of merged.uploadTrashed) baseTrashed.delete(id);
      for (const id of merged.uploadCustomers) baseCustomers.delete(id);
      if (merged.uploadProfile) baseProfile = null;
    }

    subscribe();
    const now = Date.now();
    set({
      status: "saved",
      lastLoadedAt: now,
      lastSavedAt: now,
      pending: countPending(useBills.getState()),
      error: "",
      ready: true,
    });
    if (countPending(useBills.getState()) > 0) schedule(30);
  } catch (error) {
    // Keep the local copy usable; every edit retries the mirror.
    set({ status: "error", error: errorMessage(error), ready: true });
    subscribe();
  }
}

function subscribe(): void {
  const g = globalThis as CloudGlobal;
  g.__avCloudUnsub?.();
  const unsubscribe = useBills.subscribe((state, previous) => {
    if (
      state.docs === previous.docs &&
      state.trashed === previous.trashed &&
      state.customers === previous.customers &&
      state.profile === previous.profile
    ) {
      return;
    }
    onChange();
  });
  g.__avCloudUnsub = unsubscribe;
  g.__avCloudStop = () => {
    unsubscribe();
    clearTimer();
  };
}

/** Load the cloud workspace and start mirroring changes. Safe to call twice. */
export function startCloudSync(): void {
  if (started) return;
  started = true;
  const g = globalThis as CloudGlobal;
  g.__avCloudStop?.();
  void bootstrap();
}

/** Replace this device's copy with what the cloud currently holds. */
export async function reloadFromCloud(): Promise<number> {
  set({ status: "connecting", error: "" });
  try {
    const remote = await getCloudWorkspace();
    if (isCloudEmpty(remote)) {
      throw new Error("The cloud workspace is empty.");
    }
    const current = useBills.getState();
    useBills.getState().hydrateWorkspace({
      docs: remote.docs,
      trashed: remote.trashed,
      customers: remote.customers,
      profile: remote.profile ?? current.profile,
      activeId: current.activeId,
    });
    resetBaseline(useBills.getState());
    const now = Date.now();
    set({
      status: "saved",
      lastLoadedAt: now,
      lastSavedAt: now,
      pending: 0,
      error: "",
      ready: true,
    });
    return remote.docs.length + remote.trashed.length + remote.customers.length;
  } catch (error) {
    set({ status: "error", error: errorMessage(error) });
    throw error;
  }
}
