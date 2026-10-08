"use client";

/**
 * KYC Module — widgets.
 *
 *   1. KycOverviewWidget — metric row of KPIs (pending, in review, approved, rejected, high risk)
 *   2. KycQueueWidget    — alert/table widget showing pending submissions awaiting review
 *
 * Reads from `effectiveKycStatus()` + `useKycVersion()` so KYC decisions
 * made on the Reviews / Risk pages instantly update the dashboard widget
 * (Round 3 wired pages; Round 4 wires widgets to the same store).
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantKyc } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { kycStatusTone, StatusBadge } from "@/components/platform/status";
import { Clock, FileSearch, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { effectiveKycStatus, useKycVersion } from "@/modules/kyc/kyc-store";
import { ChevronRight } from "lucide-react";

export function KycOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  // Subscribe to KYC store mutations so KPIs recompute on Approve/Reject/Request-Info.
  useKycVersion();
  const records = getTenantKyc(tid).map((r) => ({ ...r, status: effectiveKycStatus(r) }));
  const pending = records.filter((r) => r.status === "pending").length;
  const inReview = records.filter((r) => r.status === "review").length;
  const approved = records.filter((r) => r.status === "approved").length;
  const rejected = records.filter((r) => r.status === "rejected").length;
  const highRisk = records.filter((r) => r.riskLevel === "high").length;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <MetricCard label="Pending" value={pending} icon={Clock} tone={pending > 0 ? "warning" : "positive"} />
      <MetricCard label="In Review" value={inReview} icon={FileSearch} />
      <MetricCard label="Approved" value={approved} icon={CheckCircle2} tone="positive" />
      <MetricCard label="Rejected" value={rejected} icon={XCircle} tone={rejected > 0 ? "negative" : "positive"} />
      <MetricCard label="High Risk" value={highRisk} icon={AlertTriangle} tone={highRisk > 0 ? "negative" : "positive"} />
    </div>
  );
}

export function KycQueueWidget() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useKycVersion();
  const records = getTenantKyc(tid).map((r) => ({ ...r, status: effectiveKycStatus(r) }));
  const queue = records
    .filter((r) => r.status === "pending" || r.status === "review")
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400" />
          <span className="truncate text-sm font-medium">Awaiting Review</span>
        </div>
        <button
          type="button"
          onClick={() => queue.length > 0 && navigate("kyc-reviews")}
          disabled={queue.length === 0}
          aria-label="Open KYC review queue"
          className="inline-flex shrink-0 items-center gap-1 rounded text-xs font-medium text-foreground hover:text-foreground/80 disabled:opacity-50"
        >
          <Badge variant="secondary" className="shrink-0 text-xs">{queue.length} pending</Badge>
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      {queue.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
          No pending KYC submissions. Queue is clear.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {queue.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => navigate("kyc-reviews")}
              aria-label={`Review ${r.traderName}'s KYC submission`}
              className="flex w-full items-center gap-2.5 rounded-md border bg-card p-2 text-left transition hover:bg-accent/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{r.traderName}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {r.documentType} · {r.country}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.riskLevel === "high" && (
                  <Badge variant="outline" className="border-transparent bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                    High risk
                  </Badge>
                )}
                <StatusBadge tone={kycStatusTone(r.status)}>{r.status}</StatusBadge>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
