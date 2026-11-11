"use client";

/**
 * Payout Request — converted from stitch_screens/payout_request
 * Payout request form with amount, method and submit.
 *
 * Gated to funded accounts: evaluation phases see why payouts are
 * locked, and the withdrawable cap is the trader's split of net
 * profit (not a % of balance). Flat accounts are blocked too.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraDrawdownMeter,
  TerraEmpty,
  TerraPageHeader,
  TerraProgress,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";
import {
  payoutEntitlement,
  terraPayouts,
  terraRiskLimits,
} from "@/lib/fixtures/terra-fixtures";
import { useSyncActiveAccount } from "@/lib/platform/account-context";
import {
  MIN_PAYOUT_DAYS,
  PayoutSummaryStrip,
  buildPayoutCriteria,
  minPayout,
  tradedDaysFor,
  type PayoutCriterion,
} from "@/components/terra/payout-summary-strip";
import { type PayoutMethod, usePayoutMethods } from "@/lib/payouts/payout-methods-store";
import { addPayoutRequest, cancelPayoutRequest, usePayoutRequests } from "@/lib/payouts/payout-requests-store";

/**
 * Pre-request eligibility checklist (audit #4, HIGH): the payout gates
 * are shown *before* the trader fills the form, so nobody discovers a
 * blocker only after starting a request.
 */
