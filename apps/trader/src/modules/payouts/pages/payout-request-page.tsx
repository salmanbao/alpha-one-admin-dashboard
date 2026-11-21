"use client";

/**
 * Payout Request — converted from stitch_screens/payout_request
 * Payout request form with amount, method and submit.
 *
 * Gated to funded accounts: evaluation phases see why payouts are
 * locked, and the withdrawable cap is the trader's split of net
 * profit (not a % of balance). Flat accounts are blocked too.
 */

import { useRef, useState, useEffect } from "react";
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
import { useTrading } from "@/lib/trading/trading-context";
import {
  MIN_PAYOUT_DAYS,
  PayoutSummaryStrip,
  buildPayoutCriteria,
  minPayout,
  payoutWindow,
} from "@/components/terra/payout-summary-strip";
import { addPayoutRequest, cancelPayoutRequest } from "@/lib/payouts/payout-requests-store";
import { readPayoutMethods, readPrimaryPayoutMethod } from "@/lib/payouts/payout-methods-store";
import { findPayoutRequestById } from "@/lib/payouts/payout-requests-store";

export default function PayoutRequestPage() {
  const account = useSyncActiveAccount(null);
  const acc = account;
  
  // Guard against missing account during SSR
  if (!acc) {
    return <div className="space-y-6">Loading payout request page...</div>;
  }
  
  const entitlement = payoutEntitlement(acc.id);
  const { closedTrades } = useTrading();
  const criteria = buildPayoutCriteria(acc.id, entitlement.withdrawable, closedTrades);
  const outstanding = criteria.filter((c) => !c.ok).length;
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [autoPayoutSchedule, setAutoPayoutSchedule] = useState<"none" | "biweekly" | "monthly" | "quarterly">("none");
  const amountRef = useRef<HTMLInputElement>(null);

  // Load/save auto-payout schedule preference
  const AUTO_PAYOUT_STORAGE_KEY = "pfaas:trader:autoPayoutSchedule";
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTO_PAYOUT_STORAGE_KEY);
      if (stored) setAutoPayoutSchedule(stored as "none" | "biweekly" | "monthly" | "quarterly");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_PAYOUT_STORAGE_KEY, autoPayoutSchedule);
    } catch {
      // ignore
    }
  }, [autoPayoutSchedule]);

  const methods = readPayoutMethods();
  const method = methods.find((m) => m.primary ?? methods[0]?.id === methods[0]?.id);
  const methodRejected = methods.some((m) => m.verification === "rejected");
  const methodUnverified = methods.some((m) => m.verification === "unverified");

  const submittedRequest = submittedRequestId
    ? findPayoutRequestById(submittedRequestId)
    : null;

  const feeAmount = method?.fee ? parseFloat(method.fee.replace(/[^0-9.]/g, "")) || 0 : 0;

  const asked = Number(amount);
  const receive = Number.isFinite(asked) ? Math.max(0, asked - feeAmount) : 0;
  const win = payoutWindow();
  const valid =
    entitlement.eligible &&
    win.open &&
    Number.isFinite(asked) &&
    asked >= minPayout &&
    asked <= entitlement.withdrawable;

  const tradedDaysFor2 = (id: string) =>
    new Set(closedTrades.filter((t) => t.accountId === id).map((t) => t.openedAt.slice(0, 10))).size;

  if (submittedRequest) {
    const reqMethod = methods.find((m) => m.id === submittedRequest.methodId);
    const eta = reqMethod?.eta;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
        <div className="rounded-full bg-primary-fixed p-6">
          <span className="text-6xl">✓</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Payout Request Submitted</h2>
          <p className="mt-2 text-on-surface-variant">
            Your request for {formatMoney(submittedRequest.amount)} via {submittedRequest.method} has been received.
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Reference: <span className="font-mono font-bold">{submittedRequest.reference}</span>
          </p>
          {eta && eta !== "immediate" && eta !== "same-day" && (
            <p className="mt-1 text-sm text-on-surface-variant">
              Expected processing: {eta} business days
            </p>
          )}
          <p className="mt-1 text-sm text-on-surface-variant">
            Status: <span className="font-bold capitalize">{submittedRequest.status}</span> — you’ll receive a confirmation email when approved
          </p>
          {submittedRequest.methodId === "wm-confirmo" ? (
            <p className="mt-1 text-sm text-on-surface-variant">
              Confirmo auto-payout: funds settle on-chain within minutes of approval — 24/7.
            </p>
          ) : (
            <p className="mt-1 text-sm text-on-surface-variant">
              Payouts are reviewed within 1 business day and processed during the open window (see payout schedule page).
            </p>
          )}
          <button
            type="button"
            disabled={submittedRequest.status !== "submitted"}
            onClick={() => {
              if (!cancelPayoutRequest(submittedRequest.id)) return;
              setSubmittedRequestId(null);
            }}
            className={`rounded-xl px-5 py-3 text-sm font-bold text-error ${
              submittedRequest.status !== "submitted"
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
              href={`/payout-detail?id=${submittedRequest.id}`}
              className="rounded-xl border border-outline-variant px-6 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-low"
            >
              View request
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
        <PayoutSummaryStrip
          accountId={acc.id}
          withdrawable={entitlement.withdrawable}
          balance={acc.balance}
          outstanding={outstanding}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Request Payout"
        description={`${acc.name} • Login #${acc.login} • split ${entitlement.splitPct}/${100 - entitlement.splitPct}`}
        actions={<TerraBadge tone="primary">Withdrawable {formatMoney(entitlement.withdrawable)}</TerraBadge>}
      />

      {terraPayouts.length > 0 && (
        <TerraBadge tone="secondary">
          Last payout: {formatMoney(terraPayouts[0].amount)} · PO-{terraPayouts[0].reference.replace("PO-", "")}
        </TerraBadge>
      )}

      <PayoutSummaryStrip
        accountId={acc.id}
        withdrawable={entitlement.withdrawable}
        balance={acc.balance}
        outstanding={outstanding}
      />

      <TerraCard>
        <TerraSectionTitle title="Performance & risk context" />
        <div className="space-y-4">
          <div className="rounded-xl bg-surface-container-low p-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-sm font-bold text-on-surface">
                {acc.phase === "Funded" ? "Scaling profit target" : "Profit target progress"}
              </span>
              <span className="text-xs font-bold tabular-nums text-on-surface">
                {formatMoney(acc.pnl)} / {formatMoney(acc.profitTarget)}
              </span>
            </div>
          </div>
        </div>
      </TerraCard>

      <TerraCard>
        <TerraSectionTitle title="Payout method" />
        <div className="space-y-4">
          {method ? (
            <div className="rounded-lg border border-outline-variant p-4">
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
                <span className="font-bold text-on-surface">{formatMoney(receive)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant">No withdrawal method configured — add one first.</p>
          )}
        </div>
      </TerraCard>

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
          disabled={!valid || outstanding > 0 || methodRejected}
          onClick={() => {
            if (!method) return;
            const req = addPayoutRequest({
              accountId: acc.id,
              amount: asked,
              methodId: method.id,
              methodName: method.name,
              feeAmount,
              profitSplit: entitlement.splitPct,
              currency,
              autoPayoutSchedule: autoPayoutSchedule,
            });
            setReviewOpen(false);
            setSubmittedRequestId(req.id);
          }}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
        >
          Confirm & submit
        </button>

        {/* Auto-payout schedule preference */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-sm text-on-surface">
            Auto-payout schedule:
          </span>
          <select
            value={autoPayoutSchedule}
            onChange={(e) => setAutoPayoutSchedule((e.target.value as "none" | "biweekly" | "monthly" | "quarterly"))}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-bold text-on-surface outline-none focus:border-primary"
          >
            <option value="none">None (manual)</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>
      </div>
    </div>
  );
}