import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  Check,
  Cloud,
  CloudOff,
  Copy,
  Download,
  Eye,
  FileText,
  ImagePlus,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  Share2,
  Trash2,
  Truck,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { BillSheet } from "@/features/bills/components/bill-sheet";
import { CloudPanel } from "@/features/bills/components/cloud-panel";
import { CustomersPanel } from "@/features/bills/components/customers-panel";
import { MenuDrawer } from "@/features/bills/components/menu-drawer";
import { PhoneBackup } from "@/features/bills/components/phone-backup";
import { TrashPanel } from "@/features/bills/components/trash-panel";
import {
  type Bill,
  type CopyType,
  type Customer,
  type DocKind,
  type Line,
  type Profile,
  billGrandTotal,
  copyLabel,
  billAdvance,
  billBalance,
  billWords,
  docTitle,
  gstTotals,
  lineAmount,
  lineFormula,
  measuresFromSizes,
  partSqft,
  pdfFileName,
  sameCustomer,
  blankSize,
  advanceLabel,
  balanceLabel,
} from "@/features/bills/model";
import { formatDocDate, formatGstDate, formatInr } from "@/features/bills/money";
import { readSignature } from "@/features/bills/signature";
import { startCloudSync, useCloudSync } from "@/features/bills/cloud-sync";
import { useBills } from "@/features/bills/store";

type Screen =
  | "bills"
  | "bill"
  | "preview"
  | "letterhead"
  | "customers"
  | "trash"
  | "cloud";

const menuBar: { id: Screen; label: string }[] = [
  { id: "bills", label: "Bills" },
  { id: "bill", label: "Bill" },
  { id: "preview", label: "Preview" },
];

const inputClass =
  "min-h-10 w-full min-w-0 rounded-xl border border-line bg-field px-3 py-1.5 text-base text-ink outline-none transition-colors placeholder:text-[#a39a8b] focus-visible:border-olive focus-visible:ring-2 focus-visible:ring-olive/15";
const valueClass =
  "min-h-9 w-full min-w-0 rounded-lg border border-line bg-field px-2 py-1 text-base text-ink outline-none tabular-nums transition-colors placeholder:text-[#a39a8b] focus-visible:border-olive focus-visible:ring-2 focus-visible:ring-olive/15";
const btnPrimary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-olive px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-olive-deep active:bg-olive-deep disabled:opacity-40";
const btnGhost =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-hover active:bg-active disabled:opacity-40";
const btnQuiet =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-muted transition-colors duration-150 hover:bg-hover hover:text-ink active:bg-active";
const btnSmall =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-150 hover:bg-hover active:bg-active disabled:opacity-40";

function dockChip(on: boolean): string {
  return `inline-flex min-h-10 flex-1 select-none items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-medium transition-colors ${
    on
      ? "bg-olive text-white shadow-sm"
      : "text-muted hover:text-ink hover:bg-hover active:bg-active"
  }`;
}

function buyerTitle(bill: Bill): string {
  const named = bill.customerName.trim();
  if (named) return named;
  const line = bill.buyer.split("\n").map((part) => part.trim()).find(Boolean);
  return line || "No customer yet";
}

type KindFilter = "all" | DocKind;

function matchesQuery(doc: Bill, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const kindWords =
    doc.kind === "gst" ? "gst tax invoice" : doc.kind === "invoice" ? "invoice" : "quote quotation";
  const hay = [
    doc.number,
    doc.customerName,
    doc.buyer,
    doc.phone,
    kindWords,
    `${kindWords} ${doc.number}`,
    ...doc.lines.map((line) => line.description),
    ...doc.lines.map((line) => line.hsn),
  ]
    .join("\n")
    .toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}

