"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantPayouts, payoutSeries, type Payout } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { StatusBadge, payoutStatusTone, formatCurrency, formatCompact } from "@/components/platform/status";
import { applyPayoutDecision, effectivePayoutStatus, usePayoutVersion } from "@/modules/payouts/payout-store";
import { Wallet, Banknote, Clock, CheckCircle2, DollarSign } from "lucide-react";
import { AreaSeries, DonutSeries } from "@/components/platform/charts";
import { Button } from "@/components/ui/button";
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
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  usePayoutVersion(); // approved items leave the queue instantly
  const pending = getTenantPayouts(tid)
    .map((p) => ({ ...p, status: effectivePayoutStatus(p) }))
    .filter((p) => p.status === "pending")
    .slice(0, 5);
  if (pending.length === 0) {
    return <div className="p-4 text-sm text-emerald-600">No pending payouts. Queue is clear.</div>;
  }
  return (
    <ul className="space-y-2">
      {pending.map((p) => (
        <li key={p.id} className="flex items-center gap-3 rounded-md border bg-card p-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{p.traderName}</p>
            <p className="text-[10px] text-muted-foreground">{p.method} · {p.reference}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{formatCurrency(p.amount, currency)}</p>
            <p className="text-[10px] text-muted-foreground">{p.profitSplit}% split</p>
          </div>
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              applyPayoutDecision(p.reference, "approved");
              toast({ title: "Payout approved", description: `${p.traderName} — ${formatCurrency(p.amount, currency)}` });
            }}
          >
            Approve
          </Button>
        </li>
      ))}
    </ul>
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
