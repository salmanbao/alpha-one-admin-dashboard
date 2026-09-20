"use client";

/**
 * KYC Module — widgets.
 *
 *   1. KycOverviewWidget — metric row of KPIs (pending, in review, approved, rejected, high risk)
 *   2. KycQueueWidget    — alert/table widget showing pending submissions awaiting review
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantKyc } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { kycStatusTone, StatusBadge } from "@/components/platform/status";
import { Clock, FileSearch, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function KycOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const records = getTenantKyc(tid);
  const pending = records.filter((r) => r.status === "pending").length;
  const inReview = records.filter((r) => r.status === "review").length;
  const approved = records.filter((r) => r.status === "approved").length;
  const rejected = records.filter((r) => r.status === "rejected").length;
  const highRisk = records.filter((r) => r.riskLevel === "high").length;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <MetricCard label="Pending" value={pending} delta={-3} icon={Clock} tone="warning" />
      <MetricCard label="In Review" value={inReview} delta={1} icon={FileSearch} />
      <MetricCard label="Approved" value={approved} delta={8} icon={CheckCircle2} tone="positive" />
      <MetricCard label="Rejected" value={rejected} delta={-1} icon={XCircle} tone="negative" />
      <MetricCard label="High Risk" value={highRisk} delta={2} icon={AlertTriangle} tone="negative" />
    </div>
  );
}

export function KycQueueWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const records = getTenantKyc(tid);
  const queue = records
    .filter((r) => r.status === "pending" || r.status === "review")
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-600" />
          <span className="text-sm font-medium">Awaiting Review</span>
        </div>
        <Badge variant="secondary" className="text-xs">{queue.length} pending</Badge>
      </div>
      {queue.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
          No pending KYC submissions. Queue is clear.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {queue.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{r.traderName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.documentType} · {r.country}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.riskLevel === "high" && (
                  <Badge variant="outline" className="border-transparent bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                    High risk
                  </Badge>
                )}
                <StatusBadge tone={kycStatusTone(r.status)}>{r.status}</StatusBadge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
