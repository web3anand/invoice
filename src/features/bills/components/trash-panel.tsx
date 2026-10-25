import { useState } from "react";
import { ArchiveRestore, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { billGrandTotal, docTitle, pdfFileName } from "@/features/bills/model";
import { formatInr } from "@/features/bills/money";
import { useBills } from "@/features/bills/store";

const btnGhost =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-150 hover:bg-hover active:bg-active disabled:opacity-40";

function when(epoch: number): string {
  if (!epoch) return "";
  const date = new Date(epoch);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TrashPanel({ onRestored }: { onRestored: () => void }) {
  const trashed = useBills((s) => s.trashed);
  const restoreBill = useBills((s) => s.restoreBill);
  const deleteBillForever = useBills((s) => s.deleteBillForever);
  const [confirmId, setConfirmId] = useState("");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-6 sm:px-6 md:pb-10">
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Trash</h2>
        <p className="mt-1 text-sm text-muted">
          Deleted invoices and quotations wait here. Restore one to keep working on it, or
          delete it forever.
        </p>

        {trashed.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
            <Trash2 className="mx-auto size-6 text-muted" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted">Trash is empty.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {trashed.map((doc) => (
              <li
                key={doc.id}
                className="rounded-2xl border border-line bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-brass">
                      {docTitle(doc.kind)} No. {doc.number || "—"}
                    </p>
                    <p className="truncate text-base">
                      {doc.customerName.trim() || "No customer"}
                    </p>
                    <p className="text-xs text-muted">
                      {formatInr(billGrandTotal(doc))} · moved {when(doc.updatedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatInr(billGrandTotal(doc))}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => {
                      restoreBill(doc.id);
                      toast(`${pdfFileName(doc)} restored`, {
                        description: "It is back in your bills and ready to edit.",
                      });
                      onRestored();
                    }}
                  >
                    <ArchiveRestore className="size-4" aria-hidden="true" />
                    Restore
                  </button>
                  {confirmId === doc.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="inline-flex min-h-9 items-center rounded-lg bg-danger-soft px-3 text-xs font-medium text-danger"
                        onClick={() => {
                          deleteBillForever(doc.id);
                          setConfirmId("");
                          toast(`${docTitle(doc.kind)} No. ${doc.number || "—"} deleted forever`);
                        }}
                      >
                        Delete forever
                      </button>
                      <button
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink"
                        aria-label="Keep in trash"
                        onClick={() => setConfirmId("")}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:text-danger hover:bg-danger-soft"
                      onClick={() => setConfirmId(doc.id)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete forever
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
