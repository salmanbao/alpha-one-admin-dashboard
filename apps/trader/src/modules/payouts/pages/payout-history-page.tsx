"use client";

/**
 * Payout History — converted from stitch_screens/payout_history
 * History of payouts with status timeline.
 *
 * Audit finding #1 (HIGH): this screen is the trader's Payouts landing
 * page (nav → /payouts), but it used to show ONLY the history table —
 * eligibility lived on separate screens traders had to find. The
 * eligibility summary card now sits ABOVE the table, before any
 * request action: exact withdrawable amount, next payout window,
 * trading-days progress, and the configured withdrawal methods. The
 * prominent "Request payout" button only renders when every criterion
 * is met; otherwise it's replaced by a plain-English blocker list, so
 * nobody starts a request that's guaranteed to fail. All numbers come
 * from the shared payout-summary-strip module — the same source the
 * request form and full eligibility page use.
 */

import { useState } from "react";
import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraTable,
  formatMoney,
} from "@/components/terra/terra-ui";
import {
  payoutEntitlement,
  terraAccounts,
  terraPayouts,
  withdrawalMethods,
} from "@/lib/fixtures/terra-fixtures";
import { useSyncActiveAccount } from "@/lib/platform/account-context";
import {
  PayoutSummaryStrip,
  buildPayoutCriteria,
} from "@/components/terra/payout-summary-strip";
import { DetailDialog } from "@/components/terra/detail-dialog";
import { PayoutDetailContent } from "./payout-detail-page";

/**
 * Eligibility card (finding #1) — shown before the history table on
 * the Payouts landing page. Wraps the shared summary strip with the
 * configured withdrawal methods and the gated request CTA.
 */
function PayoutEligibilityCard({ accountId }: { accountId: string }) {
  const entitlement = payoutEntitlement(accountId);
  const acc = terraAccounts.find((a) => a.id === accountId);
  const criteria = buildPayoutCriteria(accountId, entitlement.withdrawable);
  const unmet = criteria.filter((c) => !c.ok);
  const eligible = unmet.length === 0;

  return (
    <TerraCard className={eligible ? "border border-primary/30" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <TerraSectionTitle
          title="Payout eligibility"
          description={
            acc
              ? `For #${acc.login} — your active trading account`
              : "Your active trading account"
          }
        />
        <TerraBadge tone={eligible ? "success" : "tertiary"}>
          {criteria.length - unmet.length}/{criteria.length} criteria met
        </TerraBadge>
      </div>

      <PayoutSummaryStrip
        accountId={accountId}
        withdrawable={entitlement.withdrawable}
        balance={acc?.balance}
        outstanding={unmet.length}
      />

      {/* Eligible withdrawal methods (finding #1) — configured payout
          routes and their fees/ETAs, so method requirements are visible
          before the request form. */}
      <div className="mt-3 rounded-xl border border-outline-variant/40 bg-surface-container p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          Withdrawal methods
        </p>
        <ul className="mt-2 space-y-1.5">
          {withdrawalMethods.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              <span className="font-semibold text-on-surface">{m.name}</span>
              {m.primary && (
                <TerraBadge tone="primary">Default</TerraBadge>
              )}
              <span className="text-xs text-on-surface-variant">
                {m.fee} • {m.eta}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Gated CTA — the request button only appears when every
          criterion is met; otherwise show exactly what's missing. */}
      {eligible ? (
        <div className="mt-4 flex flex-col items-center gap-2">
          <Link
            href={`/payout-request?id=${accountId}`}
            className="w-full rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 sm:w-auto sm:px-10"
          >
            Request payout — {formatMoney(entitlement.withdrawable)} available
          </Link>
          <p className="text-center text-[11px] text-on-surface-variant">
            All {criteria.length} criteria met • next window per the schedule above
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-surface-container-low p-3">
          <p className="text-sm font-bold text-on-surface">
            Not ready to request yet — {unmet.length} requirement
            {unmet.length === 1 ? "" : "s"} to go:
          </p>
          <ul className="mt-1.5 space-y-1">
            {unmet.map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-sm text-on-surface-variant">
                <span className="mt-0.5 font-bold text-error" aria-hidden>✗</span>
                <span>
                  {c.label} — <span className="text-on-surface">{c.note}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={`/payout-eligibility?id=${accountId}`}
            className="mt-2.5 block text-center text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
          >
            Full eligibility details, schedule & scaling →
          </Link>
        </div>
      )}
    </TerraCard>
  );
}

export function PayoutHistoryPage() {
  // Quick-view overlay: clicking a reference opens the payout detail in
  // a dialog on top of the table — the history list is never left.
  const [quickPayoutId, setQuickPayoutId] = useState<string | null>(null);
  const quickPayout = quickPayoutId
    ? (terraPayouts.find((p) => p.id === quickPayoutId) ?? null)
    : null;
  // Account scope: the active trading account (header switcher).
  const acc = useSyncActiveAccount(null);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Payout History"
        description={`${terraPayouts.length} payouts • ${terraPayouts.filter((p) => p.status === "paid").length} paid`}
        actions={
          <TerraBadge tone="primary">
            Next payout: 4 days
          </TerraBadge>
        }
      />

      {/* Eligibility before any request action (finding #1 HIGH) */}
      <PayoutEligibilityCard accountId={acc.id} />

      <TerraCard>
        <TerraTable
          head={["Reference", "Account", "Amount", "Method", "Status", "Requested", "Processed"]}
          rows={terraPayouts.map((p) => [
            <button
              key="ref"
              type="button"
              aria-haspopup="dialog"
              onClick={() => setQuickPayoutId(p.id)}
              className="text-left font-mono text-xs font-bold text-primary hover:underline"
            >
              {p.reference}
            </button>,
            <span key="acc" className="font-mono text-xs text-on-surface-variant">#{p.accountLogin}</span>,
            <span key="amt" className="font-bold tabular-nums">{formatMoney(p.amount)}</span>,
            <span key="meth">{p.method}</span>,
            <span key="status">
              <TerraBadge tone={p.status === "paid" ? "success" : p.status === "rejected" ? "error" : "tertiary"}>{p.status}</TerraBadge>
            </span>,
            <span key="req">{p.requestedAt.slice(0, 10)}</span>,
            <span key="exp">{p.expectedAt.slice(0, 10)}</span>,
          ])}
        />
      </TerraCard>

      {/* Quick-view overlay — inspect a payout without leaving the table */}
      <DetailDialog
        open={quickPayout !== null}
        onOpenChange={(o) => {
          if (!o) setQuickPayoutId(null);
        }}
        title={quickPayout ? `Payout ${quickPayout.reference}` : "Payout detail"}
        description={
          quickPayout
            ? `#${quickPayout.accountLogin} • ${formatMoney(quickPayout.amount)} • ${quickPayout.method}`
            : undefined
        }
        fullPageHref={quickPayout ? `/payout-detail?id=${quickPayout.id}` : undefined}
      >
        {quickPayout && <PayoutDetailContent id={quickPayout.id} embedded />}
      </DetailDialog>
    </div>
  );
}
