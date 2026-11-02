import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Cloud,
  Copy,
  Download,
  FilePlus2,
  FileText,
  Printer,
  ReceiptText,
  Share2,
  Trash2,
  Truck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode, Ref, RefObject } from "react";
import { useEffect, useRef } from "react";
import { type Bill, type CopyType, type DocKind, docTitle } from "@/features/bills/model";

type MenuScreen =
  | "bills"
  | "bill"
  | "preview"
  | "letterhead"
  | "customers"
  | "trash"
  | "cloud";

export function MenuDrawer({
  open,
  onOpenChange,
  screen,
  bill,
  trashedCount,
  confirmDelete,
  returnFocusRef,
  onNew,
  onDuplicate,
  onDownload,
  onShare,
  onPrintCopy,
  onOpenScreen,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screen: MenuScreen;
  bill: Bill | null;
  trashedCount: number;
  confirmDelete: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
  onNew: (kind: DocKind) => void;
  onDuplicate: () => void;
  onDownload: () => void;
  onShare: () => void;
  onPrintCopy: (copy: CopyType) => void;
  onOpenScreen: (screen: MenuScreen) => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const dangerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmDelete) return;
    const frame = requestAnimationFrame(() => cancelRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [confirmDelete]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="menu-overlay no-print fixed inset-0 z-50 bg-[#2b2418]/35 backdrop-blur-[6px]" />
        <Dialog.Content
          id="app-menu-drawer"
          className="menu-panel no-print fixed inset-y-0 right-0 z-50 flex h-dvh w-[min(23rem,88vw)] flex-col border-l border-line/80 bg-surface/96 text-ink shadow-[-24px_0_60px_-24px_rgba(74,58,34,0.22)] backdrop-blur-xl outline-none"
          onCloseAutoFocus={(event) => {
            if (returnFocusRef.current?.isConnected) {
              event.preventDefault();
              returnFocusRef.current.focus();
            }
          }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line/80 px-5 pb-4 pt-[calc(1.2rem+env(safe-area-inset-top))]">
            <div className="min-w-0">
              <Dialog.Title className="text-xl font-bold tracking-tight text-ink">
                Menu
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted">
                Create, print and manage your workspace bills.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive/40 active:scale-95"
                aria-label="Close menu"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-2.5 py-2">
            <Group label="Create">
              <MenuItem
                icon={FilePlus2}
                label="New invoice"
                hint="Blank invoice with your saved letterhead"
                onClick={() => onNew("invoice")}
              />
              <MenuItem
                icon={FileText}
                label="New quotation"
                hint="Estimate for a customer"
                onClick={() => onNew("quotation")}
              />
              <MenuItem
                icon={ReceiptText}
                label="New GST invoice"
                hint="Tax invoice with vehicle and GSTIN"
                onClick={() => onNew("gst")}
              />
            </Group>

            {bill ? (
              <Group label={`This ${docTitle(bill.kind).toLowerCase()}`}>
                <MenuItem
                  icon={Copy}
                  label="Copy this bill"
                  hint="Make a duplicate and keep editing"
                  onClick={onDuplicate}
                />
                <MenuItem
                  icon={Download}
                  label="Download PDF"
                  hint="Open the print dialog and save as PDF"
                  onClick={onDownload}
                />
                <MenuItem
                  icon={Share2}
                  label="Share bill"
                  hint="Send a summary with the total"
                  onClick={onShare}
                />
                {bill.kind === "gst" ? (
                  <>
                    <MenuItem
                      icon={Printer}
                      label="Print original copy"
                      hint="Original for recipient"
                      onClick={() => onPrintCopy("original")}
                    />
                    <MenuItem
                      icon={Truck}
                      label="Print transport copy"
                      hint="Duplicate for transporter"
                      onClick={() => onPrintCopy("transport")}
                    />
                  </>
                ) : null}
              </Group>
            ) : (
              <p className="mx-2 mt-3 rounded-2xl border border-dashed border-line bg-canvas/80 px-3 py-3 text-xs text-muted">
                Open a bill to copy, print or share it.
              </p>
            )}

            <Group label="Workspace">
              <MenuItem
                icon={Users}
                label="Customers"
                hint="Saved names, addresses and GSTIN"
                active={screen === "customers"}
                onClick={() => onOpenScreen("customers")}
              />
              <MenuItem
                icon={Trash2}
                label="Trash"
                hint={
                  trashedCount
                    ? `${trashedCount} bill${trashedCount === 1 ? "" : "s"} can be restored`
                    : "Deleted bills stay here"
                }
                active={screen === "trash"}
                onClick={() => onOpenScreen("trash")}
              />
              <MenuItem
                icon={Building2}
                label="Letterhead"
                hint="Company details, signature and terms"
                active={screen === "letterhead"}
                onClick={() => onOpenScreen("letterhead")}
              />
              <MenuItem
                icon={Cloud}
                label="Cloud & backup"
                hint="Cloud autosave and phone backup"
                active={screen === "cloud"}
                onClick={() => onOpenScreen("cloud")}
              />
            </Group>

            {bill ? (
              <Group label="Danger zone">
                <MenuItem
                  icon={AlertTriangle}
                  label="Move to trash"
                  hint="You can restore it later"
                  danger
                  closeOnClick={false}
                  buttonRef={dangerRef}
                  onClick={onRequestDelete}
                />
                {confirmDelete ? (
                  <div className="mx-1 mt-1 rounded-2xl border border-danger-line bg-danger-soft p-3.5 shadow-2xs">
                    <p className="text-sm font-semibold text-danger">
                      Move this bill to Trash?
                    </p>
                    <p className="mt-0.5 text-xs text-danger-muted leading-relaxed">
                      You can restore it from Trash any time.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        ref={cancelRef}
                        type="button"
                        className="min-h-9 rounded-xl border border-danger-line bg-surface px-3 text-xs font-semibold text-danger transition-colors hover:bg-danger-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30 active:scale-95"
                        onClick={() => {
                          onCancelDelete();
                          requestAnimationFrame(() => dangerRef.current?.focus());
                        }}
                      >
                        Cancel
                      </button>
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          className="min-h-9 rounded-xl bg-danger px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-danger-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 active:scale-95"
                          onClick={onConfirmDelete}
                        >
                          Move to trash
                        </button>
                      </Dialog.Close>
                    </div>
                  </div>
                ) : null}
              </Group>
            ) : null}
          </div>

          <div className="border-t border-line/80 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Cloud autosave active
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted">
              Changes save automatically to your Postgres cloud database.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="pb-1">
      <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  hint,
  active = false,
  danger = false,
  closeOnClick = true,
  buttonRef,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  active?: boolean;
  danger?: boolean;
  closeOnClick?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  onClick: () => void;
}) {
  const content = (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group flex min-h-12 w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive/40 active:scale-[0.98] ${
        danger
          ? "text-danger hover:bg-danger-soft/60 active:bg-danger-soft"
          : active
            ? "border border-line/60 bg-selected/80 font-semibold text-ink shadow-2xs"
            : "text-ink hover:bg-hover/60 active:bg-active"
      }`}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-xl transition-all duration-200 ${
          danger
            ? "bg-danger-soft text-danger group-hover:bg-danger-hover"
            : active
              ? "bg-olive text-white shadow-xs"
              : "border border-line/50 bg-cream/70 text-olive group-hover:scale-105 group-hover:bg-cream"
        }`}
      >
        <Icon className="size-4" strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{label}</span>
        {hint ? (
          <span
            className={`mt-0.5 block truncate text-[11px] font-normal leading-tight ${
              danger ? "text-danger-muted" : "text-muted"
            }`}
          >
            {hint}
          </span>
        ) : null}
      </span>
      {active ? (
        <span className="shrink-0 rounded-full border border-line/80 bg-field px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted">
          Here
        </span>
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted" aria-hidden="true" />
      )}
    </button>
  );

  return closeOnClick ? <Dialog.Close asChild>{content}</Dialog.Close> : content;
}