function EligibilityPreCheck({
  accountId,
  eligible,
  criteria,
}: {
  accountId: string;
  eligible: boolean;
  criteria: PayoutCriterion[];
}) {
  const met = criteria.filter((c) => c.ok).length;

  return (
    <div
      id="payout-eligibility"
      tabIndex={-1}
      className="border-2 border-primary/50 rounded-xl bg-surface-container-lowest p-6 outline-none"
    >
      <div className="flex items-center justify-between pb-3">
        <h2 className="font-headline text-lg font-bold text-on-surface">
          Payout Eligibility Checklist
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-on-surface">
            {eligible ? "✓ Eligible" : "✗ Not eligible"}
          </span>
          <TerraBadge tone={eligible ? "success" : "tertiary"}>
            {met}/{criteria.length} criteria met
          </TerraBadge>
        </div>
      </div>
      <div className="space-y-2">
        {criteria.map((c) => (
          <div
            key={c.label}
            className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2.5 text-sm"
          >
            <div>
              <span className="text-on-surface">{c.label}</span>
              <p className="text-xs text-on-surface-variant">{c.note}</p>
              {/* Unmet criteria get a direct path to resolution (audit: clarity) */}
              {!c.ok && c.resolve && (
                <Link
                  href={c.resolve.href}
                  className="mt-0.5 inline-block text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
                >
                  → {c.resolve.label}
                </Link>
              )}
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                c.ok
                  ? "bg-primary-fixed text-on-primary-fixed-variant"
                  : "bg-error-container text-on-error-container"
              }`}
              aria-label={c.ok ? "Met" : "Not met"}
            >
              {c.ok ? "✓" : "✗"}
            </span>
          </div>
        ))}
      </div>
      {eligible ? (
        <div className="mt-4 p-3 bg-primary-fixed/10 rounded-lg text-sm text-on-primary-fixed-variant">
          ✓ All requirements met - proceed to submit your payout request
        </div>
      ) : (
        <div className="mt-4 p-3 bg-error-fixed/10 rounded-lg text-sm text-on-error-fixed-variant">
          ⚠️ Review the unmet criteria above - fix before requesting payout
        </div>
      )}
    </div>
  );
}

export function PayoutRequestPage() {
  const params = useSearchParams();
  // ?id= deep link wins, otherwise the active trading account (switcher).
  const acc = useSyncActiveAccount(params.get("id"));
  const entitlement = payoutEntitlement(acc.id);
  const [amount, setAmount] = useState("");
  // Focus targets for the gated submit (finding #5) — the button stays
  // focusable (aria-disabled, not disabled) and moves focus to the
  // field or checklist that explains why submission is blocked.
  const amountRef = useRef<HTMLInputElement>(null);
  const methods = usePayoutMethods();
  const primaryMethod = methods.find((m) => m.primary);
  // Open on the primary method (W1-01: set-primary is honored here);
  // the trader can pick another method below.
  const [methodId, setMethodId] = useState<string>(
    primaryMethod?.id ?? methods[0]?.id ?? "",
  );
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const requests = usePayoutRequests();
  const submittedRequest = submittedRequestId
    ? requests.find((r) => r.id === submittedRequestId) ?? null
    : null;
  const method =
    methods.find((m) => m.id === methodId) ?? primaryMethod ?? methods[0];
  const feeAmount = method?.feeAmount ?? 0;
  const criteria = buildPayoutCriteria(acc.id, entitlement.withdrawable);
  const outstanding = criteria.filter((c) => !c.ok).length;
  // R4-11: block submission on rejected method, warn on unverified
  const methodRejected = method?.verification === "rejected";
  const methodUnverified = method?.verification === "unverified";

  // Performance & risk context (audit #1, HIGH) — the metrics that can
  // still put a payout at risk, shown alongside the request form.
  const limits = terraRiskLimits[acc.id] ?? { daily: 1000, maxDd: 5000 };
  const dailyUsed = Math.max(0, limits.daily - acc.dailyLossRemaining);
  const ddUsed = Math.max(0, limits.maxDd - acc.maxDdRemaining);
  const dailyPct = limits.daily > 0 ? (dailyUsed / limits.daily) * 100 : 0;
  const ddPct = limits.maxDd > 0 ? (ddUsed / limits.maxDd) * 100 : 0;
  const traded = tradedDaysFor(acc.id);
  const daysLeft = Math.max(0, MIN_PAYOUT_DAYS - traded);

  const asked = Number(amount);
  const receive = Number.isFinite(asked) ? Math.max(0, asked - feeAmount) : 0;
  const valid =
    entitlement.eligible &&
    Number.isFinite(asked) &&
    asked >= minPayout &&
    asked <= entitlement.withdrawable;

  if (submittedRequest) {
    const req = submittedRequest;
    const reqMethod = methods.find((m) => m.id === req.methodId);
    const eta = reqMethod?.eta;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
        <div className="rounded-full bg-primary-fixed p-6">
          <span className="text-6xl">✓</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Payout Request Submitted</h2>
          <p className="mt-2 text-on-surface-variant">
            Your request for {formatMoney(req.amount)} via {req.method} has been received.
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Reference: <span className="font-mono font-bold">{req.reference}</span>
          </p>
          {eta && eta !== "immediate" && eta !== "same-day" && (
            <p className="mt-1 text-sm text-on-surface-variant">
              Expected processing: {eta} business days
            </p>
          )}
          <p className="mt-1 text-sm text-on-surface-variant">
            Status: <span className="font-bold capitalize">{req.status}</span> — you’ll receive a confirmation email when approved
          </p>
          {reqMethod?.id === "wm-confirmo" ? (
            <p className="mt-1 text-sm text-on-surface-variant">
              Confirmo auto-payout: funds settle on-chain within minutes of approval — 24/7.
            </p>
          ) : (
            <p className="mt-1 text-sm text-on-surface-variant">
              Payouts are reviewed within 1 business day and processed during the open window (see payout schedule page).
            </p>
          )}
        </div>
          <button
            type="button"
            disabled={req.status !== "submitted"}
            onClick={() => {
              if (!cancelPayoutRequest(req.id)) return;
              setSubmittedRequestId(null);
            }}
            className={`rounded-xl px-5 py-3 text-sm font-bold text-error ${
              req.status !== "submitted"
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-error-fixed hover:text-on-error-fixed"
            }`}
          >
            Cancel request
          </button>
        <div className="flex gap-3">
          <Link
            href={`/payout-history`}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            View Payout History
          </Link>
          <Link
            href={`/payout-detail?id=${req.id}`}
            className="rounded-xl border border-outline-variant px-6 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-low"
          >
            View request
          </Link>
        </div>
      </div>
    );
  }

  // Evaluation / flat accounts — payouts are locked with the reason shown.
  if (!entitlement.eligible) {
    return (
      <div className="space-y-6">
        <TerraPageHeader
          title="Request Payout"
          description={`${acc.name} • Login #${acc.login}`}
          actions={<TerraBadge tone="neutral">Payouts locked</TerraBadge>}
        />
        <TerraEmpty
          title={entitlement.isFunded ? "Nothing to withdraw yet" : "Payouts are funded-only"}
          description={entitlement.reason}
        />
        {/* Upfront eligibility summary — what's missing before a request is possible */}
        <PayoutSummaryStrip
          accountId={acc.id}
          withdrawable={entitlement.withdrawable}
          balance={acc.balance}
          outstanding={outstanding}
        />
        <div className="flex flex-wrap gap-3">
          <Link
            href={entitlement.isFunded ? "/dashboard" : "/objectives"}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            {entitlement.isFunded ? "Back to Dashboard" : "View Objectives"}
          </Link>
          <Link
            href="/payout-eligibility"
            className="rounded-xl border border-outline-variant px-5 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-low"
          >
            Payout Eligibility
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Request Payout"
        description={`${acc.name} • Login #${acc.login} • split ${entitlement.splitPct}/${
          100 - entitlement.splitPct
        }`}
        actions={
          <TerraBadge tone="primary">
            Withdrawable {formatMoney(entitlement.withdrawable)}
          </TerraBadge>
        }
      />

      {terraPayouts.length > 0 && (
        <TerraBadge tone="secondary">
          Last payout: {formatMoney(terraPayouts[0].amount)} · PO-{terraPayouts[0].reference.replace("PO-", "")}
        </TerraBadge>
      )}

      {/* Upfront eligibility summary — the exact amount available, next
          window date, trading-day progress, and unmet requirements … */}
      <PayoutSummaryStrip
        accountId={acc.id}
        withdrawable={entitlement.withdrawable}
        balance={acc.balance}
        outstanding={outstanding}
      />

      {/* Performance & risk context (audit #1, HIGH) — current metrics
          that affect this payout's standing, with limit-proximity warnings */}
      <TerraCard>
        <TerraSectionTitle
          title="Performance & risk context"
          description="How your current trading position affects this payout — checked continuously, not just at submission."
        />
        <div className="space-y-4">
          <div className="rounded-xl bg-surface-container-low p-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-sm font-bold text-on-surface">
                {acc.phase === "Funded" ? "Scaling profit target" : "Profit target progress"}
              </span>
              <span className="text-xs font-bold tabular-nums text-on-surface">
                {formatMoney(acc.pnl)} <span className="font-normal text-on-surface-variant">/ {formatMoney(acc.profitTarget)}</span>{" "}
                <span className="text-primary">({acc.targetProgress.toFixed(1)}%)</span>
              </span>
            </div>
            <TerraProgress value={acc.targetProgress} height="h-2.5" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TerraDrawdownMeter
              label="Daily loss usage"
              used={dailyUsed}
              limit={limits.daily}
              remaining={acc.dailyLossRemaining}
              description="resets at 5pm ET"
            />
            <TerraDrawdownMeter
              label="Max drawdown usage"
              used={ddUsed}
              limit={limits.maxDd}
              remaining={acc.maxDdRemaining}
              description="trailing — never resets"
            />
          </div>

          <div className="rounded-xl bg-surface-container-low p-4 text-xs text-on-surface-variant">
            <span className="font-semibold text-on-surface">
              Minimum trading days: {traded} of {MIN_PAYOUT_DAYS} this payout cycle.
            </span>{" "}
            {daysLeft > 0
              ? `${daysLeft} more active trading day${daysLeft === 1 ? "" : "s"} required before payout.`
              : "Requirement met."}
          </div>

          {/* Limit-proximity warnings — surface risk before submission */}
          {dailyPct >= 80 || ddPct >= 80 ? (
            <div className="flex items-start gap-2 rounded-xl border border-error/40 bg-error-container/40 p-3 text-xs font-semibold text-error">
              <span aria-hidden>⚠</span>
              <span>
                {dailyPct >= 80
                  ? `Daily loss limit is ${Math.round(dailyPct)}% consumed — one more adverse day could end the account and void this payout.`
                  : `Max drawdown is ${Math.round(ddPct)}% consumed — a breach before processing would cancel the request.`}
              </span>
            </div>
          ) : null}
        </div>
      </TerraCard>

      {/* … and the detailed criteria list right before the request button */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle title="Payout details" />
            <div className="space-y-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Withdrawal amount
                </span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                  <input
                    ref={amountRef}
                    id="payout-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    aria-invalid={amount !== "" && !valid}
                    aria-describedby={amount !== "" && !valid ? "amount-error" : undefined}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    className={`rounded-lg border bg-surface-container-lowest pl-7 pr-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-primary ${
                      amount !== "" && !valid ? "border-error focus:border-error" : "border-outline-variant"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setAmount(String(entitlement.withdrawable))}
                    className="mt-2 block rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container"
                  >
                    Withdraw max ({formatMoney(entitlement.withdrawable)})
                  </button>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Min {formatMoney(minPayout)} • Max {formatMoney(entitlement.withdrawable)} (
                  {entitlement.splitPct}% of {formatMoney(entitlement.netProfit)} net profit)
                </p>
                {/* Real-time amount validation — say exactly what's wrong
                    (audit: eligibility preview before submission) */}
                {amount !== "" && !valid && (
                  <p id="amount-error" role="alert" className="text-xs font-bold text-error">
                    {!Number.isFinite(asked) || asked === 0
                      ? "Enter a valid payout amount."
                      : asked < minPayout
                        ? `Below the ${formatMoney(minPayout)} minimum — enter at least ${formatMoney(minPayout - asked)} more.`
                        : `Exceeds your withdrawable ${formatMoney(entitlement.withdrawable)} — reduce the amount by ${formatMoney(asked - entitlement.withdrawable)}.`}
                  </p>
                )}
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Payout amount (after fee)
                  </span>
                  <p className={`text-sm font-bold tabular-nums ${valid ? "text-primary" : "text-error"}`}>
                    {valid ? formatMoney(asked) : "—"}
                  </p>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Processing time
                  </span>
                  <p className="text-sm font-bold text-on-surface">
                    {method.eta === "immediate" ? "Immediate — auto-settled" : method.eta}
                  </p>
                </label>
              </div>
            </div>
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle title="Payout methods" />
            <div className="space-y-2" role="group" aria-label="Payout methods">
              {methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={methodId === m.id}
                  onClick={() => setMethodId(m.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                    methodId === m.id
                      ? "border-primary bg-primary-fixed/40"
                      : "border-outline-variant/60 hover:bg-surface-container-low"
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold text-on-surface">{m.name}</p>
                    <p className="text-xs text-on-surface-variant">{m.detail}</p>
                  </div>
                  <span className="text-xs text-on-surface-variant">{m.fee}</span>
                </button>
              ))}
            </div>
          </TerraCard>
        </div>

        <div className="flex flex-col gap-6">
          {/* Pre-request eligibility checklist (audit #4) */}
          <EligibilityPreCheck
            accountId={acc.id}
            eligible={entitlement.eligible}
            criteria={criteria}
          />
          <TerraCard className="flex flex-col gap-4">
            <TerraSectionTitle title="Request" />
          <div className="space-y-3 rounded-xl bg-surface-container-low p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Method</span>
              <span className="font-semibold text-on-surface">{method.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Amount</span>
              <span className={`font-bold tabular-nums ${valid ? "text-primary" : "text-error"}`}>
                {valid ? formatMoney(asked) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Fee</span>
              <span className="text-on-surface-variant">{method.fee}</span>
            </div>
            <div className="flex justify-between border-t border-outline-variant/40 pt-2">
              <span className="font-bold text-on-surface">Total — you receive</span>
              <span className="font-bold text-on-surface">
                {valid ? formatMoney(receive) : "—"}
              </span>
              <span className="text-xs text-on-surface-variant">
                fee {formatMoney(feeAmount)} • amount {formatMoney(asked)}
              </span>
            </div>
          </div>
          {/* Confirmo auto-payout note (finding #7c) — replaces the manual
              review expectations when instant crypto settlement is chosen. */}
          {method.id === "wm-confirmo" && (
            <p className="rounded-xl border border-primary/40 bg-primary-fixed/40 p-3 text-[11px] font-medium text-on-surface">
              ⚡ Auto-payout via Confirmo — after approval, funds settle on-chain within
              minutes, 24/7 (no bank windows, no manual transfers). Network fee ~1 USDT.
            </p>
          )}
          <p className="rounded-xl bg-secondary-fixed/60 p-3 text-[11px] text-on-secondary-fixed-variant">
            Your challenge fee is refunded with this payout — the first withdrawal on a funded
            account includes the original evaluation price.
          </p>
          {/* R4-11 gate: blocked on rejected, warned on unverified */}
          {methodRejected && (
            <p id="method-rejected-hint" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
              This payout method has been rejected — payouts cannot be submitted with a rejected method.
            </p>
          )}
          {methodUnverified && !methodRejected && (
            <p id="method-unverified-hint" className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs font-medium text-warning">
              This payout method is unverified — payout requests may fail. Consider verifying the method first.
            </p>
          )}
          <button
            type="button"
            // aria-disabled, not disabled (finding #5): a disabled
            // button is unreachable for keyboard/AT users, so the
            // blocked state could never be heard or acted on. This one
            // stays focusable and, when activated, moves focus to the
            // exact field or checklist that blocks submission.
            aria-disabled={!valid || outstanding > 0 || methodRejected}
            aria-describedby="payout-submit-hint"
            onClick={() => {
              if (methodRejected) {
                document.getElementById("method-rejected-hint")?.focus?.();
                return;
              }
              if (outstanding > 0) {
                document.getElementById("payout-eligibility")?.focus();
              } else if (!valid) {
                amountRef.current?.focus();
                amountRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              } else {
                setReviewOpen(true);
              }
            }}
            className={`rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition-all ${
              (!valid || outstanding > 0 || methodRejected)
                ? "cursor-not-allowed bg-primary text-on-primary opacity-50"
                : "bg-primary text-on-primary hover:bg-primary/90"
            }`}
          >
            {outstanding > 0
              ? `Fix ${outstanding} unmet requirement${outstanding === 1 ? "" : "s"}`
              : valid && !methodRejected
                ? "Submit Payout Request"
                : methodRejected
                  ? "Method Rejected — Cannot Submit"
                  : "Enter a valid amount"}
          </button>
          <p id="payout-submit-hint" className="text-center text-[11px] text-on-surface-variant">
            {outstanding > 0
              ? "The checklist above explains each unmet requirement — submit once all are met."
              : method.id === "wm-confirmo"
                ? "Confirmo settles automatically within minutes of approval — 24/7."
                : "Payouts are reviewed within 1 business day."}
          </p>
          </TerraCard>
          {/* W1-01: 2-step confirmation — review amount, method, fee, total,
              ETA before submitting; Cancel returns to the form intact. */}
          {reviewOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center"
              role="dialog"
              aria-modal="true"
              aria-label="Review payout"
            >
              <div
                className="fixed inset-0 bg-black/40"
                onClick={() => setReviewOpen(false)}
              />
              <div
                className="relative bg-surface-container rounded-xl shadow-2xl w-full max-w-md p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="font-headline text-lg font-bold text-on-surface mb-4">
                  Review payout
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Amount</span>
                    <span className="font-bold text-on-surface">
                      {formatMoney(asked)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Method</span>
                    <span className="font-semibold text-on-surface">{method.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Fee</span>
                    <span className="text-on-surface-variant">{method.fee}</span>
                  </div>
                  <div className="flex justify-between border-t border-outline-variant/40 pt-2 text-sm">
                    <span className="text-on-surface-variant">Total — you receive</span>
                    <span className="font-bold text-on-surface">
                      {formatMoney(receive)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-on-surface-variant">
                    <span>Processing</span>
                    <span>
                      {method.eta === "immediate"
                        ? "Immediate — auto-settled"
                        : method.eta}
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewOpen(false)}
                    className="rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!method) return;
                      const req = addPayoutRequest({
                        accountId: acc.id,
                        amount: asked,
                        methodId: method.id,
                        methodName: method.name,
                        feeAmount,
                        profitSplit: entitlement.splitPct,
                      });
                      setReviewOpen(false);
                      setSubmittedRequestId(req.id);
                    }}
                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
                  >
                    Confirm &amp; submit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
