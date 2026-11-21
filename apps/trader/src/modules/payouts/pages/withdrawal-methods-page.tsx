"use client";

/**
 * Withdrawal Methods — W1-01.
 *
 * CRUD + set-primary now write to the shared @/lib/payouts/payout-methods-store
 * so a method added here is selectable in /payout-request immediately and
 * after a full reload. The fixture is only the seed on first run.
 *
 * R12 Wave B — Rail taxonomy (T3), method-change security (T7), ownership proof (T8)
 */

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import {
  addPayoutMethod,
  editPayoutMethod,
  removePayoutMethod,
  setPrimaryPayoutMethod,
  type PayoutMethod,
  type RailType,
  usePayoutMethods,
  isValidRail,
  isValidIBAN,
  isValidCryptoAddress,
} from "@/lib/payouts/payout-methods-store";

const emptyForm = {
  name: "",
  detail: "",
  fee: "",
  eta: "",
  rail: "domestic" as RailType,
  // Rail-specific fields
  iban: "",
  bic: "",
  cryptoNetwork: "",
  destinationTag: "",
  sortCode: "",
  accountNumber: "",
  // Ownership proof filename
  ownershipProof: null as string | null,
};

const inputClass =
  "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm outline-none focus:border-primary";

export function WithdrawalMethodsPage() {
  const methods = usePayoutMethods();
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

  // Rail-specific field requirements
  const getRailFields = (rail: RailType) => {
    switch (rail) {
      case "swift":
        return ["iban", "bic"];
      case "sepa":
        return ["iban"];
      case "faster-payments":
        return ["sortCode", "accountNumber"];
      case "crypto":
        return ["cryptoNetwork", "destinationTag"];
      default:
        return [];
    }
  };

  // Validate rail-specific fields
  const validateRailFields = (rail: RailType, form: typeof emptyForm): string | null => {
    const requiredFields = getRailFields(rail);
    for (const field of requiredFields) {
      const value = form[field as keyof typeof form];
      if (!value || (typeof value === "string" && !value.trim())) {
        const labels: Record<string, string> = {
          iban: "IBAN",
          bic: "BIC/SWIFT",
          sortCode: "Sort Code",
          accountNumber: "Account Number",
          cryptoNetwork: "Crypto Network",
          destinationTag: "Destination Tag/Memo",
        };
        return `${labels[field] || field} is required for ${rail} rail.`;
      }
    }
    // Additional format validation
    if (rail === "swift" || rail === "sepa") {
      const iban = form.iban;
      if (iban && !isValidIBAN(iban)) {
        return "Invalid IBAN format.";
      }
    }
    if (rail === "crypto") {
      const network = form.cryptoNetwork;
      const address = form.destinationTag;
      if (network && network !== "other" && address && !isValidCryptoAddress(address, network)) {
        return "Invalid crypto address for selected network.";
      }
    }
    return null;
  };

  // IBAN validation (basic check)
  const isValidIBAN = (iban: string): boolean => {
    const clean = iban.replace(/\s/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(clean)) return false;
    // Modulo 97 check
    const rearranged = clean.slice(4) + clean.slice(0, 4);
    let mod = 0;
    for (const char of rearranged) {
      const val = char >= "A" ? char.charCodeAt(0) - 55 : parseInt(char, 10);
      mod = (mod * 10 + val) % 97;
    }
    return mod === 1;
  };

  const startAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
    setPendingRemoveId(null);
    setMode("add");
  };

  const startEdit = (m: PayoutMethod) => {
    setForm({
      name: m.name,
      detail: m.detail,
      fee: m.fee,
      eta: m.eta,
      rail: m.rail,
      iban: m.iban || "",
      bic: m.bic || "",
      cryptoNetwork: m.cryptoNetwork || "",
      destinationTag: m.destinationTag || "",
      sortCode: m.sortCode || "",
      accountNumber: m.accountNumber || "",
      ownershipProof: m.ownershipProof || null,
    });
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

    // R12 GAP-T3 — rail-specific field validation
    const railError = validateRailFields(form.rail, form);
    if (railError) {
      setFormError(railError);
      return;
    }

    if (mode === "add") {
      addPayoutMethod({
        name: form.name.trim(),
        detail: form.detail.trim(),
        fee: form.fee.trim() || "Varies",
        eta: form.eta.trim() || "1–3 business days",
        rail: form.rail,
        // Rail-specific fields for structured validation
        iban: form.iban || undefined,
        bic: form.bic || undefined,
        cryptoNetwork: form.cryptoNetwork || undefined,
        destinationTag: form.destinationTag || undefined,
        ownershipProof: form.ownershipProof ?? undefined,
        // Ownership proof recorded - mark as pending until verified by operator
      });
      flash(`"${form.name.trim()}" added as a withdrawal method.`);
    } else if (editingId) {
      editPayoutMethod(editingId, {
        name: form.name.trim(),
        detail: form.detail.trim(),
        fee: form.fee.trim() || "Varies",
        eta: form.eta.trim() || "1–3 business days",
        rail: form.rail,
        iban: form.iban || undefined,
        bic: form.bic || undefined,
        cryptoNetwork: form.cryptoNetwork || undefined,
        destinationTag: form.destinationTag || undefined,
        ownershipProof: form.ownershipProof || undefined,
      });
      flash(`"${form.name.trim()}" updated.`);
    }
    cancelForm();
  };

  const confirmRemove = (m: PayoutMethod) => {
    removePayoutMethod(m.id);
    setPendingRemoveId(null);
    flash(`"${m.name}" removed.`);
  };

  // R12 GAP-T7 — method-change security flow: require trader confirmation
  // (simulated 2FA step) before changing the primary payout method.
  const confirmSetPrimary = async (m: PayoutMethod) => {
    if (m.verification !== "verified") {
      flash(`Cannot set ${m.name} as primary — method is not verified.`);
      return;
    }
    // Simulated 2FA confirmation — in production this would be a real 2FA challenge.
    // Since the app has 2FA for login, we use a confirmation dialog as the
    // trader-facing confirmation step for this sensitive action.
    const confirmed = window.confirm(
      `Set "${m.name}" as primary payout method?\n\n` +
        `This is a security-sensitive action. Method verification: ${m.verification}.` +
        `\n\nThis action will trigger an inbox receipt for the Payouts Team.`
    );
    if (!confirmed) return;
    setPrimaryPayoutMethod(m.id);
    flash(`"${m.name}" is now your primary payout method.`);
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
            description="Persisted on this device — available everywhere payout methods are used."
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

              {/* Rail selector */}
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Rail type
                </span>
                <select
                  value={form.rail}
                  onChange={(e) => setForm((f) => ({ ...f, rail: e.target.value as RailType }))}
                  className={inputClass}
                >
                  <option value="domestic">Domestic</option>
                  <option value="swift">SWIFT</option>
                  <option value="sepa">SEPA</option>
                  <option value="faster-payments">Faster Payments</option>
                  <option value="crypto">Crypto</option>
                  <option value="other">Other</option>
                </select>
              </label>

              {/* Rail-specific fields - dynamic based on selected rail */}
              {getRailFields(form.rail).map((field) => {
                const labels: Record<string, string> = {
                  iban: "IBAN",
                  bic: "BIC/SWIFT",
                  sortCode: "Sort Code",
                  accountNumber: "Account Number",
                  cryptoNetwork: "Crypto Network",
                  destinationTag: "Destination Tag / Memo",
                };
                return (
                  <label key={field} className="block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      {labels[field]}
                    </span>
                    <input
                      value={form[field as keyof typeof form] ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [field]: e.target.value }))
                      }
                      placeholder={`e.g. ${labels[field]} ••••`}
                      className={inputClass}
                    />
                  </label>
                );
              })}

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

            {/* Ownership Proof Upload (R12 GAP-T8) */}
            <div className="border-t border-outline-variant/30 pt-4">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Ownership Proof (Optional)
                </span>
                <p className="text-xs text-on-surface-variant mb-2">
                  Upload a bank statement, card photo, or wallet signature to prove ownership.
                  Verified methods are required for primary selection.
                </p>
                <div
                  className="border-2 border-dashed border-outline-variant rounded-xl p-4 text-center hover:border-primary/50 transition-colors"
                  onClick={() => document.getElementById("ownership-proof")?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add("border-primary");
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove("border-primary");
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("border-primary");
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      setForm((f) => ({ ...f, ownershipProof: file.name }));
                    }
                  }}
                >
                  <input
                    id="ownership-proof"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setForm((f) => ({ ...f, ownershipProof: file.name }));
                      }
                    }}
                  />
                  {form.ownershipProof ? (
                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-on-surface">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>{form.ownershipProof}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setForm((f) => ({ ...f, ownershipProof: null }));
                        }}
                        className="text-error hover:text-error/80"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg className="w-8 h-8 mx-auto text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm text-on-surface-variant">Drag & drop or click to upload</p>
                      <p className="text-xs text-on-surface-variant">PDF, PNG, JPG (max 5MB)</p>
                    </>
                  )}
                </div>
              </label>
            </div>

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
                    <Badge
                      variant={
                        m.verification === "verified"
                          ? "secondary"
                          : m.verification === "rejected"
                            ? "destructive"
                            : "outline"
                      }
                      className={`text-[10px] ${
                        m.verification === "verified"
                          ? "bg-secondary text-secondary-foreground"
                          : m.verification === "rejected"
                            ? "bg-destructive text-white"
                            : "border-warning/30 bg-warning/10 text-warning"
                      }`}
                    >
                      {m.verification === "verified"
                        ? "Verified"
                        : m.verification === "rejected"
                          ? "Rejected"
                          : m.verification === "pending"
                            ? "Pending"
                            : "Unverified"}
                    </Badge>
                    {/* Rail type badge */}
                    <Badge
                      variant="outline"
                      className="text-[10px] border-primary/30 bg-primary/5 text-primary"
                    >
                      {m.rail.charAt(0).toUpperCase() + m.rail.slice(1).replace("-", " ")}
                    </Badge>
                    {/* Ownership proof badge */}
                    {m.ownership && (
                      <Badge
                        variant={
                          m.ownership === "verified"
                            ? "secondary"
                            : m.ownership === "rejected"
                              ? "destructive"
                              : "outline"
                        }
                        className={`text-[10px] ${
                          m.ownership === "verified"
                            ? "bg-secondary text-secondary-foreground"
                            : m.ownership === "rejected"
                              ? "bg-destructive text-white"
                              : "border-info/30 bg-info/10 text-info"
                        }`}
                      >
                        Ownership: {m.ownership.charAt(0).toUpperCase() + m.ownership.slice(1)}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 break-all text-xs text-on-surface-variant">
                    {m.detail}
                  </p>
                  {/* Show rail-specific details */}
                  {(m.rail === "swift" || m.rail === "sepa") && m.iban && (
                    <p className="mt-1 text-xs text-on-surface-variant font-mono">
                      IBAN: {m.iban.replace(/(\w{4})/g, "$1 ").trim()} {m.bic ? `• BIC: ${m.bic}` : ""}
                    </p>
                  )}
                  {m.rail === "crypto" && (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Network: {m.cryptoNetwork || "—"}{m.destinationTag ? ` • Tag: ${m.destinationTag}` : ""}
                    </p>
                  )}
                  {m.rail === "faster-payments" && (
                    <p className="mt-1 text-xs text-on-surface-variant font-mono">
                      Sort: {m.sortCode || "—"} • Acc: {m.accountNumber || "—"}
                    </p>
                  )}
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
                    onClick={() => confirmSetPrimary(m)}
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
    </div>
  );
}
