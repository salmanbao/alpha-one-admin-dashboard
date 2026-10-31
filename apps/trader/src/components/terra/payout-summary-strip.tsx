"use client";

/**
 * Payout Summary Strip — upfront eligibility snapshot (finding #3).
 *
 * Traders used to request payouts without seeing the key eligibility
 * facts first, and only discovered blockers after submitting. This
 * strip renders the four headline numbers both payout screens need
 * BEFORE the request form / checklist:
 *
 *   1. Exact amount available to withdraw right now
 *   2. Next payout window (open now / opens in N days + dates)
 *   3. Minimum trading days progress this payout cycle
 *   4. Outstanding (unmet) requirements count
 *
 * Data comes from the same fixtures the full eligibility page uses
 * (terraTrades, payoutSchedule) so the summary and the checklist can
 * never disagree.
 */

import { formatMoney } from "@/components/terra/terra-ui";
import {
  payoutSchedule,
  terraAccounts,
  terraTrades,
  withdrawalMethods,
} from "@/lib/fixtures/terra-fixtures";

/** Minimum single payout request — shared by every payout surface. */
export const minPayout = 100;

/** Minimum trading days per payout cycle — single source for both screens. */
export const MIN_PAYOUT_DAYS = 5;

/** Distinct trading days (by calendar date) an account has traded. */
export function tradedDaysFor(accountId: string) {
  return new Set(
    terraTrades.filter((t) => t.accountId === accountId).map((t) => t.openedAt.slice(0, 10)),
  ).size;
}

/** Next payout window status — single source for both screens. */
export function payoutWindow() {
  const opensAt = new Date(payoutSchedule.windowOpensAt);
  const closesAt = new Date(payoutSchedule.windowClosesAt);
  const now = Date.now();
  const open = now >= opensAt.getTime() && now <= closesAt.getTime();
  const daysToOpen = Math.max(0, Math.ceil((opensAt.getTime() - now) / 86_400_000));
  return { open, daysToOpen, opensAt, closesAt };
}

export type PayoutCriterion = { label: string; ok: boolean; note: string };

/**
 * All payout requirements for an account — the single source the
 * pre-request checklist, the summary strip AND the Payouts page's
 * eligibility card (finding #1) all draw from, so the three surfaces
 * can never disagree about what is (not) met.
 */
export function buildPayoutCriteria(
  accountId: string,
  withdrawable: number,
): PayoutCriterion[] {
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

interface PayoutSummaryStripProps {
  accountId: string;
  /** Exact amount currently withdrawable (entitlement.withdrawable). */
  withdrawable: number;
  /** Optional account balance context for the "Available now" chip. */
  balance?: number;
  /** How many payout requirements are not yet met. */
  outstanding: number;
}

export function PayoutSummaryStrip({
  accountId,
  withdrawable,
  balance,
  outstanding,
}: PayoutSummaryStripProps) {
  const traded = tradedDaysFor(accountId);
  const daysMet = traded >= MIN_PAYOUT_DAYS;
  const { open: windowOpen, daysToOpen, opensAt, closesAt } = payoutWindow();

  const stats = [
    {
      label: "Available now",
      value: formatMoney(withdrawable),
      note: balance !== undefined ? `${formatMoney(balance)} account balance` : "Your split of net profit",
      tone: withdrawable > 0 ? "text-primary" : "text-error",
    },
    {
      label: "Next payout window",
      value: windowOpen ? "Open now" : `Opens in ${daysToOpen} day${daysToOpen === 1 ? "" : "s"}`,
      note: `${opensAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${closesAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} • ${payoutSchedule.cutoffNote}`,
      tone: windowOpen ? "text-primary" : "text-on-surface",
    },
    {
      label: "Trading days this cycle",
      value: `${traded} of ${MIN_PAYOUT_DAYS}`,
      note: daysMet ? "Minimum met" : `${MIN_PAYOUT_DAYS - traded} trading day${MIN_PAYOUT_DAYS - traded === 1 ? "" : "s"} remaining`,
      tone: daysMet ? "text-primary" : "text-error",
    },
    {
      label: "Outstanding requirements",
      value: `${outstanding}`,
      note: outstanding === 0 ? "All requirements met" : `${outstanding} requirement${outstanding === 1 ? "" : "s"} not met yet`,
      tone: outstanding === 0 ? "text-primary" : "text-error",
    },
  ];

  return (
    <div
      role="group"
      aria-label="Payout eligibility summary"
      className="grid grid-cols-2 gap-3 rounded-xl border border-outline-variant/40 bg-surface-container p-3 sm:grid-cols-4"
    >
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg bg-surface-container-low px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            {s.label}
          </p>
          <p className={`mt-0.5 text-base font-bold tabular-nums ${s.tone}`}>{s.value}</p>
          <p className="text-[11px] leading-tight text-on-surface-variant">{s.note}</p>
        </div>
      ))}
    </div>
  );
}