export function Desk() {
  const profile = useBills((s) => s.profile);
  const docs = useBills((s) => s.docs);
  const trashed = useBills((s) => s.trashed);
  const customers = useBills((s) => s.customers);
  const activeId = useBills((s) => s.activeId);
  const setProfile = useBills((s) => s.setProfile);
  const restoreLetterhead = useBills((s) => s.restoreLetterhead);
  const patchBill = useBills((s) => s.patchBill);
  const patchLine = useBills((s) => s.patchLine);
  const addLine = useBills((s) => s.addLine);
  const removeLine = useBills((s) => s.removeLine);
  const newBill = useBills((s) => s.newBill);
  const duplicateBill = useBills((s) => s.duplicateBill);
  const deleteBill = useBills((s) => s.deleteBill);
  const restoreBill = useBills((s) => s.restoreBill);
  const newFromPrevious = useBills((s) => s.newFromPrevious);
  const pickCustomer = useBills((s) => s.pickCustomer);
  const selectBill = useBills((s) => s.selectBill);
  const loadSample = useBills((s) => s.loadSample);

  const [screen, setScreen] = useState<Screen>("bills");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [sigError, setSigError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [canPrint, setCanPrint] = useState(false);
  const [printCopyType, setPrintCopyType] = useState<CopyType | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setCanPrint(true);
    startCloudSync();
  }, []);

  const bill = docs.find((doc) => doc.id === activeId) ?? null;

  useEffect(() => {
    setConfirmDelete(false);
  }, [bill?.id]);

  useEffect(() => {
    document.title = bill ? pdfFileName(bill) : "AV Interior — Invoice & Quote";
  }, [bill]);

  useEffect(() => {
    const fit = () => {
      const sheet = document.querySelector<HTMLElement>(".print-root .sheet");
      if (!sheet) return;
      const pageH = (297 * 96) / 25.4;
      sheet.style.removeProperty("zoom");
      const natural = sheet.offsetHeight;
      if (natural > pageH + 1) sheet.style.setProperty("zoom", String(pageH / natural));
    };
    const clear = () => {
      document.querySelector<HTMLElement>(".print-root .sheet")?.style.removeProperty("zoom");
    };
    window.addEventListener("beforeprint", fit);
    window.addEventListener("afterprint", clear);
    return () => {
      window.removeEventListener("beforeprint", fit);
      window.removeEventListener("afterprint", clear);
    };
  }, []);

  useEffect(() => {
    const clearCopy = () => setPrintCopyType(null);
    window.addEventListener("afterprint", clearCopy);
    return () => window.removeEventListener("afterprint", clearCopy);
  }, []);

  const visible = [...docs]
    .filter((doc) => (kindFilter === "all" ? true : doc.kind === kindFilter))
    .filter((doc) => matchesQuery(doc, query))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  function start(kind: DocKind) {
    newBill(kind);
    setScreen("bill");
    setMenuOpen(false);
    setConfirmDelete(false);
  }

  function openScreen(next: Screen) {
    setScreen(next);
    setMenuOpen(false);
    setConfirmDelete(false);
  }

  function duplicateNow(id?: string) {
    duplicateBill(id);
    openScreen("bill");
    toast("Copy created", {
      description: "Edit it and the cloud workspace saves it automatically.",
    });
  }

  function moveToTrash(id: string) {
    const doc = docs.find((item) => item.id === id);
    deleteBill(id);
    openScreen("bills");
    if (!doc) return;
    toast(`${docTitle(doc.kind)} No. ${doc.number || "—"} moved to Trash`, {
      description: "You can restore it any time.",
      action: {
        label: "Undo",
        onClick: () => {
          restoreBill(id);
          openScreen("bill");
        },
      },
      duration: 8000,
    });
  }

  function printCopy(copy: CopyType) {
    if (!bill) return;
    setPrintCopyType(copy);
    toast(copy === "transport" ? "Transport copy ready" : "Original copy ready", {
      description: "Choose Save as PDF in the print dialog.",
    });
    window.setTimeout(() => window.print(), 220);
  }

  async function shareBill() {
    if (!bill) return;
    const summary = `${docTitle(bill.kind)} ${bill.number.trim() || "draft"} · ${formatInr(
      billGrandTotal(bill),
    )}${bill.customerName.trim() ? ` · ${bill.customerName.trim()}` : ""}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: pdfFileName(bill), text: summary });
        return;
      }
      await navigator.clipboard.writeText(summary);
      toast("Bill summary copied", { description: "Paste it into WhatsApp, email or SMS." });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not share this bill", {
        description: "Use Download PDF and attach the file instead.",
      });
    }
  }

  return (
    <div className="desk flex min-h-dvh flex-col overflow-x-clip bg-canvas text-ink">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 max-w-5xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <span className="grid size-7 shrink-0 place-items-center text-ink">
            <HouseMark />
          </span>
          <p className="min-w-0 truncate text-sm font-semibold tracking-tight">{profile.name || "AV Interior"}</p>
          <nav className="ml-2 hidden items-center md:flex" aria-label="Sections">
            {menuBar.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`min-h-10 rounded-lg px-3 text-sm transition-colors ${
                  screen === item.id
                    ? "bg-selected font-medium text-ink"
                    : "text-muted hover:bg-hover hover:text-ink"
                }`}
                onClick={() => openScreen(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <CloudBadge onOpen={() => openScreen("cloud")} />
            <span className="hidden md:contents">
              <button type="button" className={btnPrimary} disabled={!bill} onClick={() => window.print()}>
                Save PDF
              </button>
            </span>
            <button
              type="button"
              className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive/40 active:bg-active md:inline-flex"
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-controls="app-menu-drawer"
              aria-expanded={menuOpen}
              onClick={(event) => {
                menuTriggerRef.current = event.currentTarget;
                setMenuOpen(true);
              }}
            >
              <MenuIcon />
            </button>
          </div>
        </div>
      </header>

      <main className={(screen === "bill" || screen === "preview") && bill ? "with-dock-total" : "with-dock"}>
      {screen === "preview" ? (
        <section className="sheet-column mx-auto w-full max-w-5xl">
          {bill ? (
            <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Preview</p>
                <p className="mt-0.5 truncate text-sm font-medium text-ink">
                  {docTitle(bill.kind)} {bill.number.trim() || "Draft"}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-muted">
                A4 · print ready
              </span>
            </div>
          ) : null}
          <div className="px-2 py-3 sm:px-5 sm:py-4">
            {bill ? (
              <ScaledBill>
                <BillSheet bill={bill} profile={profile} />
              </ScaledBill>
            ) : (
              <p className="text-muted">Create a bill to see it here.</p>
            )}
          </div>
        </section>
      ) : screen === "customers" ? (
        <CustomersPanel />
      ) : screen === "trash" ? (
        <TrashPanel onRestored={() => openScreen("bill")} />
      ) : screen === "cloud" ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-6 sm:px-6 md:pb-10">
          <CloudPanel />
          <PhoneBackup />
        </div>
      ) : bill ? (
        <Editor
          screen={screen}
          bill={bill}
          visible={visible}
          query={query}
          setQuery={setQuery}
          kindFilter={kindFilter}
          setKindFilter={setKindFilter}
          customers={customers}
          docs={docs}
          activeId={activeId}
          onSelect={(id) => {
            selectBill(id);
            openScreen("bill");
          }}
          onStart={start}
          onUsePrevious={() => {
            newFromPrevious();
            openScreen("bill");
          }}
          onPickCustomer={pickCustomer}
          onDuplicate={duplicateNow}
          onPrintCopy={printCopy}
          onShare={() => void shareBill()}
          onTrash={moveToTrash}
          onOpenTrash={() => openScreen("trash")}
          trashedCount={trashed.length}
          patchBill={patchBill}
          patchLine={patchLine}
          addLine={addLine}
          removeLine={removeLine}
          profile={profile}
          setProfile={setProfile}
          restoreLetterhead={restoreLetterhead}
          sigError={sigError}
          setSigError={setSigError}
          fileRef={fileRef}
        />
      ) : (
        <EmptyDesk onStart={start} onLoadSample={loadSample} />
      )}
      </main>

      {(screen === "bill" || screen === "preview") && bill ? (
        <div
          className="no-print fixed inset-x-0 z-30 px-3 md:hidden"
          style={{ bottom: "calc(4.3rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 py-2 pl-4 pr-2 shadow-[0_18px_45px_-18px_rgba(74,58,34,0.25)] backdrop-blur-xl">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Grand total</p>
              <p className="truncate text-[15px] font-semibold tabular-nums">{formatInr(billGrandTotal(bill))}</p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-olive px-4 text-[13px] font-semibold text-white active:bg-olive-deep"
              onClick={() => window.print()}
            >
              Save PDF
            </button>
          </div>
        </div>
      ) : null}

      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
        aria-label="Sections"
      >
        <div className="dock-metal mx-auto flex max-w-md items-center gap-1 rounded-full p-1">
          <button
            type="button"
            className={dockChip(menuOpen)}
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-controls="app-menu-drawer"
            aria-expanded={menuOpen}
            onClick={(event) => {
              menuTriggerRef.current = event.currentTarget;
              setMenuOpen(true);
            }}
          >
            <MenuIcon className="size-3.5" />
            Menu
          </button>
          {(
            [
              { id: "bills" as const, label: "Bills", icon: FileText },
              { id: "preview" as const, label: "Preview", icon: Eye },
            ]
          ).map((item) => {
            const Icon = item.icon;
            const on = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={dockChip(on)}
                aria-current={on ? "page" : undefined}
                onClick={() => openScreen(item.id)}
              >
                <Icon className="size-3.5" strokeWidth={on ? 2.25 : 1.9} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            className="inline-flex min-h-10 flex-1 select-none items-center justify-center gap-1 rounded-xl bg-olive px-1 text-[11px] font-semibold text-white transition-colors hover:bg-olive-deep active:bg-olive-deep"
            aria-label="Create a new bill"
            onClick={() => start(bill?.kind ?? "invoice")}
          >
            <Plus className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
            New
          </button>
        </div>
      </nav>
      {canPrint && bill
        ? createPortal(
            <div className="print-root">
              <div className="print-frame">
                <BillSheet
                  bill={
                    bill.kind === "gst" && printCopyType
                      ? { ...bill, copyType: printCopyType }
                      : bill
                  }
                  profile={profile}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
      <MenuDrawer
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          if (!open) setConfirmDelete(false);
        }}
        screen={screen}
        bill={bill}
        trashedCount={trashed.length}
        confirmDelete={confirmDelete}
        returnFocusRef={menuTriggerRef}
        onNew={start}
        onDuplicate={() => duplicateNow()}
        onDownload={() => window.print()}
        onShare={() => void shareBill()}
        onPrintCopy={printCopy}
        onOpenScreen={openScreen}
        onRequestDelete={() => setConfirmDelete(true)}
        onCancelDelete={() => setConfirmDelete(false)}
        onConfirmDelete={() => {
          setConfirmDelete(false);
          if (bill) moveToTrash(bill.id);
        }}
      />
      <Toaster
        position="top-center"
        closeButton
        theme="light"
        toastOptions={{ className: "no-print" }}
      />
    </div>
  );
}

function EmptyDesk({
  onStart,
  onLoadSample,
}: {
  onStart: (kind: DocKind) => void;
  onLoadSample: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col justify-center gap-3 rounded-3xl border border-line bg-surface p-6 my-10">
      <h2 className="text-2xl font-semibold tracking-tight">No bills yet</h2>
      <p className="text-muted">Start a blank invoice, quotation or GST invoice, or bring back the sample chair bill.</p>
      <button type="button" className={`${btnPrimary} w-full`} onClick={() => onStart("invoice")}>
        New invoice
      </button>
      <button type="button" className={`${btnGhost} w-full`} onClick={() => onStart("quotation")}>
        New quotation
      </button>
      <button type="button" className={`${btnGhost} w-full`} onClick={() => onStart("gst")}>
        New GST invoice
      </button>
      <button type="button" className={`${btnQuiet} w-full`} onClick={onLoadSample}>
        Load sample bill
      </button>
    </div>
  );
}

function Editor({
  screen,
  bill,
  visible,
  query,
  setQuery,
  kindFilter,
  setKindFilter,
  customers,
  docs,
  activeId,
  onSelect,
  onStart,
  onUsePrevious,
  onPickCustomer,
  onDuplicate,
  onPrintCopy,
  onShare,
  onTrash,
  onOpenTrash,
  trashedCount,
  patchBill,
  patchLine,
  addLine,
  removeLine,
  profile,
  setProfile,
  restoreLetterhead,
  sigError,
  setSigError,
  fileRef,
}: {
  screen: Screen;
  bill: Bill;
  visible: Bill[];
  query: string;
  setQuery: (value: string) => void;
  kindFilter: KindFilter;
  setKindFilter: (value: KindFilter) => void;
  customers: Customer[];
  docs: Bill[];
  activeId: string;
  onSelect: (id: string) => void;
  onStart: (kind: DocKind) => void;
  onUsePrevious: () => void;
  onPickCustomer: (id: string) => void;
  onDuplicate: (id?: string) => void;
  onPrintCopy: (copy: CopyType) => void;
  onShare: () => void;
  onTrash: (id: string) => void;
  onOpenTrash: () => void;
  trashedCount: number;
  patchBill: (patch: Partial<Omit<Bill, "id" | "lines">>) => void;
  patchLine: (lineId: string, patch: Partial<Omit<Line, "id">>) => void;
  addLine: () => void;
  removeLine: (lineId: string) => void;
  profile: Profile;
  setProfile: (patch: Partial<Profile>) => void;
  restoreLetterhead: () => void;
  sigError: string;
  setSigError: (value: string) => void;
  fileRef: RefObject<HTMLInputElement | null>;
}) {
  const grand = billGrandTotal(bill);
  const gst = bill.kind === "gst" ? gstTotals(bill) : null;
  const advance = billAdvance(bill);
  const balance = billBalance(bill);
  const earlier = docs
    .filter(
      (doc) =>
        doc.id !== bill.id &&
        ((bill.customerId && doc.customerId === bill.customerId) ||
          sameCustomer(doc.customerName, bill.customerName)),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const filters: { id: KindFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "invoice", label: "Invoices" },
    { id: "quotation", label: "Quotes" },
    { id: "gst", label: "GST" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-6 sm:px-6 md:gap-6 md:pb-10">
      {screen === "bills" ? (
      <div>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
            <p className="mt-0.5 text-sm text-muted">Invoices, quotations and GST invoices.</p>
          </div>
          <span className="hidden shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted sm:inline">
            {docs.length} total
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className={btnPrimary} onClick={() => onStart("invoice")}>
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            Invoice
          </button>
          <button type="button" className={btnGhost} onClick={() => onStart("quotation")}>
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            Quote
          </button>
          <button type="button" className={btnGhost} onClick={() => onStart("gst")}>
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            GST
          </button>
        </div>
        <input
          className={`${inputClass} mt-3`}
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search invoice, quote, or customer"
          aria-label="Search bills"
        />
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-full border border-line bg-field p-1" role="tablist" aria-label="Filter bills">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={kindFilter === item.id}
              className={`min-h-11 rounded-full px-2 text-sm transition-colors ${
                kindFilter === item.id ? "bg-active font-medium text-ink" : "text-muted hover:text-ink"
              }`}
              onClick={() => setKindFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 px-1">
          <p className="text-xs text-muted">
            {visible.length} {visible.length === 1 ? "bill" : "bills"}
          </p>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-muted transition-colors hover:bg-hover hover:text-ink"
            onClick={onOpenTrash}
          >
            <Archive className="size-4" aria-hidden="true" />
            Trash{trashedCount ? ` (${trashedCount})` : ""}
          </button>
        </div>
        <ul className="mt-3 space-y-1 rounded-2xl border border-line bg-surface p-1.5">
          {visible.length === 0 ? (
            <li className="px-1 py-3 text-sm text-muted">No bills match that search.</li>
          ) : (
            visible.map((doc) => {
              const active = doc.id === activeId;
              return (
                <li key={doc.id}>
                  <div
                    className={`flex items-center gap-0.5 rounded-xl pr-1 ${
                      active ? "bg-selected" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(doc.id)}
                      className="flex min-h-16 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-hover active:bg-active"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold tracking-wide text-brass">
                          {docTitle(doc.kind)} No. {doc.number} · {formatDocDate(doc.date)}
                        </span>
                        <span className="block truncate text-base">{buyerTitle(doc)}</span>
                      </span>
                      <span className="shrink-0 text-base font-semibold tabular-nums">{formatInr(billGrandTotal(doc))}</span>
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink active:bg-active"
                      aria-label={`Duplicate ${docTitle(doc.kind)} ${doc.number || "draft"}`}
                      onClick={() => onDuplicate(doc.id)}
                    >
                      <Copy className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-danger hover:bg-danger-soft active:bg-active"
                      aria-label={`Move ${docTitle(doc.kind)} ${doc.number || "draft"} to trash`}
                      onClick={() => onTrash(doc.id)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
      ) : null}

      {screen === "bill" ? (
      <>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{docTitle(bill.kind)}</p>
          <h1 className="mt-0.5 truncate text-2xl font-semibold tracking-tight">{bill.number.trim() || "New bill"}</h1>
        </div>
        <span className="max-w-[45%] shrink-0 truncate rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted">
          {buyerTitle(bill)}
        </span>
      </div>
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-base font-semibold tracking-tight">Date and number</h2>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            className={bill.kind === "invoice" ? btnPrimary : btnGhost}
            onClick={() => patchBill({ kind: "invoice" })}
          >
            Invoice
          </button>
          <button
            type="button"
            className={bill.kind === "quotation" ? btnPrimary : btnGhost}
            onClick={() => patchBill({ kind: "quotation" })}
          >
            Quote
          </button>
          <button
            type="button"
            className={bill.kind === "gst" ? btnPrimary : btnGhost}
            onClick={() => patchBill({ kind: "gst" })}
          >
            GST
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Date</span>
            <input
              type="date"
              className={inputClass}
              value={bill.date}
              onChange={(event) => patchBill({ date: event.target.value })}
            />
            <span className="mt-0.5 block text-xs text-muted">
              Prints as {bill.kind === "gst" ? formatGstDate(bill.date) : formatDocDate(bill.date)}
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">
              {bill.kind === "gst"
                ? "GST invoice number"
                : bill.kind === "invoice"
                  ? "Invoice number"
                  : "Quotation number"}
            </span>
            <input
              className={inputClass}
              value={bill.number}
              onChange={(event) => patchBill({ number: event.target.value })}
              aria-label={
                bill.kind === "gst"
                  ? "GST invoice number"
                  : bill.kind === "invoice"
                    ? "Invoice number"
                    : "Quotation number"
              }
              autoComplete="off"
              placeholder={bill.kind === "gst" ? "e.g. 15/2025-26" : undefined}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-base font-semibold tracking-tight">Customer</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">Saved customer</span>
          <select
            className={inputClass}
            value={customers.some((customer) => customer.id === bill.customerId) ? bill.customerId : ""}
            onChange={(event) => {
              if (event.target.value) onPickCustomer(event.target.value);
            }}
          >
            <option value="">Choose a customer to fill this bill</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-muted">Customer name</span>
          <input
            className={inputClass}
            value={bill.customerName}
            onChange={(event) => patchBill({ customerName: event.target.value })}
            placeholder="Name printed above the address"
            autoComplete="name"
            autoCapitalize="words"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-muted">Address</span>
          <textarea
            className={`${inputClass} min-h-16 py-2`}
            value={bill.buyer}
            onChange={(event) => patchBill({ buyer: event.target.value })}
            placeholder="Street, area, city"
            autoCapitalize="sentences"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="col-span-2 block min-w-0">
            <span className="mb-1 block text-sm font-medium text-muted">Phone</span>
            <input
              className={inputClass}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={bill.phone}
              onChange={(event) => patchBill({ phone: event.target.value })}
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-sm font-medium text-muted">State</span>
            <input
              className={inputClass}
              value={bill.state}
              onChange={(event) => patchBill({ state: event.target.value })}
              autoComplete="off"
              autoCapitalize="words"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-sm font-medium text-muted">Code</span>
            <input
              className={inputClass}
              inputMode="numeric"
              value={bill.code}
              onChange={(event) => patchBill({ code: event.target.value })}
              autoComplete="off"
            />
          </label>
          {bill.kind === "gst" ? (
            <label className="col-span-2 block min-w-0">
              <span className="mb-1 block text-sm font-medium text-muted">Customer GSTIN</span>
              <input
                className={inputClass}
                value={bill.buyerGstin}
                onChange={(event) => patchBill({ buyerGstin: event.target.value.toUpperCase() })}
                placeholder="15-character GSTIN"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </label>
          ) : null}
        </div>
        <div className="mt-3">
          <button type="button" className={`${btnGhost} w-full sm:w-auto`} onClick={onUsePrevious} disabled={earlier.length === 0}>
            <Copy className="size-4" aria-hidden="true" />
            New from their last bill
          </button>
          {earlier.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No earlier bill for this customer yet. The name is kept for the next one.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {earlier.slice(0, 6).map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left hover:bg-hover active:bg-active"
                    onClick={() => onSelect(doc.id)}
                  >
                    <span className="min-w-0 truncate text-sm">
                      {docTitle(doc.kind)} No. {doc.number} · {formatDocDate(doc.date)}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatInr(billGrandTotal(doc))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-base font-semibold tracking-tight">Document actions</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGhost} onClick={() => onDuplicate()}>
            <Copy className="size-4" aria-hidden="true" />
            Copy
          </button>
          <button type="button" className={btnGhost} onClick={() => window.print()}>
            <Download className="size-4" aria-hidden="true" />
            Download PDF
          </button>
          <button type="button" className={btnGhost} onClick={onShare}>
            <Share2 className="size-4" aria-hidden="true" />
            Share
          </button>
        </div>

        {bill.kind === "gst" ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="mb-1 block text-sm font-medium text-muted">Destination</span>
                <input
                  className={inputClass}
                  value={bill.destination}
                  onChange={(event) => patchBill({ destination: event.target.value })}
                  placeholder="Thoothukudi"
                  autoComplete="off"
                  autoCapitalize="words"
                />
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-sm font-medium text-muted">Vehicle number</span>
                <input
                  className={inputClass}
                  value={bill.vehicleNumber}
                  onChange={(event) => patchBill({ vehicleNumber: event.target.value.toUpperCase() })}
                  placeholder="TN 69 AB 1234"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              </label>
              <div className="sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-muted">Printed copy label</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={bill.copyType === "original" ? btnPrimary : btnGhost}
                    onClick={() => patchBill({ copyType: "original" })}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    className={bill.copyType === "transport" ? btnPrimary : btnGhost}
                    onClick={() => patchBill({ copyType: "transport" })}
                  >
                    Transport
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted">
              {copyLabel(bill.copyType)}. Destination and vehicle print in the top-right block.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} onClick={() => onPrintCopy("original")}>
                <Truck className="size-4" aria-hidden="true" />
                Print original copy
              </button>
              <button type="button" className={btnGhost} onClick={() => onPrintCopy("transport")}>
                <Truck className="size-4" aria-hidden="true" />
                Duplicate transport copy
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-2.5 text-base font-semibold tracking-tight">Items</h2>
        <ul className="space-y-2.5">
          {bill.lines.map((line, index) => (
            <li key={line.id} className="rounded-2xl border border-line bg-canvas p-2">
              <div className="flex items-start gap-2">
                <span className="mt-2 w-5 shrink-0 text-sm font-semibold tabular-nums text-muted">{index + 1}</span>
                <textarea
                  className={`${inputClass} min-h-11 py-1.5 leading-tight`}
                  value={line.description}
                  onChange={(event) => patchLine(line.id, { description: event.target.value })}
                  placeholder="Description of goods"
                  aria-label={`Description ${index + 1}`}
                  rows={2}
                  autoCapitalize="sentences"
                />
                <button
                  type="button"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-danger hover:bg-danger-soft active:bg-active"
                  aria-label={`Remove line ${index + 1}`}
                  onClick={() => removeLine(line.id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
              {bill.kind === "gst" ? (
                <label className="mt-2 block min-w-0">
                  <span className="mb-0.5 block text-[11px] font-medium text-muted">HSN/SAC</span>
                  <input
                    className={valueClass}
                    inputMode="numeric"
                    enterKeyHint="next"
                    value={line.hsn}
                    aria-label={`HSN or SAC ${index + 1}`}
                    placeholder="76109090"
                    autoComplete="off"
                    onChange={(event) =>
                      patchLine(line.id, {
                        hsn: event.target.value.replace(/[^0-9]/g, "").slice(0, 12),
                      })
                    }
                  />
                  <span className="mt-0.5 block text-[11px] text-muted">Saved with this item and printed on the tax invoice.</span>
                </label>
              ) : null}
              {line.sizes.length === 0 ? (
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <label className="block min-w-0">
                    <span className="mb-0.5 block text-[11px] font-medium text-muted">Qty</span>
                    <input
                      className={valueClass}
                      inputMode="decimal"
                      enterKeyHint="done"
                      value={line.quantity}
                      aria-label={`Quantity ${index + 1}`}
                      onChange={(event) => patchLine(line.id, { quantity: event.target.value })}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-0.5 block text-[11px] font-medium text-muted">Rate</span>
                    <input
                      className={valueClass}
                      inputMode="decimal"
                      enterKeyHint="done"
                      value={line.rate}
                      aria-label={`Rate ${index + 1}`}
                      onChange={(event) => patchLine(line.id, { rate: event.target.value })}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-0.5 block text-[11px] font-medium text-muted">Sq.ft</span>
                    <input
                      className={valueClass}
                      inputMode="decimal"
                      enterKeyHint="done"
                      value={line.sqft}
                      aria-label={`Square feet ${index + 1}`}
                      onChange={(event) => patchLine(line.id, { sqft: event.target.value })}
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-2 space-y-1.5">
                  <span className="block text-xs font-medium text-muted">
                    {bill.kind === "quotation" ? "Sizes on this item" : "Sizes"}
                  </span>
                  {line.sizes.map((part, sizeIndex) => {
                    const area = partSqft(part);
                    return (
                      <div key={part.id} className="rounded-lg bg-cream p-1.5">
                        <div className="grid grid-cols-[minmax(0,1fr)_4.75rem_2.25rem] items-end gap-1.5">
                          <label className="block min-w-0">
                            <span className="mb-0.5 block text-[11px] font-medium text-muted">Size (ft)</span>
                            <input
                              className={valueClass}
                              value={part.size}
                              placeholder="10 x 8"
                              enterKeyHint="next"
                              aria-label={`Size ${index + 1}.${sizeIndex + 1}`}
                              onChange={(event) => {
                                const sizes = line.sizes.map((item) =>
                                  item.id === part.id ? { ...item, size: event.target.value } : item,
                                );
                                const measures = measuresFromSizes(sizes);
                                patchLine(line.id, measures ? { sizes, ...measures } : { sizes });
                              }}
                            />
                          </label>
                          <label className="block min-w-0">
                            <span className="mb-0.5 block text-[11px] font-medium text-muted">Qty</span>
                            <input
                              className={valueClass}
                              inputMode="decimal"
                              enterKeyHint="done"
                              value={part.quantity}
                              aria-label={`Size quantity ${index + 1}.${sizeIndex + 1}`}
                              onChange={(event) => {
                                const sizes = line.sizes.map((item) =>
                                  item.id === part.id ? { ...item, quantity: event.target.value } : item,
                                );
                                const measures = measuresFromSizes(sizes);
                                patchLine(line.id, measures ? { sizes, ...measures } : { sizes });
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-danger hover:bg-danger-soft active:bg-active"
                            aria-label={`Remove size ${index + 1}.${sizeIndex + 1}`}
                            onClick={() => {
                              const sizes = line.sizes.filter((item) => item.id !== part.id);
                              const measures = measuresFromSizes(sizes);
                              patchLine(line.id, measures ? { sizes, ...measures } : { sizes });
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {area != null ? `${area} sq.ft, rounded` : ""}
                        </span>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className={`${btnSmall} w-full sm:w-auto`}
                    onClick={() => patchLine(line.id, { sizes: [...line.sizes, blankSize(line.quantity || "1")] })}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add size
                  </button>
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="block min-w-0">
                      <span className="mb-0.5 block text-[11px] font-medium text-muted">Rate</span>
                      <input
                        className={valueClass}
                        inputMode="decimal"
                        enterKeyHint="done"
                        value={line.rate}
                        aria-label={`Rate ${index + 1}`}
                        onChange={(event) => patchLine(line.id, { rate: event.target.value })}
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-0.5 block text-[11px] font-medium text-muted">Sq.ft</span>
                      <input
                        className={valueClass}
                        inputMode="decimal"
                        enterKeyHint="done"
                        value={line.sqft}
                        aria-label={`Square feet ${index + 1}`}
                        onChange={(event) => patchLine(line.id, { sqft: event.target.value })}
                      />
                    </label>
                  </div>
                </div>
              )}
              {line.sizes.length === 0 ? (
                <button
                  type="button"
                  className={`${btnSmall} mt-2 w-full sm:w-auto`}
                  onClick={() => patchLine(line.id, { sizes: [blankSize(line.quantity || "1")] })}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add size
                </button>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
                <span className="text-xs text-muted">{lineFormula(line)}</span>
                <div className="flex items-center gap-1">
                  {line.manual ? (
                    <input
                      className={`${valueClass} w-24 text-right`}
                      inputMode="decimal"
                      enterKeyHint="done"
                      value={line.manualAmount}
                      aria-label={`Amount ${index + 1}`}
                      onChange={(event) => patchLine(line.id, { manualAmount: event.target.value })}
                    />
                  ) : (
                    <span className="px-1 text-base font-semibold tabular-nums">{formatInr(lineAmount(line))}</span>
                  )}
                  <button
                    type="button"
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink active:bg-active"
                    aria-label={line.manual ? "Use calculated amount" : "Type amount yourself"}
                    onClick={() =>
                      patchLine(line.id, {
                        manual: !line.manual,
                        manualAmount: line.manual ? line.manualAmount : formatInr(lineAmount(line)),
                      })
                    }
                  >
                    {line.manual ? (
                      <Lock className="size-4" aria-hidden="true" />
                    ) : (
                      <LockOpen className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className={`${btnSmall} mt-2 w-full sm:w-auto`} onClick={addLine}>
          <Plus className="size-4" aria-hidden="true" />
          Add line
        </button>
        <p className="mt-2 text-sm text-muted">
          {bill.kind === "quotation"
            ? "A quotation lists every size under the item, each rounded, then added into Sq.ft. The rate is per sq.ft."
            : "An invoice can take several sizes on one line. They are rounded, added, and printed as one size list. Leave sizes empty and Sq.ft as “-” to charge the rate only."}
        </p>
        <div className="mt-2.5 rounded-2xl border border-line bg-canvas px-3.5 py-3">
          {gst ? (
            <>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Taxable value</span>
                  <span className="tabular-nums">{formatInr(gst.taxable)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">CGST 9%</span>
                  <span className="tabular-nums">{formatInr(gst.cgst)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">SGST 9%</span>
                  <span className="tabular-nums">{formatInr(gst.sgst)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Rounded off</span>
                  <span className="tabular-nums">{formatInr(gst.roundOff)}</span>
                </div>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3 border-t border-line pt-2">
                <span className="text-sm text-muted">Grand total</span>
                <span className="text-right text-2xl font-semibold tracking-tight tabular-nums">
                  {formatInr(gst.rounded)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{billWords(bill)}</p>
              <p className="mt-1 text-xs text-muted">
                GST at 9% CGST + 9% SGST, rounded to the nearest rupee.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3">
                <span className="text-sm text-muted">Grand total</span>
                <span className="text-right text-2xl font-semibold tracking-tight tabular-nums">
                  {formatInr(grand)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{billWords(bill)}</p>
              {advance !== 0 ? (
                <div className="mt-1.5 flex items-end justify-between gap-3 border-t border-line pt-1.5">
                  <span className="text-sm text-muted">{balanceLabel(bill.kind)}</span>
                  <span className="text-lg font-semibold tabular-nums">{formatInr(balance)}</span>
                </div>
              ) : null}
            </>
          )}
        </div>
        {!gst ? (
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-muted">{advanceLabel(bill.kind)}</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={bill.advance}
              placeholder="0"
              aria-label={advanceLabel(bill.kind)}
              onChange={(event) => patchBill({ advance: event.target.value })}
            />
            <span className="mt-1 block text-sm text-muted">
              {balanceLabel(bill.kind)} {formatInr(balance)}.{" "}
              {bill.kind === "invoice"
                ? "Leave blank if nothing was paid yet. Prints only when an advance is entered."
                : "Optional booking amount. Prints only when it is entered."}
            </span>
          </label>
        ) : null}
      </section>
      </>
      ) : null}

      {screen === "letterhead" ? (
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-base font-semibold tracking-tight">Letterhead</h2>
        <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Company name</span>
            <input
              className={inputClass}
              value={profile.name}
              onChange={(event) => setProfile({ name: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Address</span>
            <textarea
              className={`${inputClass} min-h-20 py-2`}
              value={profile.address}
              onChange={(event) => setProfile({ address: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">GSTIN</span>
            <input
              className={inputClass}
              value={profile.gstin}
              spellCheck={false}
              onChange={(event) => setProfile({ gstin: event.target.value })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">Mobile</span>
              <input
                className={inputClass}
                inputMode="tel"
                value={profile.mobile}
                onChange={(event) => setProfile({ mobile: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">Email</span>
              <input
                className={inputClass}
                type="email"
                value={profile.email}
                onChange={(event) => setProfile({ email: event.target.value })}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Account name</span>
            <input
              className={inputClass}
              value={profile.accountName}
              onChange={(event) => setProfile({ accountName: event.target.value })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">Account number</span>
              <input
                className={inputClass}
                value={profile.accountNo}
                spellCheck={false}
                onChange={(event) => setProfile({ accountNo: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">IFSC</span>
              <input
                className={inputClass}
                value={profile.ifsc}
                spellCheck={false}
                onChange={(event) => setProfile({ ifsc: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">Branch</span>
              <input
                className={inputClass}
                value={profile.branch}
                onChange={(event) => setProfile({ branch: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">Bank</span>
              <input
                className={inputClass}
                value={profile.bank}
                onChange={(event) => setProfile({ bank: event.target.value })}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Invoice declaration</span>
            <textarea
              className={`${inputClass} min-h-20 py-2`}
              value={profile.declarationInvoice}
              onChange={(event) => setProfile({ declarationInvoice: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Quotation declaration</span>
            <textarea
              className={`${inputClass} min-h-20 py-2`}
              value={profile.declarationQuote}
              onChange={(event) => setProfile({ declarationQuote: event.target.value })}
            />
          </label>
          <div>
            <span className="mb-1 block text-sm font-medium text-muted">Authorised signature</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void readSignature(file)
                  .then((signature) => {
                    setSigError("");
                    setProfile({ signature });
                  })
                  .catch(() => setSigError("Could not read that image. Try a PNG or JPG."));
              }}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <button type="button" className={`${btnGhost} w-full sm:w-auto`} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" aria-hidden="true" />
                Upload signature
              </button>
              {profile.signature ? (
                <button type="button" className={`${btnQuiet} w-full sm:w-auto`} onClick={() => setProfile({ signature: "" })}>
                  Remove
                </button>
              ) : null}
            </div>
            {profile.signature ? (
              <img
                src={profile.signature}
                alt="Signature preview"
                className="mt-2 h-14 w-full object-contain object-left"
              />
            ) : (
              <p className="mt-2 text-sm text-muted">The signature from your original bill is used until you upload another.</p>
            )}
            {sigError ? <p className="mt-2 text-sm text-ink">{sigError}</p> : null}
          </div>
          <button type="button" className={`${btnQuiet} w-full sm:w-auto`} onClick={restoreLetterhead}>
            Restore original letterhead
          </button>
      </section>
      ) : null}
    </div>
  );
}

function CloudBadge({ onOpen }: { onOpen: () => void }) {
  const status = useCloudSync((s) => s.status);
  const pending = useCloudSync((s) => s.pending);
  const saving = status === "saving" || pending > 0;
  const label =
    status === "error"
      ? "Not synced"
      : status === "saved"
        ? "Saved"
        : saving
          ? "Saving"
          : "Syncing";
  const Icon =
    status === "error"
      ? CloudOff
      : status === "saved"
        ? Check
        : status === "connecting" || saving
          ? Loader2
          : Cloud;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Cloud workspace: ${label}. Open cloud settings`}
      title={`Cloud workspace: ${label}`}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors hover:bg-hover ${
        status === "error" ? "text-danger" : "text-muted hover:text-ink"
      }`}
    >
      <Icon
        className={`size-4 ${
          status === "connecting" || saving ? "animate-spin" : ""
        }`}
        aria-hidden="true"
      />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ScaledBill({ children }: { children: ReactNode }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const slot = slotRef.current;
    const sheet = sheetRef.current;
    if (!slot || !sheet) return;
    const measure = () => {
      const naturalW = sheet.offsetWidth || 1;
      const naturalH = sheet.offsetHeight || 1;
      const next = Math.min(1, slot.clientWidth / naturalW);
      setScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
      const nextH = Math.ceil(naturalH * next);
      setHeight((prev) => (prev === nextH ? prev : nextH));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={slotRef} className="preview-slot">
      <div className="fit-sizer" style={{ height }}>
        <div className="fit-scale" style={{ transform: `scale(${scale})` }}>
          <div ref={sheetRef}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function MenuIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function HouseMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
      <path d="M5 14.5 16 5l11 9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 13.5V27h16V13.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M14 27v-6h4v6" fill="none" stroke="var(--color-brass)" strokeWidth="1.8" />
    </svg>
  );
}
