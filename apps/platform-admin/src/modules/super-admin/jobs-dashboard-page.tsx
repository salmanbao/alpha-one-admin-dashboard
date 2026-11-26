"use client";

/**
 * Job / Scheduler Dashboard — research item #22.
 * 
 * Shows background jobs with last-run, duration, next-run, status, lock holder, failure count, and retry state.
 * 
 * P0-4: job status transitions persist under pfaas:platform-admin:jobs.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { Zap, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useJobOverrides, markJobStatus, effectiveJobs, type Job } from "@/lib/platform/jobs-store";
import { usePlatform } from "@/lib/platform/platform-context";

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
  const { user } = usePlatform();
  const overrides = useJobOverrides();
  const rows = useMemo(() => effectiveJobs(overrides), [overrides]);
  const succeeded = rows.filter((j) => j.status === "succeeded").length;
  const running = rows.filter((j) => j.status === "running").length;
  const failed = rows.filter((j) => j.status === "failed").length;
  const paused = rows.filter((j) => j.status === "paused").length;

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleRowClick = (job: Job) => {
    setSelectedJob(job);
    setIsSheetOpen(true);
  };

  const handleRunNow = () => {
    if (!selectedJob) return;
    markJobStatus(
      selectedJob.id,
      selectedJob.name,
      { status: "running", lastRun: "just now" },
      { action: "jobs.run_now", detail: `Manual run triggered for ${selectedJob.name}`, severity: "info" },
      user?.name ?? "Console operator",
    );
    toast({ title: "Job triggered", description: `${selectedJob.name} — run queued` });
    setIsSheetOpen(false);
  };

  const handlePause = () => {
    if (!selectedJob) return;
    if (selectedJob.status === "running") {
      markJobStatus(
        selectedJob.id,
        selectedJob.name,
        { status: "paused", lastRun: "just now" },
        { action: "jobs.pause", detail: `Paused ${selectedJob.name}`, severity: "warning" },
        user?.name ?? "Console operator",
      );
      toast({ title: "Job paused", description: `${selectedJob.name} — paused` });
      setIsSheetOpen(false);
    }
  };

  const handleRetry = () => {
    if (!selectedJob) return;
    if (selectedJob.status === "failed") {
      markJobStatus(
        selectedJob.id,
        selectedJob.name,
        { status: "running", lastRun: "just now" },
        { action: "jobs.retry", detail: `Retry scheduled for ${selectedJob.name}`, severity: "info" },
        user?.name ?? "Console operator",
      );
      toast({ title: "Retry queued", description: `${selectedJob.name} — retry scheduled` });
      setIsSheetOpen(false);
    }
  };

  const handleResume = () => {
    if (!selectedJob) return;
    if (selectedJob.status === "paused") {
      markJobStatus(
        selectedJob.id,
        selectedJob.name,
        { status: "running", lastRun: "just now" },
        { action: "jobs.resume", detail: `Resumed ${selectedJob.name}`, severity: "info" },
        user?.name ?? "Console operator",
      );
      toast({ title: "Job resumed", description: `${selectedJob.name} — resumed` });
      setIsSheetOpen(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Jobs Dashboard"
        description="Background processing — scheduler status, failures, and retry state."
        icon={Zap}
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          data={rows}
          rowKey={(j) => j.id}
          searchableText={(j) => `${j.name} ${j.status}`}
          searchPlaceholder="Search jobs…"
          pageSize={20}
          emptyTitle="No jobs"
          emptyDescription="Background jobs will appear here."
          onRowClick={handleRowClick}
        />

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetHeader>
            <SheetTitle>{selectedJob?.name}</SheetTitle>
            <SheetDescription>Job ID: {selectedJob?.id}</SheetDescription>
          </SheetHeader>
          <SheetContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="font-medium text-muted-foreground">Status</p>
                <p className="mt-0.5 text-muted-foreground">{selectedJob?.status}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Last Run</p>
                <p className="mt-0.5 text-muted-foreground">{selectedJob?.lastRun}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Duration</p>
                <p className="mt-0.5 text-muted-foreground">{selectedJob?.duration}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Next Run</p>
                <p className="mt-0.5 text-muted-foreground">{selectedJob?.nextRun}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Lock Holder</p>
                <p className="mt-0.5 font-mono">{selectedJob?.lockHolder}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Failures</p>
                <p className="mt-0.5 text-rose-600 font-medium">{selectedJob?.failureCount}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Last Failure</p>
                <p className="mt-0.5 text-muted-foreground">{selectedJob?.lastFailure}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="default" onClick={handleRunNow}>
                Run Now
              </Button>
              {selectedJob?.status === "running" && (
                <Button size="sm" variant="outline" onClick={handlePause}>
                  Pause
                </Button>
              )}
              {selectedJob?.status === "failed" && (
                <Button size="sm" variant="default" onClick={handleRetry}>
                  Retry
                </Button>
              )}
              {selectedJob?.status === "paused" && (
                <Button size="sm" variant="default" onClick={handleResume}>
                  Resume
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setIsSheetOpen(false)}>
                Close
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </PageContent>
    </Page>
  );
}