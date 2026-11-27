"use client";

/**
 * Job / Scheduler Dashboard — research item #22.
 * 
 * Shows background jobs with last-run, duration, next-run, status, lock holder, failure count, and retry state.
 * 
 * P0-4: job status transitions persist under pfaas:platform-admin:jobs.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { useMemo, useState, useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import { Zap, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { toast } from "@/hooks/use-toast";
import { useJobOverrides, markJobStatus, effectiveJobs, type Job, formatRelativeTime, formatDurationMs } from "@/lib/platform/jobs-store";
import { usePlatform } from "@/lib/platform/platform-context";

const statusTone = (s: Job["status"]) =>
  s === "succeeded" ? "success" : s === "running" ? "info" : s === "failed" ? "danger" : "muted";

function useTicker(intervalMs: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

const columns: Column<Job>[] = [
  { key: "name", header: "Job", cell: (j) => <span className="font-medium text-foreground">{j.name}</span>, sortValue: (j) => j.name },
  { key: "lastRun", header: "Last Run", cell: (j) => <span className="text-xs text-muted-foreground tabular-nums">{formatRelativeTime(j.lastRunAt)}</span>, sortValue: (j) => j.lastRunAt ?? 0 },
  { key: "duration", header: "Duration", cell: (j) => <span className="text-xs tabular-nums">{formatDurationMs(j.durationMs)}</span>, sortValue: (j) => j.durationMs ?? 0, numeric: true },
  { key: "nextRun", header: "Next Run", cell: (j) => <span className="text-xs text-muted-foreground tabular-nums">{formatRelativeTime(j.nextRunAt)}</span>, sortValue: (j) => j.nextRunAt ?? 0 },
  { key: "status", header: "Status", cell: (j) => <StatusBadge tone={statusTone(j.status)}>{j.status}</StatusBadge>, sortValue: (j) => j.status },
  { key: "lockHolder", header: "Lock", cell: (j) => <span className="text-xs font-mono">{j.lockHolder ?? "—"}</span>, sortValue: (j) => (j.lockHolder ?? "").charCodeAt(0) || 0 },
  { key: "failures", header: "Failures", cell: (j) => <span className={cn("text-xs font-medium tabular-nums", j.failureCount > 0 ? "text-rose-600" : "")}>{j.failureCount}</span>, sortValue: (j) => j.failureCount, numeric: true },
  { key: "lastFailure", header: "Last Failure", cell: (j) => <span className="text-xs text-muted-foreground">{j.lastFailure === "—" ? "—" : formatRelativeTime(j.lastFailure.startsWith("in") ? 0 : j.lastFailure === "just now" ? Date.now() : 0)}</span>, sortValue: (j) => (j.lastFailure === "—" ? -1 : j.lastFailure === "just now" ? 0 : 1) },
];

export function JobsDashboardPage() {
  const { user, navigate } = usePlatform();
  const searchParams = useSearchParams();
  const hasJobsManagePermission = user?.application === "super-admin"; // For now, assume super-admin has manage permission
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const overrides = useJobOverrides();
  const rows = useMemo(() => effectiveJobs(overrides), [overrides]);
  const succeeded = rows.filter((j) => j.status === "succeeded").length;
  const running = rows.filter((j) => j.status === "running").length;
  const failed = rows.filter((j) => j.status === "failed").length;
  const paused = rows.filter((j) => j.status === "paused").length;

  // Tick every 30s so relative-time labels (Last Run / Next Run) stay current.
  useTicker(30_000);

  // Parse URL params for deep linking and URL state
  const jobId = searchParams.get("job");
  const status = searchParams.get("status");

  // Handle sheet auto-open with ?job=<id>
  useEffect(() => {
    if (jobId) {
      const job = rows.find(j => j.id === jobId);
      if (job) {
        setSelectedJob(job);
        setIsSheetOpen(true);
      }
    }
  }, [jobId, rows]);

  // Filter by status if ?status= is provided
  const filteredRows = useMemo(() => {
    if (status) {
      return rows.filter(j => j.status === status);
    }
    return rows;
  }, [status, rows]);

  const handleRowClick = (job: Job) => {
    setSelectedJob(job);
    setIsSheetOpen(true);
  };

  const handleRunNow = () => {
    if (!selectedJob || !hasJobsManagePermission) {
      if (!hasJobsManagePermission) {
        toast({ title: "Access denied", description: "You need manage permissions to run jobs.", variant: "destructive" });
      }
      return;
    }
    const now = Date.now();
    markJobStatus(
      selectedJob.id,
      selectedJob.name,
      { status: "running", lastRunAt: now, durationMs: null, nextRunAt: null, lockHolder: "worker-1" },
      { action: "jobs.run_now", detail: `Manual run triggered for ${selectedJob.name}`, severity: "info" },
      user?.name ?? "Console operator",
    );
    toast({ title: "Job triggered", description: `${selectedJob.name} — run queued` });
    setIsSheetOpen(false);
    setSelectedJob(null);
  };

  const handlePause = () => {
    if (!selectedJob || !hasJobsManagePermission) {
      if (!hasJobsManagePermission) {
        toast({ title: "Access denied", description: "You need manage permissions to pause jobs.", variant: "destructive" });
      }
      return;
    }
    if (selectedJob.status === "running") {
      const now = Date.now();
      markJobStatus(
        selectedJob.id,
        selectedJob.name,
        { status: "paused", lastRunAt: now, nextRunAt: null, lockHolder: null },
        { action: "jobs.pause", detail: `Paused ${selectedJob.name}`, severity: "warning" },
        user?.name ?? "Console operator",
      );
      toast({ title: "Job paused", description: `${selectedJob.name} — paused` });
      setIsSheetOpen(false);
      setSelectedJob(null);
    }
  };

  const handleRetry = () => {
    if (!selectedJob || !hasJobsManagePermission) {
      if (!hasJobsManagePermission) {
        toast({ title: "Access denied", description: "You need manage permissions to retry jobs.", variant: "destructive" });
      }
      return;
    }
    if (selectedJob.status === "failed") {
      const now = Date.now();
      markJobStatus(
        selectedJob.id,
        selectedJob.name,
        { status: "running", lastRunAt: now, durationMs: null, nextRunAt: null, failureCount: 0, lastFailure: "—", lockHolder: "worker-1" },
        { action: "jobs.retry", detail: `Retry scheduled for ${selectedJob.name}`, severity: "info" },
        user?.name ?? "Console operator",
      );
      toast({ title: "Retry queued", description: `${selectedJob.name} — retry scheduled` });
      setIsSheetOpen(false);
      setSelectedJob(null);
    }
  };

  const handleResume = () => {
    if (!selectedJob || !hasJobsManagePermission) {
      if (!hasJobsManagePermission) {
        toast({ title: "Access denied", description: "You need manage permissions to resume jobs.", variant: "destructive" });
      }
      return;
    }
    if (selectedJob.status === "paused") {
      const now = Date.now();
      markJobStatus(
        selectedJob.id,
        selectedJob.name,
        { status: "running", lastRunAt: now, durationMs: null, nextRunAt: null, lockHolder: "worker-1" },
        { action: "jobs.resume", detail: `Resumed ${selectedJob.name}`, severity: "info" },
        user?.name ?? "Console operator",
      );
      toast({ title: "Job resumed", description: `${selectedJob.name} — resumed` });
      setIsSheetOpen(false);
      setSelectedJob(null);
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
             <div className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-400">
               <AlertTriangle className="h-4 w-4" />
               {failed} job{failed === 1 ? "" : "s"} failing — review the failure count and last-failure timestamp below.
             </div>
             <div className="flex items-center gap-3 mt-2">
               <Button size="sm" variant="default" onClick={() => { window.location.search = "?status=failed"; }}>
                 Show failed jobs
               </Button>
               <Button size="sm" variant="default" onClick={() => {
                 const failedJobIds = rows.filter(j => j.status === "failed").map(j => j.id).join(",");
                 if (failedJobIds) {
                   navigate("jobs-dashboard", { job: failedJobIds }, { replace: false });
                 }
               }}>
                 Retry all failed
               </Button>
             </div>
           </div>
         )}

        <DataTable
          columns={columns}
          data={filteredRows}
          rowKey={(j) => j.id}
          searchableText={(j) => `${j.name} ${j.status}`}
          searchPlaceholder="Search jobs…"
          pageSize={20}
          emptyTitle="No jobs"
          emptyDescription="Background jobs will appear here."
          onRowClick={handleRowClick}
          state={{ search: searchParams.get('q') || '', sortKey: searchParams.get('sort') || null, sortDir: (searchParams.get('dir') || 'asc') as 'desc' | 'asc', page: parseInt(searchParams.get('page') || '1', 10) }}
          onStateChange={(next) => {
            const newSearchParams = new URLSearchParams();
            if (next.search) newSearchParams.set('q', next.search);
            if (next.sortKey) newSearchParams.set('sort', next.sortKey);
            if (next.sortDir) newSearchParams.set('dir', next.sortDir);
            if (next.page) newSearchParams.set('page', String(next.page));
            const href = `${window.location.pathname}?${newSearchParams.toString()}`;
            window.history.pushState({}, '', href);
            setSelectedJob(null);
          }}
          exportCsv={{ filename: "jobs", headers: ['Job', 'Last Run', 'Duration', 'Next Run', 'Status', 'Lock', 'Failures', 'Last Failure'], toRow: (j) => [j.name, formatRelativeTime(j.lastRunAt), formatDurationMs(j.durationMs), formatRelativeTime(j.nextRunAt), j.status, j.lockHolder ?? '—', String(j.failureCount), j.lastFailure] }}
        />

        <Sheet
          open={isSheetOpen}
          onOpenChange={(open) => {
            if (!open) setSelectedJob(null);
            setIsSheetOpen(open);
          }}
        >
          <SheetContent className="space-y-4">
            <SheetHeader>
              <SheetTitle>{selectedJob?.name}</SheetTitle>
              <SheetDescription>Job ID: {selectedJob?.id}</SheetDescription>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="font-medium text-muted-foreground">Status</p>
                <p className="mt-0.5 text-muted-foreground">{selectedJob?.status}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Last Run</p>
                <p className="mt-0.5 text-muted-foreground">{formatRelativeTime(selectedJob?.lastRunAt ?? null)}</p>
              </div>
              <div>
                 <p className="font-medium text-muted-foreground">Schedule</p>
                 <p className="mt-0.5 text-muted-foreground">{selectedJob?.schedule ?? "—"}</p>
               </div>
              <div>
                <p className="font-medium text-muted-foreground">Duration</p>
                <p className="mt-0.5 text-muted-foreground">{formatDurationMs(selectedJob?.durationMs ?? null)}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Next Run</p>
                <p className="mt-0.5 text-muted-foreground">{formatRelativeTime(selectedJob?.nextRunAt ?? null)}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Lock Holder</p>
                <p className="mt-0.5 font-mono">{selectedJob?.lockHolder ?? "—"}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Failures</p>
                <p className="mt-0.5 text-rose-600 font-medium">{selectedJob?.failureCount}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Last Failure</p>
                <p className="mt-0.5 text-muted-foreground">{selectedJob?.lastFailure === "—" ? "—" : formatRelativeTime(0)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="default" onClick={handleRunNow}>
                Run Now
              </Button>
              {selectedJob?.status === "running" && (
                <SensitiveActionDialog
                  open={selectedJob?.status === "running"}
                  onOpenChange={(open) => setIsSheetOpen(open)}
                  actionKey="jobs.run_pause"
                  title="Pause Job"
                  consequence="Pause this job so it can be safely retried or manually resumed."
                  blastRadius={['pause job execution']}
                  confirmPhrase="Pause"
                  requireReason={true}
                  onExecute={(reason) => {
                    const now = Date.now();
                    markJobStatus(
                      selectedJob.id,
                      selectedJob.name,
                      { status: "paused", lastRunAt: now, nextRunAt: null, lockHolder: null },
                      { action: "jobs.pause", detail: `Paused ${selectedJob.name} - ${reason}`, severity: "warning" },
                      user?.name ?? "Console operator",
                    );
                    toast({ title: "Job paused", description: `${selectedJob.name} — paused (${reason})` });
                    setIsSheetOpen(false);
                    setSelectedJob(null);
                  }}
                />
              )}
              {selectedJob?.status === "failed" && (
                <SensitiveActionDialog
                  open={selectedJob?.status === "failed"}
                  onOpenChange={(open) => setIsSheetOpen(open)}
                  actionKey="jobs.run_retry"
                  title="Retry Job"
                  consequence="Retry this job to attempt recovery from the last failure."
                  blastRadius={['retry job execution']}
                  confirmPhrase="Retry"
                  requireReason={true}
                  onExecute={(reason) => {
                    const now = Date.now();
                    markJobStatus(
                      selectedJob.id,
                      selectedJob.name,
                      { status: "running", lastRunAt: now, durationMs: null, nextRunAt: null, failureCount: 0, lastFailure: "—", lockHolder: "worker-1" },
                      { action: "jobs.retry", detail: `Retry scheduled for ${selectedJob.name} - ${reason}`, severity: "info" },
                      user?.name ?? "Console operator",
                    );
                    toast({ title: "Retry queued", description: `${selectedJob.name} — retry scheduled (${reason})` });
                    setIsSheetOpen(false);
                    setSelectedJob(null);
                  }}
                />
              )}
              {selectedJob?.status === "paused" && (
                <SensitiveActionDialog
                  open={selectedJob?.status === "paused"}
                  onOpenChange={(open) => setIsSheetOpen(open)}
                  actionKey="jobs.run_resume"
                  title="Resume Job"
                  consequence="Resume this job to continue from its paused state."
                  blastRadius={['resume job execution']}
                  confirmPhrase="Resume"
                  requireReason={true}
                  onExecute={(reason) => {
                    const now = Date.now();
                    markJobStatus(
                      selectedJob.id,
                      selectedJob.name,
                      { status: "running", lastRunAt: now, durationMs: null, nextRunAt: null, lockHolder: "worker-1" },
                      { action: "jobs.resume", detail: `Resumed ${selectedJob.name} - ${reason}`, severity: "info" },
                      user?.name ?? "Console operator",
                    );
                    toast({ title: "Job resumed", description: `${selectedJob.name} — resumed (${reason})` });
                    setIsSheetOpen(false);
                    setSelectedJob(null);
                  }}
                />
              )}
              <Button size="sm" variant="outline" onClick={() => { setIsSheetOpen(false); setSelectedJob(null); }}>
                Close
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </PageContent>
    </Page>
  );
}