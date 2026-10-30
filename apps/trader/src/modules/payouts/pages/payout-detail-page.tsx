"use client";

/**
 * Payout Detail — converted from stitch_screens/payout_detail
 * Single payout with status timeline and details.
 *
 * Split into `PayoutDetailContent({ id, embedded })` so it renders both
 * as the route (`/payout-detail?id=`) and inside the quick-view dialog
 * on Payout History (`embedded` hides page chrome — dialog header and
 * footer provide navigation instead).
 */

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";
import { terraPayouts } from "@/lib/fixtures/terra-fixtures";
import { toast } from "@/hooks/use-toast";

export function PayoutDetailContent({
  id,
  embedded = false,
}: {
  id: string | null;
  /** true when rendered inside the quick-view dialog (page chrome hidden). */
  embedded?: boolean;
}) {
  const payout = terraPayouts.find((p) => p.id === id) ?? terraPayouts[0];

  const rejected = payout.status === "rejected" && payout.rejection != null;

  const timeline = rejected
    ? [
        {
          label: "Requested",
          at: payout.requestedAt,
          done: true,
          note: `Via ${payout.method}`,
        },
        {
          label: "Under review",
          at: payout.requestedAt,
          done: true,
          note: "Compliance and risk checks",
        },
        {
          label: "Rejected",
          at: payout.rejection!.at,
          done: true,
          note: payout.rejection!.summary,
        },
      ]
    : [
        {
          label: "Requested",
          at: payout.requestedAt,
          done: true,
          note: `Via ${payout.method}`,
        },
        {
          label: "Under review",
          at: payout.requestedAt,
          done: true,
          note: "Compliance and risk checks",
        },
        {
          label: "Processing",
          at: payout.status === "processing" ? payout.requestedAt : null,
          done: payout.status !== "paid",
          note: "Funds being transferred",
        },
        {
          label: "Paid",
          at: payout.status === "paid" ? payout.expectedAt : null,
          done: payout.status === "paid",
          note: "Received in your account",
        },
      ];

  const statusTone =
    payout.status === "paid" ? "success" : payout.status === "rejected" ? "error" : "tertiary";

  const handleDownloadReceipt = () => {
    toast({
      title: "Receipt downloaded",
      description: `${payout.reference} — ${formatMoney(payout.amount)} via ${payout.method} (${payout.status}).`,
    });
  };

  const handleAppeal = () => {
    toast({
      title: "Appeal submitted",
      description: `Compliance will re-review ${payout.reference} within 2 business days — attach your broker statement in the support ticket we opened. (Demo — no backend call.)`,
    });
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <Link
          href="/payout-history"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          ← Back to Payout History
        </Link>
      )}
      {embedded ? (
        <div className="flex flex-wrap items-center gap-2">
          <TerraBadge tone={statusTone} dot pulse={payout.status === "processing"}>
            {payout.status}
          </TerraBadge>
          <TerraBadge tone="neutral">{payout.method}</TerraBadge>
        </div>
      ) : (
        <TerraPageHeader
          title={`Payout ${payout.reference}`}
          description={`Account #${payout.accountLogin} • ${payout.method}`}
          actions={
            <TerraBadge tone={statusTone} dot pulse={payout.status === "processing"}>
              {payout.status}
            </TerraBadge>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TerraCard className="lg:col-span-2">
          <TerraSectionTitle title="Status timeline" />
          <ol className="space-y-5">
            {timeline.map((s) => {
              const err = s.label === "Rejected";
              return (
              <li key={s.label} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    err
                      ? "bg-error-container text-on-error-container"
                      : s.done
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {err ? "✕" : s.done ? "✓" : "•"}
                </span>
                <div>
                  <p className={`text-sm font-bold ${err ? "text-on-error-container" : s.done ? "text-on-surface" : "text-on-surface-variant"}`}>
                    {s.label}
                  </p>
                  <p className="text-xs text-on-surface-variant">{s.note}</p>
                  {s.at && (
                    <p className="text-[11px] text-on-surface-variant">
                      {new Date(s.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </li>
              );
            })}
          </ol>
        </TerraCard>

        <TerraCard className="flex flex-col gap-4">
          <TerraSectionTitle title="Summary" />
          <div className="rounded-xl bg-surface-container-low p-5 text-center">
            <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Amount
            </span>
            <span className="font-headline text-3xl font-bold tabular-nums text-on-surface">
              {formatMoney(payout.amount)}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Reference</span>
              <span className="font-mono font-semibold text-on-surface">{payout.reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Method</span>
              <span className="font-semibold text-on-surface">{payout.method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Requested</span>
              <span className="text-on-surface">{payout.requestedAt.slice(0, 10)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">{rejected ? "Rejected" : "Expected"}</span>
              <span className={rejected ? "font-semibold text-on-error-container" : "text-on-surface"}>
                {(rejected ? payout.rejection?.at : payout.expectedAt)?.slice(0, 10)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadReceipt}
            className="rounded-xl bg-surface-container-low px-5 py-3 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Download receipt
          </button>
        </TerraCard>
      </div>

      {/* Rejected outcome — reasons, unmet criteria, action plan, appeal (audit #2) */}
      {rejected && payout.rejection && (
        <TerraCard className="border border-error-container">
          <TerraSectionTitle
            title="Why this payout was rejected"
            description={`Reviewed ${new Date(payout.rejection.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • Reason code ${payout.rejection.code}`}
            actions={<TerraBadge tone="error" dot>Rejected</TerraBadge>}
          />
          <p className="rounded-xl bg-error-container/50 p-4 text-sm text-on-error-container">
            {payout.rejection.summary}
          </p>

          {/* Criteria that weren't met — exact vs required */}
          <div className="space-y-2">
            {payout.rejection.checks.map((c) => (
              <div
                key={c.label}
                className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${
                  c.met ? "bg-surface-container-low" : "bg-error-container/40"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface">{c.label}</p>
                  <p className="text-xs text-on-surface-variant">
                    Required {c.required} • you had {c.actual}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    c.met ? "bg-primary-fixed text-on-primary-fixed-variant" : "bg-error-container text-on-error-container"
                  }`}
                >
                  {c.met ? "✓ met" : "✗ not met"}
                </span>
              </div>
            ))}
          </div>

          {/* Action plan */}
          <div>
            <p className="pb-2 text-sm font-bold text-on-surface">How to fix it</p>
            <ol className="space-y-3">
              {payout.rejection.nextSteps.map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
                    {i + 1}
                  </span>
                  <p className="text-sm text-on-surface-variant">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-outline-variant/40 pt-4">
            <button
              type="button"
              onClick={handleAppeal}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Appeal this decision
            </button>
            <Link
              href={`/payout-eligibility?id=${payout.account}`}
              className="rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Review eligibility checklist
            </Link>
            <Link
              href="/support"
              className="rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Open a support ticket
            </Link>
          </div>
        </TerraCard>
      )}

      {/* Post-payout account actions (M10) */}
      {payout.status === "paid" && (
        <TerraCard>
          <TerraSectionTitle
            title="Post-payout account actions"
            description={`Choose what happens to account #${payout.accountLogin} now that ${formatMoney(payout.amount)} has been paid.`}
            actions={<TerraBadge tone="success" dot>Action required</TerraBadge>}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4">
              <p className="text-sm font-bold text-on-surface">Reset balance</p>
              <p className="flex-1 text-xs text-on-surface-variant">
                Restart the account at its initial balance, keeping the same challenge
                and rules. Ideal after locking in profit.
              </p>
              <button
                type="button"
                onClick={() =>
                  toast({
                    title: "Reset requested",
                    description: `#${payout.accountLogin} balance will return to its initial value after the next sync. (Demo — no backend call.)`,
                  })
                }
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary hover:bg-primary/90"
              >
                Reset balance
              </button>
            </div>
            <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4">
              <p className="text-sm font-bold text-on-surface">Continue trading</p>
              <p className="flex-1 text-xs text-on-surface-variant">
                Keep the remaining balance and keep trading toward your next payout
                window — nothing changes.
              </p>
              <button
                type="button"
                onClick={() =>
                  toast({
                    title: "No changes applied",
                    description: `Continuing trading on #${payout.accountLogin}. (Demo)`,
                  })
                }
                className="rounded-xl bg-surface-container-low px-4 py-2.5 text-xs font-bold text-on-surface ring-1 ring-outline-variant/60 hover:bg-surface-container"
              >
                Continue trading
              </button>
            </div>
            <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4">
              <p className="text-sm font-bold text-on-surface">Scaling eligibility</p>
              <p className="flex-1 text-xs text-on-surface-variant">
                Counted payouts push you toward the next account tier and a better
                profit split. See where you stand.
              </p>
              <Link
                href={`/payout-eligibility?id=${payout.account}`}
                className="rounded-xl bg-surface-container-low px-4 py-2.5 text-center text-xs font-bold text-on-surface ring-1 ring-outline-variant/60 hover:bg-surface-container"
              >
                Check scaling →
              </Link>
            </div>
          </div>
        </TerraCard>
      )}
    </div>
  );
}

export function PayoutDetailPage() {
  const params = useSearchParams();
  return <PayoutDetailContent id={params.get("id")} />;
}
