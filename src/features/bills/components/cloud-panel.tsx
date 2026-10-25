import { useState } from "react";
import { Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";
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
  if (status === "saved") return "Everything is saved";
  if (status === "connecting") return "Connecting to cloud database…";
  return "Getting ready…";
}

const btnPrimary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-olive px-4 text-sm font-semibold text-white transition-colors hover:bg-olive-deep active:bg-olive-deep disabled:opacity-40";
const btnGhost =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-hover active:bg-active disabled:opacity-40";

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
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Cloud Database</h2>
        <p className="mt-1 text-sm text-muted">
          Every invoice, quotation, customer and letterhead change saves to your cloud
          database automatically. This browser keeps an offline copy too, so you
          can keep working when the connection drops.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0">
            {status === "error" ? (
              <CloudOff className="size-5 text-danger" aria-hidden="true" />
            ) : status === "saving" || status === "connecting" ? (
              <Loader2 className="size-5 animate-spin text-olive" aria-hidden="true" />
            ) : (
              <Cloud className="size-5 text-olive" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{statusText(status, pending)}</p>
            <p className="mt-0.5 text-sm text-muted">
              Last saved {when(lastSavedAt)} · last loaded {when(lastLoadedAt)}
            </p>
            {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
          <div>
            <dt className="text-xs text-muted">Invoices</dt>
            <dd className="text-lg font-semibold tabular-nums">{invoices}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Quotes</dt>
            <dd className="text-lg font-semibold tabular-nums">{quotes}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Trash</dt>
            <dd className="text-lg font-semibold tabular-nums">{trashed.length}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className={btnPrimary}
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
            className={btnGhost}
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
        {note ? <p className="mt-2 text-sm">{note}</p> : null}
        <p className="mt-3 text-xs text-muted">
          {customers.length} saved customer{customers.length === 1 ? "" : "s"} ·{" "}
          {trashed.length} item{trashed.length === 1 ? "" : "s"} in Trash
        </p>
      </div>
    </section>
  );
}
