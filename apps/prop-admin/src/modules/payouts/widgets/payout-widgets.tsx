"use client";

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { getTenantPayouts, payoutSeries, type Payout } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { StatusBadge, payoutStatusTone, formatCurrency, formatCompact } from "@/components/platform/status";
import { applyPayoutDecision, effectivePayoutStatus, usePayoutVersion } from "@/modules/payouts/payout-store";
import { Wallet, Banknote, Clock, CheckCircle2, DollarSign, XCircle, HelpCircle } from "lucide-react";
import { AreaSeries, DonutSeries } from "@/components/platform/charts";
import { Button } from "@/components/ui/button";
import {
  PayoutRejectDialog,
  type PayoutRejectTarget,
  type PayoutRejectResult,
} from "@/components/platform/payout-reject-dialog";
import { toast } from "@/hooks/use-toast";

export function PayoutOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  usePayoutVersion(); // stay in sync with approve/reject decisions
  const pays = getTenantPayouts(tid).map((p) => ({ ...p, status: effectivePayoutStatus(p) }));
  const pending = pays.filter((p) => p.status === "pending").length;
  // Label says (30d) — actually filter to the 30-day window.
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const totalPaid = pays
    .filter((p) => p.status === "paid" && new Date(p.createdAt).getTime() >= thirtyDaysAgo)
    .reduce((s, p) => s + p.amount, 0);
  const avgSplit = pays.length ? Math.round(pays.reduce((s, p) => s + p.profitSplit, 0) / pays.length) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Pending" value={pending} icon={Clock} tone={pending > 0 ? "warning" : "positive"} />
      <MetricCard label="Total Paid (30d)" value={formatCurrency(totalPaid, currency)} icon={CheckCircle2} tone="positive" />
      <MetricCard label="Avg Profit Split" value={`${avgSplit}%`} icon={DollarSign} />
      <MetricCard label="Total Requests" value={pays.length} icon={Wallet} />
    </div>
  );
}

export function PayoutQueueWidget() {
  const { runtime, user, pushNotification } = usePlatform();
  // In-page guard — same payout.approve rule as the payouts table.
  const canDecide = hasPermission(user, "payout.approve");
  const decideTitle = canDecide ? undefined : "Requires payout.approve";
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  usePayoutVersion(); // approved items leave the queue instantly
  // Audit fix #3: reject collects a structured reason via the shared
  // PayoutRejectDialog (same flow as the payouts table + batch toolbar).
  const [rejectTarget, setRejectTarget] = useState<PayoutRejectTarget | null>(null);
  const pending = getTenantPayouts(tid)
    .map((p) => ({ ...p, status: effectivePayoutStatus(p) }))
    .filter((p) => p.status === "pending")
    .slice(0, 5);
  const confirmReject = (p: Payout, result: PayoutRejectResult) => {
    applyPayoutDecision(p.reference, "rejected", { reason: result.reason });
    if (result.notifyTrader) {
      pushNotification({
        title: "Payout rejected",
        message: `Your payout ${p.reference} (${formatCurrency(p.amount, currency)}) was rejected: ${result.reason}`,
        severity: "critical",
        module: "payouts",
      });
    }
    toast({
      title: "Payout rejected",
      description: `${p.traderName} — ${formatCurrency(p.amount, currency)} (${result.reason})`,
      variant: "destructive",
    });
    setRejectTarget(null);
  };
  if (pending.length === 0) {
    return <div className="p-4 text-sm text-emerald-600">No pending payouts. Queue is clear.</div>;
  }
  return (
    <>
    <ul className="space-y-2">
      {pending.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{p.traderName}</p>
            <p className="text-[10px] text-muted-foreground">{p.method} · {p.reference}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{formatCurrency(p.amount, currency)}</p>
            <p className="text-[10px] text-muted-foreground">{p.profitSplit}% split</p>
          </div>
          {/* Round 7 fix: PayoutQueueWidget now offers the same 3 actions as
              the PayoutReviewActions panel (Approve + Reject + Request-Info)
              so the operator can clear a stuck queue from the dashboard
              without navigating to the Pending Payouts page. Reject is
              routed through the shared PayoutRejectDialog (audit fix #3 —
              structured reason + notify-trader on every surface). */}
          <Button
            size="sm"
            variant="default"
            disabled={!canDecide}
            title={decideTitle}
            aria-label={`Approve ${p.traderName}'s payout`}
            onClick={() => {
              applyPayoutDecision(p.reference, "approved");
              toast({ title: "Payout approved", description: `${p.traderName} — ${formatCurrency(p.amount, currency)}` });
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canDecide}
            title={decideTitle}
            aria-label={`Reject ${p.traderName}'s payout`}
            className="text-rose-700 hover:text-rose-700 dark:text-rose-400"
            onClick={() =>
              setRejectTarget({
                reference: p.reference,
                traderName: p.traderName,
                amount: p.amount,
                currency,
                count: 1,
              })
            }
          >
            <XCircle className="h-3.5 w-3.5" /> Reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canDecide}
            title={decideTitle}
            aria-label={`Request more info from ${p.traderName}`}
            onClick={() => {
              applyPayoutDecision(p.reference, "info-requested");
              toast({ title: "Info requested", description: `${p.traderName} contacted for additional details.` });
            }}
          >
            <HelpCircle className="h-3.5 w-3.5" /> Info
          </Button>
        </li>
      ))}
    </ul>
    {/* Shared reject dialog — one instance for all rows in the queue */}
    <PayoutRejectDialog
      target={rejectTarget}
      onOpenChange={(o) => !o && setRejectTarget(null)}
      onConfirm={(result) => {
        const p = pending.find((x) => x.reference === rejectTarget?.reference);
        if (p) confirmReject(p, result);
      }}
    />
    </>
  );
}

export function PayoutTrendWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const data = payoutSeries(tid);
  return <AreaSeries data={data} xKey="date" yKey="value" formatValue={(v) => formatCurrency(v, runtime.tenant?.currency)} height={180} />;
}

export function PayoutMethodWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const pays = getTenantPayouts(tid);
  // Terra palette (no violet) + human-readable method labels.
  const colors = ["#0f766e", "#7c2d12", "#b45309", "#4d7c0f"];
  const labels: Record<string, string> = {
    "bank-transfer": "Bank Transfer",
    crypto: "Crypto",
    paypal: "PayPal",
    skrill: "Skrill",
  };
  const data = ["bank-transfer", "crypto", "paypal", "skrill"].map((m, i) => ({
    label: labels[m] ?? m,
    value: pays.filter((p) => p.method === m).length,
    color: colors[i],
  }));
  return <DonutSeries data={data} />;
}
