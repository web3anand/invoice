import { useState } from "react";
import { Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import {
  type Bill,
  type Customer,
  sameCustomer,
} from "@/features/bills/model";
import { useBills } from "@/features/bills/store";

const inputClass =
  "min-h-12 w-full min-w-0 rounded-xl border border-line bg-field px-3 text-base text-ink outline-none transition-colors placeholder:text-[#a39a8b] focus-visible:border-olive focus-visible:ring-2 focus-visible:ring-olive/15";
const btnPrimary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-olive px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-olive-deep active:bg-olive-deep disabled:opacity-40";
const btnGhost =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-hover active:bg-active disabled:opacity-40";
const btnQuiet =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-muted transition-colors duration-150 hover:bg-hover hover:text-ink active:bg-active";

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
  const selected = customers.find((customer) => customer.id === selectedId) ?? null;

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
      description: "Bills keep their customer details.",
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
            <h2 className="text-lg font-semibold tracking-tight">Customers</h2>
            <p className="mt-1 text-sm text-muted">
              Save the people you bill once, then pick them on any invoice or quotation.
            </p>
          </div>
          <button type="button" className={`${btnPrimary} shrink-0`} onClick={create}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </button>
        </div>

        {customers.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
            <UserRound className="mx-auto size-6 text-muted" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted">
              No saved customers yet. Add one here, or type a name on a bill and it will be
              remembered automatically.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {customers.map((customer) => {
              const count = usedOn(docs, customer);
              return (
                <li key={customer.id}>
                  <div className="flex items-center gap-2 pr-2">
                    <button
                      type="button"
                      className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-hover active:bg-active"
                      onClick={() =>
                        setSelectedId((current) =>
                          current === customer.id ? "" : customer.id,
                        )
                      }
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-hover text-sm font-semibold">
                        {(customer.name.trim()[0] ?? "?").toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base">
                          {customer.name.trim() || "Unnamed customer"}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {[customer.phone, count ? `${count} bill${count === 1 ? "" : "s"}` : "No bills yet"]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <Pencil className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    </button>
                    {confirmDelete === customer.id ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          className="min-h-9 rounded-lg bg-danger-soft px-3 text-xs font-medium text-danger"
                          onClick={() => remove(customer)}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
                          aria-label="Keep customer"
                          onClick={() => setConfirmDelete("")}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-danger hover:bg-danger-soft active:bg-active"
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
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Edit customer</h3>
              <p className="text-sm text-muted">
                Changes save automatically to the cloud workspace.
              </p>
            </div>
            <button
              type="button"
              className={btnQuiet}
              onClick={() => setSelectedId("")}
            >
              Close
            </button>
          </div>
          <div className="mt-3 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">Name</span>
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
              <span className="mb-1 block text-sm font-medium text-muted">Address</span>
              <textarea
                className={`${inputClass} min-h-24 py-3`}
                value={selected.address}
                autoCapitalize="sentences"
                onChange={(event) =>
                  patchCustomer(selected.id, { address: event.target.value })
                }
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">Phone</span>
              <input
                className={inputClass}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={selected.phone}
                onChange={(event) =>
                  patchCustomer(selected.id, { phone: event.target.value })
                }
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0">
                <span className="mb-1 block text-sm font-medium text-muted">State</span>
                <input
                  className={inputClass}
                  value={selected.state}
                  onChange={(event) =>
                    patchCustomer(selected.id, { state: event.target.value })
                  }
                />
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-sm font-medium text-muted">Code</span>
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
          <p className="mt-3 text-xs text-muted">
            Deleting a saved customer does not change bills already made for them — their
            name and address stay printed on those bills.
          </p>
          <button
            type="button"
            className={`${btnGhost} mt-3 w-full sm:w-auto`}
            onClick={() => setConfirmDelete(selected.id)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Remove saved customer
          </button>
        </section>
      ) : null}
    </div>
  );
}
