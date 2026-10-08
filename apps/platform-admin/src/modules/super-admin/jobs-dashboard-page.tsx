"use client";

/**
 * Job / Scheduler Dashboard — research item #22.
 *
 * Shows background jobs with last-run, duration, next-run, status, lock
 * holder, failure count, and retry state.
 */

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { Zap, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  name: string;
  lastRun: string;
  duration: string;
  nextRun: string;
  status: "succeeded" | "running" | "failed" | "paused";
  lockHolder: string;
  failureCount: number;
  lastFailure: string;
}

const jobs: Job[] = [
  { id: "metering-rollup", name: "Metering Rollup", lastRun: "5m ago", duration: "2.3s", nextRun: "in 25m", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "reconciliation", name: "Payout Reconciliation", lastRun: "1h ago", duration: "8.7s", nextRun: "in 2h", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "notification-batch", name: "Notification Batch", lastRun: "3m ago", duration: "1.1s", nextRun: "in 2m", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "doc-generation", name: "Document Generation", lastRun: "12m ago", duration: "4.2s", nextRun: "in 18m", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "data-cleanup", name: "Data Cleanup", lastRun: "6h ago", duration: "15.3s", nextRun: "in 18h", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "backup-wal", name: "WAL Backup", lastRun: "18h ago", duration: "42.1s", nextRun: "in 6h", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "provider-health", name: "Provider Health Check", lastRun: "30s ago", duration: "0.8s", nextRun: "in 30s", status: "running", lockHolder: "worker-3", failureCount: 0, lastFailure: "—" },
  { id: "sync-accounts", name: "Account Sync (MT5)", lastRun: "2m ago", duration: "3.5s", nextRun: "in 1m", status: "failed", lockHolder: "—", failureCount: 3, lastFailure: "2m ago" },
  { id: "eval-engine", name: "Evaluation Engine Sweep", lastRun: "8m ago", duration: "5.6s", nextRun: "in 2m", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "audit-archive", name: "Audit Archive", lastRun: "—", duration: "—", nextRun: "in 12h", status: "paused", lockHolder: "—", failureCount: 0, lastFailure: "—" },
];

const statusTone = (s: Job["status"]) =>
  s === "succeeded" ? "success" : s === "running" ? "info" : s === "failed" ? "danger" : "muted";

const columns: Column<Job>[] = [
  { key: "name", header: "Job", cell: (j) => <span className="font-medium text-foreground">{j.name}</span>, sortValue: (j) => j.name },
  { key: "lastRun", header: "Last Run", cell: (j) => <span className="text-xs text-muted-foreground tabular-nums">{j.lastRun}</span>, sortValue: (j) => j.lastRun },
  { key: "duration", header: "Duration", cell: (j) => <span className="text-xs tabular-nums">{j.duration}</span>, sortValue: (j) => j.duration, numeric: true },
  { key: "nextRun", header: "Next Run", cell: (j) => <span className="text-xs text-muted-foreground tabular-nums">{j.nextRun}</span>, sortValue: (j) => j.nextRun },
  { key: "status", header: "Status", cell: (j) => <StatusBadge tone={statusTone(j.status)}>{j.status}</StatusBadge>, sortValue: (j) => j.status },
  { key: "lockHolder", header: "Lock", cell: (j) => <span className="text-xs font-mono">{j.lockHolder}</span>, sortValue: (j) => j.lockHolder },
  { key: "failures", header: "Failures", cell: (j) => <span className={cn("text-xs font-medium tabular-nums", j.failureCount > 0 ? "text-rose-600" : "")}>{j.failureCount}</span>, sortValue: (j) => j.failureCount, numeric: true },
  { key: "lastFailure", header: "Last Failure", cell: (j) => <span className="text-xs text-muted-foreground">{j.lastFailure}</span>, sortValue: (j) => j.lastFailure },
];

export function JobsDashboardPage() {
  const succeeded = jobs.filter((j) => j.status === "succeeded").length;
  const running = jobs.filter((j) => j.status === "running").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const paused = jobs.filter((j) => j.status === "paused").length;

  return (
    <Page>
      <PageHeader
        title="Jobs Dashboard"
        description="Background processing — scheduler status, failures, and retry state."
        icon={Zap}
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Succeeded" value={succeeded} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Running" value={running} icon={Clock} tone="positive" />
          <MetricCard label="Failed" value={failed} icon={XCircle} tone={failed > 0 ? "negative" : "positive"} />
          <MetricCard label="Paused" value={paused} icon={AlertTriangle} tone="warning" />
        </div>

        {failed > 0 && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-50/50 p-3 dark:bg-rose-950/20">
            <p className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              {failed} job{failed === 1 ? "" : "s"} failing — review the failure count and last-failure timestamp below.
            </p>
          </div>
        )}

        <DataTable
          columns={columns}
          data={jobs}
          rowKey={(j) => j.id}
          searchableText={(j) => `${j.name} ${j.status}`}
          searchPlaceholder="Search jobs…"
          pageSize={20}
          emptyTitle="No jobs"
          emptyDescription="Background jobs will appear here."
        />
      </PageContent>
    </Page>
  );
}
