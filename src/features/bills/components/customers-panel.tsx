import { useState } from "react";
import {
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  type Bill,
  type Customer,
  sameCustomer,
} from "@/features/bills/model";
import { useBills } from "@/features/bills/store";

const inputClass =
  "min-h-10 w-full min-w-0 rounded-xl border border-line/80 bg-field/80 px-3.5 py-2 text-base text-ink outline-none transition-all duration-200 placeholder:text-muted/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] hover:border-olive/40 hover:bg-surface focus-visible:border-olive focus-visible:bg-surface focus-visible:ring-4 focus-visible:ring-olive/10";
const btnPrimary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-olive px-4 text-sm font-semibold text-white shadow-[0_2px_10px_-2px_rgba(101,77,40,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:bg-olive-deep hover:shadow-[0_4px_14px_-2px_rgba(101,77,40,0.55)] active:scale-[0.97] active:bg-olive-deep disabled:opacity-40 disabled:pointer-events-none";
const btnGhost =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line/85 bg-surface/90 px-3.5 text-sm font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:border-olive/40 hover:bg-hover active:scale-[0.97] active:bg-active disabled:opacity-40 disabled:pointer-events-none";
const btnQuiet =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-muted transition-all duration-200 hover:bg-hover hover:text-ink active:scale-[0.97] active:bg-active disabled:opacity-40";

function usedOn(docs: Bill[], customer: Customer): number {
  return docs.filter(
    (doc) =>
      doc.customerId === customer.id ||
      sameCustomer(doc.customerName, customer.name),
  ).length;
}

export function CustomersPanel() {
  const customers = useBills((s) => s.customers);
  const docs = useBills((s) => s.docs);
  const addCustomer = useBills((s) => s.addCustomer);
  const patchCustomer = useBills((s) => s.patchCustomer);
  const deleteCustomer = useBills((s) => s.deleteCustomer);
  const [selectedId, setSelectedId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [query, setQuery] = useState("");

  const selected = customers.find((customer) => customer.id === selectedId) ?? null;

  const filtered = customers.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q)
    );
  });

  function create() {
    const customer: Customer = {
      id: crypto.randomUUID(),
      name: "New customer",
      address: "",
      phone: "",
      state: "TamilNadu",
      code: "33",
    };
    addCustomer(customer);
    setSelectedId(customer.id);
  }

  function remove(customer: Customer) {
    deleteCustomer(customer.id);
    setSelectedId("");
    setConfirmDelete("");
    toast("Saved customer removed", {
      description: "Existing bills retain their customer details.",
      action: {
        label: "Undo",
        onClick: () => {
          addCustomer(customer);
          setSelectedId(customer.id);
        },
      },
      duration: 7000,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-6 sm:px-6 md:pb-10">
      <section>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink">Customers</h2>
            <p className="mt-0.5 text-sm text-muted">
              Directory of clients. Saved clients can be picked on any bill with one tap.
            </p>
          </div>
          <button type="button" className={`${btnPrimary} shrink-0`} onClick={create}>
            <Plus className="size-4" aria-hidden="true" />
            Add Customer
          </button>
        </div>

        {customers.length > 0 ? (
          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              className={`${inputClass} pl-9 pr-9`}
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search saved customers by name, phone, or address..."
              aria-label="Search customers"
            />
            {query ? (
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        ) : null}

        {customers.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-line bg-surface p-8 text-center shadow-2xs">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-cream text-olive shadow-2xs">
              <Users className="size-6" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-ink">No saved customers yet</h3>
            <p className="mt-1 text-sm text-muted max-w-sm mx-auto leading-relaxed">
              Add your frequent customers here, or simply type a customer name when writing an invoice and it will be remembered automatically.
            </p>
            <button type="button" className={`${btnPrimary} mt-4`} onClick={create}>
              <Plus className="size-4" />
              Add First Customer
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-6 text-center shadow-2xs">
            <p className="text-sm text-muted">No customers match "{query}".</p>
            <button
              type="button"
              className={`${btnQuiet} mt-2 text-xs`}
              onClick={() => setQuery("")}
            >
              Clear search
            </button>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {filtered.map((customer) => {
              const count = usedOn(docs, customer);
              const isSelected = selectedId === customer.id;
              return (
                <li key={customer.id}>
                  <div
                    className={`beui-card flex items-center gap-1.5 rounded-2xl p-1.5 transition-all duration-200 hover:border-olive/40 hover:shadow-xs ${
                      isSelected ? "border-olive/60 bg-selected/40 shadow-xs" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-hover/50 active:bg-active"
                      onClick={() =>
                        setSelectedId((current) =>
                          current === customer.id ? "" : customer.id,
                        )
                      }
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cream text-sm font-bold text-olive shadow-2xs border border-line/60">
                        {(customer.name.trim()[0] ?? "?").toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-base font-semibold text-ink">
                            {customer.name.trim() || "Unnamed customer"}
                          </span>
                          {count > 0 ? (
                            <span className="rounded-full border border-line/80 bg-field px-2 py-0.2 text-[9.5px] font-semibold text-olive">
                              {count} {count === 1 ? "bill" : "bills"}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {[customer.phone, customer.address].filter(Boolean).join(" · ") || "No address yet"}
                        </span>
                      </span>
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-hover hover:text-ink">
                        <Pencil className="size-4" aria-hidden="true" />
                      </span>
                    </button>
                    {confirmDelete === customer.id ? (
                      <div className="flex shrink-0 items-center gap-1.5 pr-1">
                        <button
                          type="button"
                          className="min-h-8 rounded-xl bg-danger-soft px-2.5 text-xs font-semibold text-danger active:scale-95"
                          onClick={() => remove(customer)}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-xl text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95"
                          aria-label="Keep customer"
                          onClick={() => setConfirmDelete("")}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:text-danger hover:bg-danger-soft active:scale-95 mr-1"
                        aria-label={`Delete ${customer.name || "customer"} from saved customers`}
                        onClick={() => setConfirmDelete(customer.id)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selected ? (
        <section className="beui-card rounded-3xl p-5 shadow-xs sm:p-6">
          <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-ink">
                  {selected.name || "Edit Customer"}
                </h3>
                {selected.code ? (
                  <span className="rounded-md bg-cream px-1.5 py-0.2 text-[10px] font-semibold text-olive">
                    Code: {selected.code}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Changes save automatically to the cloud workspace.
              </p>
            </div>
            <button
              type="button"
              className={btnQuiet}
              onClick={() => setSelectedId("")}
            >
              <X className="size-4" />
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-3.5">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted uppercase tracking-wider">Customer Name</span>
              <input
                className={inputClass}
                value={selected.name}
                autoComplete="name"
                autoCapitalize="words"
                onChange={(event) =>
                  patchCustomer(selected.id, { name: event.target.value })
                }
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted uppercase tracking-wider">Billing Address</span>
              <textarea
                className={`${inputClass} min-h-24 py-2.5`}
                value={selected.address}
                autoCapitalize="sentences"
                placeholder="Street address, locality, city"
                onChange={(event) =>
                  patchCustomer(selected.id, { address: event.target.value })
                }
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted uppercase tracking-wider">Phone Number</span>
              <input
                className={inputClass}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={selected.phone}
                onChange={(event) =>
                  patchCustomer(selected.id, { phone: event.target.value })
                }
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0">
                <span className="mb-1 block text-xs font-semibold text-muted uppercase tracking-wider">State</span>
                <input
                  className={inputClass}
                  value={selected.state}
                  onChange={(event) =>
                    patchCustomer(selected.id, { state: event.target.value })
                  }
                />
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-xs font-semibold text-muted uppercase tracking-wider">State Code</span>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={selected.code}
                  onChange={(event) =>
                    patchCustomer(selected.id, { code: event.target.value })
                  }
                />
              </label>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted leading-relaxed">
            Deleting a saved customer does not alter bills already made for them — their name and address stay preserved on those bills.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-danger transition-colors hover:bg-danger-soft active:scale-95"
              onClick={() => setConfirmDelete(selected.id)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Remove saved customer
            </button>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setSelectedId("")}
            >
              Done editing
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
