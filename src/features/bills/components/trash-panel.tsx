import { useState } from "react";
import { Archive, ArchiveRestore, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { billGrandTotal, docTitle, pdfFileName } from "@/features/bills/model";
import { formatDocDate, formatInr } from "@/features/bills/money";
import { useBills } from "@/features/bills/store";

const btnGhost =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-line/85 bg-surface/90 px-3 text-xs font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:border-olive/40 hover:bg-hover active:scale-[0.97] active:bg-active disabled:opacity-40";

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink">Trash</h2>
            <p className="mt-0.5 text-sm text-muted">
              Archived invoices and quotations. You can restore them to active bills or permanently remove them.
            </p>
          </div>
          {trashed.length > 0 ? (
            <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted shadow-2xs">
              {trashed.length} archived
            </span>
          ) : null}
        </div>

        {trashed.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-line bg-surface p-8 text-center shadow-2xs">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-cream text-olive shadow-2xs">
              <Archive className="size-6" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-ink">Trash is empty</h3>
            <p className="mt-1 text-sm text-muted max-w-xs mx-auto">
              Any deleted invoices, quotations or tax bills will appear here before permanent deletion.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {trashed.map((doc) => {
              const kindBadge =
                doc.kind === "gst"
                  ? { label: "GST Tax", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" }
                  : doc.kind === "quotation"
                    ? { label: "Quote", cls: "bg-amber-50 text-amber-800 border-amber-200" }
                    : { label: "Invoice", cls: "bg-brass/10 text-brass border-brass/20" };

              return (
                <li
                  key={doc.id}
                  className="beui-card rounded-2xl p-4 transition-all duration-200 hover:border-olive/40 hover:shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.2 text-[10px] font-semibold ${kindBadge.cls}`}>
                          {kindBadge.label} #{doc.number || "Draft"}
                        </span>
                        <span className="text-[11px] text-muted">
                          {formatDocDate(doc.date)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-base font-semibold text-ink">
                        {doc.customerName.trim() || doc.buyer.trim() || "No customer specified"}
                      </p>
                      <p className="text-xs text-muted">
                        Deleted {when(doc.updatedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-base font-bold tabular-nums text-ink">
                      {formatInr(billGrandTotal(doc))}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2.5">
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
                      <ArchiveRestore className="size-3.5" aria-hidden="true" />
                      Restore bill
                    </button>
                    {confirmId === doc.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="inline-flex min-h-8 items-center rounded-lg bg-danger-soft px-2.5 text-xs font-semibold text-danger active:scale-95"
                          onClick={() => {
                            deleteBillForever(doc.id);
                            setConfirmId("");
                            toast(`${docTitle(doc.kind)} No. ${doc.number || "—"} deleted forever`);
                          }}
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95"
                          aria-label="Keep in trash"
                          onClick={() => setConfirmId("")}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger active:scale-95"
                        onClick={() => setConfirmId(doc.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Delete forever
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
