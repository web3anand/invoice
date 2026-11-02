import { useState } from "react";
import { CheckCircle2, Cloud, CloudOff, FileText, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useBills } from "@/features/bills/store";
import { reloadFromCloud, saveNow, useCloudSync } from "@/features/bills/cloud-sync";

function when(epoch: number): string {
  if (!epoch) return "Not yet";
  const date = new Date(epoch);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusText(
  status: ReturnType<typeof useCloudSync.getState>["status"],
  pending: number,
): string {
  if (status === "error") return "Not synced — check the connection and retry";
  if (status === "saving" || pending > 0) return `Saving ${pending || ""}`.trim() + "…";
  if (status === "saved") return "All records saved in cloud database";
  if (status === "connecting") return "Connecting to cloud database…";
  return "Getting ready…";
}

const btnPrimary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-olive px-4 text-sm font-semibold text-white shadow-[0_2px_10px_-2px_rgba(101,77,40,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:bg-olive-deep hover:shadow-[0_4px_14px_-2px_rgba(101,77,40,0.55)] active:scale-[0.97] active:bg-olive-deep disabled:opacity-40 disabled:pointer-events-none";
const btnGhost =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line/85 bg-surface/90 px-4 text-sm font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:border-olive/40 hover:bg-hover active:scale-[0.97] active:bg-active disabled:opacity-40 disabled:pointer-events-none";

export function CloudPanel() {
  const status = useCloudSync((s) => s.status);
  const pending = useCloudSync((s) => s.pending);
  const error = useCloudSync((s) => s.error);
  const lastSavedAt = useCloudSync((s) => s.lastSavedAt);
  const lastLoadedAt = useCloudSync((s) => s.lastLoadedAt);
  const docs = useBills((s) => s.docs);
  const trashed = useBills((s) => s.trashed);
  const customers = useBills((s) => s.customers);
  const [busy, setBusy] = useState<"" | "save" | "reload">("");
  const [note, setNote] = useState("");

  const invoices = docs.filter((doc) => doc.kind !== "quotation").length;
  const quotes = docs.length - invoices;

  async function save() {
    setBusy("save");
    setNote("");
    try {
      await saveNow();
      setNote("All changes are saved in the cloud database.");
    } catch {
      setNote("Could not save right now. Your work is still on this device and will retry.");
    } finally {
      setBusy("");
    }
  }

  async function reload() {
    const ok = window.confirm(
      "Replace the bills on this device with the latest copy from the cloud? Unsaved local changes will be lost.",
    );
    if (!ok) return;
    setBusy("reload");
    setNote("");
    try {
      const count = await reloadFromCloud();
      setNote(`Loaded ${count} cloud record${count === 1 ? "" : "s"}.`);
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "Could not read the cloud database.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-ink">Cloud Database</h2>
        <p className="mt-0.5 text-sm text-muted leading-relaxed">
          Invoices, quotations, customers and letterhead sync to your Postgres cloud
          database automatically. An offline copy is preserved locally in browser storage.
        </p>
      </div>

      <div className="beui-card rounded-3xl p-5 shadow-xs sm:p-6">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl bg-cream/70 border border-line/60 shadow-2xs text-olive">
            {status === "error" ? (
              <CloudOff className="size-5 text-danger" aria-hidden="true" />
            ) : status === "saving" || status === "connecting" ? (
              <Loader2 className="size-5 animate-spin text-olive" aria-hidden="true" />
            ) : (
              <Cloud className="size-5 text-olive" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-ink">{statusText(status, pending)}</p>
              {status === "saved" ? (
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Last saved {when(lastSavedAt)} · Last loaded {when(lastLoadedAt)}
            </p>
            {error ? (
              <p className="mt-2 rounded-xl bg-danger-soft p-2.5 text-xs font-medium text-danger border border-danger-line">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2.5 border-t border-line/80 pt-4">
          <div className="rounded-2xl border border-line/70 bg-field/80 p-3 text-center transition-all duration-200 hover:border-olive/35">
            <span className="block text-xs font-medium text-muted">Invoices</span>
            <span className="mt-0.5 block text-xl font-bold tabular-nums text-ink">{invoices}</span>
          </div>
          <div className="rounded-2xl border border-line/70 bg-field/80 p-3 text-center transition-all duration-200 hover:border-olive/35">
            <span className="block text-xs font-medium text-muted">Quotes</span>
            <span className="mt-0.5 block text-xl font-bold tabular-nums text-ink">{quotes}</span>
          </div>
          <div className="rounded-2xl border border-line/70 bg-field/80 p-3 text-center transition-all duration-200 hover:border-olive/35">
            <span className="block text-xs font-medium text-muted">Trash</span>
            <span className="mt-0.5 block text-xl font-bold tabular-nums text-ink">{trashed.length}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            className={`${btnPrimary} flex-1`}
            disabled={busy !== ""}
            onClick={() => void save()}
          >
            {busy === "save" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Cloud className="size-4" aria-hidden="true" />
            )}
            Save now
          </button>
          <button
            type="button"
            className={`${btnGhost} flex-1`}
            disabled={busy !== ""}
            onClick={() => void reload()}
          >
            {busy === "reload" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Reload from cloud
          </button>
        </div>
        {note ? (
          <p className="mt-3 rounded-xl bg-cream/70 p-2.5 text-xs font-medium text-ink border border-line">
            {note}
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-xs text-muted">
          <span>{customers.length} saved customer{customers.length === 1 ? "" : "s"}</span>
          <span>{trashed.length} archived in Trash</span>
        </div>
      </div>
    </section>
  );
}
