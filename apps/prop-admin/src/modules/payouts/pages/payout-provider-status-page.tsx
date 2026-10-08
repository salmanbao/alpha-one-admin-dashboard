"use client";

/**
 * Payout Provider Status — research item #23.
 *
 * Connects payout operations with infrastructure health.
 * Show provider, status, processing latency, failed transactions,
 * pending transactions, last successful payout, current incident.
 */

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { DollarSign, CheckCircle2, AlertTriangle, Clock, Globe, Zap } from "lucide-react";

interface PayoutProvider {
  id: string;
  name: string;
  type: string;
  status: "operational" | "degraded" | "down";
  latency: string;
  pendingTxns: number;
  failedTxns: number;
  lastSuccess: string;
  currentIncident: string | null;
}

const providers: PayoutProvider[] = [
  { id: "nowpayments", name: "NOWPayments", type: "Crypto", status: "operational", latency: "210ms", pendingTxns: 2, failedTxns: 0, lastSuccess: "15m ago", currentIncident: null },
  { id: "match2pay", name: "Match2Pay", type: "Bank Transfer", status: "operational", latency: "180ms", pendingTxns: 0, failedTxns: 0, lastSuccess: "1h ago", currentIncident: null },
  { id: "paypal", name: "PayPal", type: "Digital Wallet", status: "degraded", latency: "850ms", pendingTxns: 3, failedTxns: 2, lastSuccess: "45m ago", currentIncident: "PayPal API latency elevated — payouts taking 3-5min to confirm" },
  { id: "skrill", name: "Skrill", type: "Digital Wallet", status: "operational", latency: "320ms", pendingTxns: 1, failedTxns: 0, lastSuccess: "30m ago", currentIncident: null },
];

const statusTone = (s: PayoutProvider["status"]) =>
  s === "operational" ? "success" : s === "degraded" ? "warning" : "danger";

export function PayoutProviderStatusPage() {
  const operational = providers.filter((p) => p.status === "operational").length;
  const degraded = providers.filter((p) => p.status === "degraded").length;
  const totalPending = providers.reduce((s, p) => s + p.pendingTxns, 0);
  const totalFailed = providers.reduce((s, p) => s + p.failedTxns, 0);

  return (
    <Page>
      <PageHeader title="Payout Provider Status" description="Health and processing status for payout providers." icon={Globe} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Providers" value={providers.length} icon={Globe} />
          <MetricCard label="Operational" value={operational} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Degraded" value={degraded} icon={AlertTriangle} tone={degraded > 0 ? "warning" : "positive"} />
          <MetricCard label="Pending Payouts" value={totalPending} icon={Clock} tone={totalPending > 0 ? "warning" : "positive"} />
        </div>

        {totalFailed > 0 && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-50/50 p-3 dark:bg-rose-950/20">
            <p className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />{totalFailed} failed transaction{totalFailed === 1 ? "" : "s"} across providers — review and retry failed payouts.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {providers.map((p) => (
            <Card key={p.id} className={p.status === "degraded" ? "border-amber-500/40" : p.status === "down" ? "border-rose-500/40" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">{p.name}</h3>
                      <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
                    </div>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${p.status === "operational" ? "bg-emerald-500" : p.status === "degraded" ? "bg-amber-500" : "bg-rose-500"}`} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Latency</p><p className="font-medium tabular-nums">{p.latency}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last success</p><p className="font-medium">{p.lastSuccess}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending txns</p><p className={`font-medium tabular-nums ${p.pendingTxns > 0 ? "text-amber-600" : ""}`}>{p.pendingTxns}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Failed txns</p><p className={`font-medium tabular-nums ${p.failedTxns > 0 ? "text-rose-600" : ""}`}>{p.failedTxns}</p></div>
                </div>

                {p.currentIncident && (
                  <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-50/30 p-2 dark:bg-amber-950/10">
                    <p className="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      <Zap className="h-3 w-3" /> Active incident
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{p.currentIncident}</p>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between border-t pt-2">
                  <StatusBadge tone={statusTone(p.status)}>{p.status}</StatusBadge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageContent>
    </Page>
  );
}
