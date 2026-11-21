"use client";

/**
 * Outage Claim — R9 W1 Part B4 (UC-T7).
 *
 * A trader who was mid-position during a platform outage files a claim
 * instead of arguing in support chat:
 *
 *   • the form pre-fills the closed trades inside the reported window
 *     (from `lib/trading/trading-store` — symbol + window filter) and
 *     attaches their ids as evidence, so the operator reviews the exact
 *     trades the trader sees;
 *   • submitting persists to `pfaas:trader:claims` (R10 — survives a
 *     hard reload) and publishes `appeal.claim-submitted` on the shared
 *     lifecycle log; the named consumers are the prop-admin
 *     `appeals-store` (→ appeals-queue rows, audited intake) and the
 *     trader inbox bridge;
 *   • verdicts come back through the same log (`appeal.accepted` /
 *     `appeal.rejected`) and are overlaid on read — there is no second
 *     write path that could make the queue and this list disagree.
 *
 * Honest demo copy: "(Demo) — a review agent will assess this claim".
 * Dates come only from the terra fixture helpers (§1 rule 5).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraTable,
  formatMoney,
} from "@/components/terra/terra-ui";
import { daysAgo } from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";
import { useTrading } from "@/lib/trading/trading-context";
import {
  submitOutageClaim,
  useOutageClaims,
  type OutageClaim,
  type PayoutRejection,
} from "@/lib/appeals/claims-store";

/** ISO → value for `<input type="datetime-local">` (local time, no tz). */
function toLocalInput(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value → ISO (invalid input → null). */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const STATUS_TONE: Record<OutageClaim["status"], "neutral" | "tertiary" | "success" | "error"> = {
  submitted: "neutral",
  "under-review": "tertiary",
  accepted: "success",
  rejected: "error",
};

const STATUS_LABEL: Record<OutageClaim["status"], string> = {
  submitted: "Submitted",
  "under-review": "Under review",
  accepted: "Accepted",
  rejected: "Rejected",
};

export function OutageClaimPage() {
  const { activeAccount } = useActiveAccount();
  const { closedTrades } = useTrading();
  const claims = useOutageClaims();

// Filter to only OutageClaim items (PayoutRejection doesn't have symbol, windowFrom, etc.)
const outageClaims = claims.filter((c): c is OutageClaim => "symbol" in c);

  // Symbols the trader actually traded — the claim is scoped to one.
  const symbols = useMemo(() => {
    const own = closedTrades.filter((t) => t.accountId === activeAccount.id);
    const list = [...new Set(own.map((t) => t.symbol))];
    return list.length ? list : ["EURUSD", "XAUUSD", "GBPUSD"];
  }, [closedTrades, activeAccount.id]);

  const [symbol, setSymbol] = useState(() => "");
  const effectiveSymbol = symbol || symbols[0];
  const [windowFrom, setWindowFrom] = useState(() => toLocalInput(daysAgo(1)));
  const [windowTo, setWindowTo] = useState(() => toLocalInput(daysAgo(0)));
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<OutageClaim | null>(null);

  // Pre-filled evidence: closed trades inside the reported window.
  const evidence = useMemo(() => {
    const from = fromLocalInput(windowFrom);
    const to = fromLocalInput(windowTo);
    return closedTrades.filter((t) => {
      if (t.accountId !== activeAccount.id) return false;
      if (t.symbol !== effectiveSymbol) return false;
      if (from && t.closedAt < from) return false;
      if (to && t.closedAt > to) return false;
      return true;
    });
  }, [closedTrades, activeAccount.id, effectiveSymbol, windowFrom, windowTo]);

  const evidencePnl = evidence.reduce((sum, t) => sum + t.pnl, 0);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const from = fromLocalInput(windowFrom);
    const to = fromLocalInput(windowTo);
    if (!from || !to) {
      setFormError("Pick both ends of the outage window.");
      return;
    }
    if (from >= to) {
      setFormError("The window start must be before its end.");
      return;
    }
    if (description.trim().length < 10) {
      setFormError("Describe what happened — at least a sentence (10 characters).");
      return;
    }
    setFormError(null);
    const claim = submitOutageClaim({
      accountId: activeAccount.id,
      symbol: effectiveSymbol,
      windowFrom: from,
      windowTo: to,
      description: description.trim(),
      tradeRefs: evidence.map((t) => t.id),
    });
    setSubmitted(claim);
    setDescription("");
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Outage Claim"
        description={`${activeAccount.name} • Login #${activeAccount.login} • report a platform outage affecting your trades`}
        actions={<TerraBadge tone="neutral">Claims &amp; appeals</TerraBadge>}
      />

      {/* Submission receipt — persisted, so it survives a reload (R10). */}
      {submitted && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border-2 border-primary/50 bg-surface-container-lowest p-6 outline-none"
          tabIndex={-1}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-headline text-lg font-bold text-on-surface">
                Claim {submitted.id} submitted
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                {submitted.symbol} · window {new Date(submitted.windowFrom).toLocaleString()} →{" "}
                {new Date(submitted.windowTo).toLocaleString()} ·{" "}
                {submitted.tradeRefs.length} trade(s) attached as evidence.
              </p>
            </div>
            <TerraBadge tone={STATUS_TONE[submitted.status]}>
              {STATUS_LABEL[submitted.status]}
            </TerraBadge>
          </div>
          <p className="mt-3 rounded-lg bg-surface-container-low p-3 text-sm text-on-surface">
            (Demo) — a review agent will assess this claim against the attached trades and the
            firm&apos;s rule versions. You will get an inbox message with the verdict and the
            reason.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle
              title="File a claim"
              description="Report an outage window — your closed trades in the window attach automatically as evidence."
            />
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Symbol
                  </span>
                  <select
                    value={effectiveSymbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-bold text-on-surface outline-none focus:border-primary"
                  >
                    {symbols.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Account
                  </span>
                  <p className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm font-bold text-on-surface">
                    {activeAccount.name} · #{activeAccount.login}
                  </p>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Window start
                  </span>
                  <input
                    type="datetime-local"
                    value={windowFrom}
                    onChange={(e) => setWindowFrom(e.target.value)}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-bold text-on-surface outline-none focus:border-primary"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Window end
                  </span>
                  <input
                    type="datetime-local"
                    value={windowTo}
                    onChange={(e) => setWindowTo(e.target.value)}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-bold text-on-surface outline-none focus:border-primary"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  What happened?
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Platform froze during news — positions could not be managed for ~10 minutes."
                  aria-describedby="claim-description-help"
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                />
                <span id="claim-description-help" className="text-xs text-on-surface-variant">
                  (Demo) — a review agent will assess this claim.
                </span>
              </label>

              {formError && (
                <p role="alert" className="text-sm font-bold text-error">
                  {formError}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Submit claim
                </button>
                <Link
                  href="/rules"
                  className="rounded-xl border border-outline-variant px-6 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-low"
                >
                  Review the rules first
                </Link>
              </div>
            </form>
          </TerraCard>
        </div>

        {/* Attached evidence — live from the trading store, not typed in. */}
        <div className="space-y-6">
          <TerraCard>
            <TerraSectionTitle
              title="Attached evidence"
              description={`Closed ${effectiveSymbol} trades for this account inside the window (Demo)`}
            />
            {evidence.length ? (
              <>
                <TerraTable
                  head={["Closed", "Lots", "Side", "P&L"]}
                  rows={evidence.map((t) => [
                    new Date(t.closedAt).toLocaleString(),
                    String(t.lots),
                    t.side,
                    formatMoney(t.pnl),
                  ])}
                />
                <p className="mt-3 text-sm font-bold text-on-surface">
                  {evidence.length} trade(s) · {formatMoney(evidencePnl)} net
                </p>
              </>
            ) : (
              <p className="text-sm text-on-surface-variant">
                No closed trades in this window — the claim can still be filed, but the review
                agent will only have your description to work with.
              </p>
            )}
          </TerraCard>
        </div>
      </div>

      {/* Your claims — persisted; verdicts overlay from the shared log. */}
      <TerraCard>
        <TerraSectionTitle
          title="Your claims"
          description="Submitted claims and their verdicts — persisted across reloads (Demo)"
        />
        {outageClaims.length ? (
          <div className="space-y-3">
            {outageClaims.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-outline-variant/60 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-headline text-sm font-bold text-on-surface">
                    {c.id} · {c.symbol}
                  </span>
                  <TerraBadge tone={STATUS_TONE[c.status]}>
                    {STATUS_LABEL[c.status]}
                  </TerraBadge>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Window {new Date(c.windowFrom).toLocaleString()} →{" "}
                  {new Date(c.windowTo).toLocaleString()} · {c.tradeRefs.length} trade(s) ·
                  submitted {new Date(c.submittedAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-on-surface">{c.description}</p>
                {c.verdictReason && (
                  <p className="mt-2 rounded-lg bg-surface-container-low p-2 text-sm text-on-surface">
                    <span className="font-bold">Verdict reason:</span> {c.verdictReason}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">
            No claims filed yet. If an outage hit your trades, file one above — the evidence
            attaches automatically.
          </p>
        )}
      </TerraCard>
    </div>
  );
}
