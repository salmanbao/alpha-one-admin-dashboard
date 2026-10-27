"use client";

/**
 * Withdrawal Methods — converted from stitch_screens/withdrawal_methods
 * Configured payout methods with add / edit / remove (two-step confirm)
 * and set-as-primary actions (PRD §3.10 — frontend-only demo).
 */

import { useState } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { withdrawalMethods } from "@/lib/fixtures/terra-fixtures";

type Method = (typeof withdrawalMethods)[number];

const emptyForm = { name: "", detail: "", fee: "", eta: "" };

const inputClass =
  "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm outline-none focus:border-primary";

export function WithdrawalMethodsPage() {
  const [methods, setMethods] = useState<Method[]>(withdrawalMethods);
  const [mode, setMode] = useState<"view" | "add" | "edit">("view");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  const startAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
    setPendingRemoveId(null);
    setMode("add");
  };

  const startEdit = (m: Method) => {
    setForm({ name: m.name, detail: m.detail, fee: m.fee, eta: m.eta });
    setEditingId(m.id);
    setFormError(null);
    setPendingRemoveId(null);
    setMode("edit");
  };

  const cancelForm = () => {
    setMode("view");
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.detail.trim()) {
      setFormError("Method name and account/wallet details are required.");
      return;
    }
    if (mode === "add") {
      const method: Method = {
        id: `wm-custom-${Date.now().toString(36)}`,
        name: form.name.trim(),
        detail: form.detail.trim(),
        fee: form.fee.trim() || "Varies",
        eta: form.eta.trim() || "1–3 business days",
        primary: false,
      };
      setMethods((prev) => [method, ...prev]);
      flash(`"${method.name}" added as a withdrawal method. (Demo)`);
    } else if (editingId) {
      setMethods((prev) =>
        prev.map((m) =>
          m.id === editingId
            ? {
                ...m,
                name: form.name.trim(),
                detail: form.detail.trim(),
                fee: form.fee.trim() || "Varies",
                eta: form.eta.trim() || "1–3 business days",
              }
            : m,
        ),
      );
      flash(`"${form.name.trim()}" updated. (Demo)`);
    }
    cancelForm();
  };

  const confirmRemove = (m: Method) => {
    setMethods((prev) => {
      const next = prev.filter((x) => x.id !== m.id);
      // Promote the first survivor if the primary method was removed.
      if (m.primary && next.length > 0) {
        next[0] = { ...next[0], primary: true };
      }
      return next;
    });
    setPendingRemoveId(null);
    flash(`"${m.name}" removed. (Demo)`);
  };

  const setPrimary = (m: Method) => {
    setMethods((prev) => prev.map((x) => ({ ...x, primary: x.id === m.id })));
    flash(`"${m.name}" is now your primary payout method. (Demo)`);
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Withdrawal Methods"
        description="Configure how you receive payouts"
        actions={
          mode === "view" ? (
            <button
              type="button"
              onClick={startAdd}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              + Add method
            </button>
          ) : (
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Cancel
            </button>
          )
        }
      />

      {notice && (
        <div
          role="status"
          className="rounded-xl bg-primary-fixed/50 px-4 py-3 text-sm font-semibold text-on-primary-fixed-variant"
        >
          {notice}
        </div>
      )}

      {mode !== "view" && (
        <TerraCard>
          <TerraSectionTitle
            title={mode === "add" ? "Add withdrawal method" : "Edit method"}
            description="Demo — saved to this page only, no backend call."
          />
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Method name
                </span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Bank Transfer (Wise)"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Account / wallet details
                </span>
                <input
                  value={form.detail}
                  onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
                  placeholder="e.g. IBAN •••• 4821 • Tom Allen • USD"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Fee
                </span>
                <input
                  value={form.fee}
                  onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))}
                  placeholder="e.g. $0 (covered by Terra)"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Payout speed
                </span>
                <input
                  value={form.eta}
                  onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))}
                  placeholder="e.g. 1–3 business days"
                  className={inputClass}
                />
              </label>
            </div>
            {formError && (
              <p role="alert" className="text-xs font-bold text-error">
                {formError}
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                {mode === "add" ? "Add method" : "Save changes"}
              </button>
            </div>
          </form>
        </TerraCard>
      )}

      {methods.length === 0 ? (
        <TerraEmpty
          title="No withdrawal methods"
          description="Add a bank account or crypto wallet to receive payouts."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {methods.map((m) => (
            <TerraCard key={m.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-on-surface">{m.name}</p>
                    {m.primary && (
                      <TerraBadge tone="primary" dot>
                        Primary
                      </TerraBadge>
                    )}
                  </div>
                  <p className="mt-0.5 break-all text-xs text-on-surface-variant">
                    {m.detail}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-surface-container-low p-3">
                  <span className="block font-bold uppercase tracking-wider text-on-surface-variant">
                    Fee
                  </span>
                  <span className="font-bold text-on-surface">{m.fee}</span>
                </div>
                <div className="rounded-xl bg-surface-container-low p-3">
                  <span className="block font-bold uppercase tracking-wider text-on-surface-variant">
                    Speed
                  </span>
                  <span className="font-bold text-on-surface">{m.eta}</span>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(m)}
                  className="rounded-xl bg-surface-container-low px-3.5 py-2 text-xs font-bold text-on-surface hover:bg-surface-container"
                >
                  Edit
                </button>
                {!m.primary && (
                  <button
                    type="button"
                    onClick={() => setPrimary(m)}
                    className="rounded-xl bg-surface-container-low px-3.5 py-2 text-xs font-bold text-on-surface hover:bg-surface-container"
                  >
                    Set as primary
                  </button>
                )}
                {pendingRemoveId === m.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => confirmRemove(m)}
                      className="rounded-xl bg-error-container px-3.5 py-2 text-xs font-bold text-on-error-container hover:bg-error-container/80"
                    >
                      Confirm remove?
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingRemoveId(null)}
                      className="rounded-xl px-3.5 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("view");
                      setPendingRemoveId(m.id);
                    }}
                    className="rounded-xl px-3.5 py-2 text-xs font-semibold text-error hover:text-error/80"
                  >
                    Remove
                  </button>
                )}
              </div>
            </TerraCard>
          ))}
        </div>
      )}

      <p className="text-[11px] text-on-surface-variant">
        Removing or editing methods is a demo — changes live in this page only
        and reset on reload.
      </p>
    </div>
  );
}
