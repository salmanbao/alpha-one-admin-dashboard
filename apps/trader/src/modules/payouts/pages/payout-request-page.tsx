"use client";

/**
 * Payout Request — converted from stitch_screens/payout_request
 * Payout request form with amount, method and submit.
 *
 * Gated to funded accounts: evaluation phases see why payouts are
 * locked, and the withdrawable cap is the trader's split of net
 * profit (not a % of balance). Flat accounts are blocked too.
 */

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";
import {
  payoutEntitlement,
  terraPayouts,
  terraAccounts,
  withdrawalMethods,
} from "@/lib/fixtures/terra-fixtures";
import { useSyncActiveAccount } from "@/lib/platform/account-context";
import {
  MIN_PAYOUT_DAYS,
  PayoutSummaryStrip,
  tradedDaysFor,
} from "@/components/terra/payout-summary-strip";

const minPayout = 100;

type PayoutCriterion = { label: string; ok: boolean; note: string };

/**
 * All payout requirements for an account — the single source both the
 * pre-request checklist and the summary strip draw from, so the two
 * surfaces can never disagree about what is (not) met.
 */
function buildPayoutCriteria(accountId: string, withdrawable: number): PayoutCriterion[] {
  const acc = terraAccounts.find((a) => a.id === accountId);
  const traded = tradedDaysFor(accountId);
  const daysLeft = Math.max(0, MIN_PAYOUT_DAYS - traded);
  return [
    {
      label: "Account is funded",
      ok: acc?.phase === "Funded",
      note: acc ? `${acc.phase} — payouts unlock on funded accounts` : "Account not found",
    },
    {
      label: "Net profit above starting balance",
      ok: acc ? acc.balance > acc.startingBalance : false,
      note: acc ? `${formatMoney(acc.balance - acc.startingBalance)} net profit` : "—",
    },
    {
      label: `Minimum payout ${formatMoney(minPayout)}`,
      ok: withdrawable >= minPayout,
      note: `${formatMoney(withdrawable)} withdrawable now`,
    },
    {
      label: `Minimum trading days (${MIN_PAYOUT_DAYS} per payout cycle)`,
      ok: traded >= MIN_PAYOUT_DAYS,
      note:
        traded >= MIN_PAYOUT_DAYS
          ? `${traded} of ${MIN_PAYOUT_DAYS} required — met`
          : `${traded} of ${MIN_PAYOUT_DAYS} required • ${daysLeft} trading day${daysLeft === 1 ? "" : "s"} remaining`,
    },
    { label: "Payout method configured", ok: true, note: withdrawalMethods[0]?.name ?? "—" },
    { label: "KYC approved", ok: true, note: "Verified" },
  ];
}

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
    <TerraCard
      className={eligible ? "border border-primary/30" : "border border-tertiary/40"}
    >
      <div className="flex items-center justify-between pb-3">
        <h2 className="font-headline text-lg font-bold text-on-surface">
          Payout eligibility
        </h2>
        <TerraBadge tone={eligible ? "success" : "tertiary"}>
          {met}/{criteria.length} criteria met
        </TerraBadge>
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
      <Link
        href={`/payout-eligibility?id=${accountId}`}
        className="mt-3 block text-center text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
      >
        Full eligibility details, schedule & scaling →
      </Link>
    </TerraCard>
  );
}

export function PayoutRequestPage() {
  const params = useSearchParams();
  // ?id= deep link wins, otherwise the active trading account (switcher).
  const acc = useSyncActiveAccount(params.get("id"));
  const entitlement = payoutEntitlement(acc.id);
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState("wm-wise");
  const [submitted, setSubmitted] = useState(false);
  const method = withdrawalMethods.find((m) => m.id === methodId) ?? withdrawalMethods[0];
  const criteria = buildPayoutCriteria(acc.id, entitlement.withdrawable);
  const outstanding = criteria.filter((c) => !c.ok).length;

  const asked = Number(amount);
  const valid =
    entitlement.eligible &&
    Number.isFinite(asked) &&
    asked >= minPayout &&
    asked <= entitlement.withdrawable;

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
        <div className="rounded-full bg-primary-fixed p-6">
          <span className="text-6xl">✓</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Payout Request Submitted</h2>
          <p className="mt-2 text-on-surface-variant">
            Your request for {formatMoney(asked)} via {method.name} has been received.
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Reference: PO-2026-0415 • Expected processing: {method.eta}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/payout-history"
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            View Payout History
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-outline-variant px-6 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-low"
          >
            Back to Dashboard
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
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest pl-7 pr-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-primary"
                  />
                </div>
                <p className="text-xs text-on-surface-variant">
                  Min {formatMoney(minPayout)} • Max {formatMoney(entitlement.withdrawable)} (
                  {entitlement.splitPct}% of {formatMoney(entitlement.netProfit)} net profit)
                </p>
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
                  <p className="text-sm font-bold text-on-surface">{method.eta}</p>
                </label>
              </div>
            </div>
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle title="Payout methods" />
            <div className="space-y-2">
              {withdrawalMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
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
              <span className="font-bold text-on-surface">Total</span>
              <span className="font-bold text-on-surface">{valid ? formatMoney(asked) : "—"}</span>
            </div>
          </div>
          <p className="rounded-xl bg-secondary-fixed/60 p-3 text-[11px] text-on-secondary-fixed-variant">
            Your challenge fee is refunded with this payout — the first withdrawal on a funded
            account includes the original evaluation price.
          </p>
          <button
            type="button"
            disabled={!valid}
            onClick={() => setSubmitted(true)}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {valid ? "Submit Payout Request" : "Enter a valid amount"}
          </button>
          <p className="text-center text-[11px] text-on-surface-variant">
            Payouts are reviewed within 1 business day.
          </p>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}
