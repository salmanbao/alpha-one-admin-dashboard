"use client";

/**
 * Provisioning Saga — live view of the CON-03 job (docs/21 CON-03 ← 03 §3.5).
 *
 * The console "is a live view of the saga": step state, blockers, a retry
 * button per failed step, and operator-driven compensation (the spec's
 * compensation column). The tenant's status transitions are applied from
 * here: step 2 ran → `provisioning`, step 9 done → `onboarding`, terminal
 * failure → `provisioning_failed` until resume, compensation → rolled back.
 *
 * Demo: step 5 (DNS) always fails on its first attempt — press Retry to
 * resume the job (idempotent step, job context preserved).
 */

import { useEffect, useRef } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  useProvisioningStore,
  retryStep,
  compensateJob,
  type ProvisioningJob,
  type SagaStep,
} from "@/lib/platform/provisioning-saga";
import { recordAudit } from "@/lib/platform/console-store";
import { EmptyState } from "@/components/platform/guards";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  GitBranch,
  Loader2,
  Play,
  RotateCcw,
  Server,
  Undo2,
  XCircle,
} from "lucide-react";

const stateTone = (s: SagaStep["state"]) =>
  s === "completed"
    ? "success"
    : s === "failed"
      ? "danger"
      : s === "running"
        ? "warning"
        : s === "skipped"
          ? "muted"
          : s === "compensated"
            ? "info"
            : "muted";

function StepIcon({ state }: { state: SagaStep["state"] }) {
  if (state === "completed")
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (state === "failed")
    return <XCircle className="h-4 w-4 text-destructive" />;
  if (state === "running")
    return <Loader2 className="h-4 w-4 animate-spin text-amber-600" />;
  if (state === "skipped")
    return <CircleDashed className="h-4 w-4 text-muted-foreground/50" />;
  if (state === "compensated")
    return <Undo2 className="h-4 w-4 text-muted-foreground" />;
  return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
}

export function ProvisioningSagaPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; store-driven
  // state below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { router, navigate, availableTenants, setTenant, pushNotification, user } =
    usePlatform();
  const store = useProvisioningStore();
  const job = store.jobs.find((j) => j.id === router.params.job);

  /* ---- Apply tenant status transitions from the job state ---- */
  const applied = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!job) return;
    const key = `${job.id}:${job.state}`;
    if (applied.current.has(key)) return;
    const tenant = availableTenants.find((t) => t.id === job.tenantId);
    if (!tenant) return;
    applied.current.add(key);

    if (job.state === "completed" && tenant.status !== "onboarding") {
      setTenant({ ...tenant, status: "onboarding" });
      recordAudit({
        actor: job.createdBy,
        action: "tenant.provisioned",
        target: tenant.id,
        tenantId: tenant.id,
        severity: "info",
        detail: `Provisioning saga ${job.id} completed — ${done}/${runnable} steps, status=onboarding`,
      });
      pushNotification({
        title: `${tenant.name} provisioned`,
        message: "All 9 saga steps completed — onboarding checklist started.",
        severity: "success",
        module: "super-admin",
      });
      toast({
        title: "Provisioning complete",
        description: `${tenant.name} is onboarding — invite sent to the owner.`,
      });
    } else if (job.state === "blocked" && tenant.status !== "provisioning_failed") {
      setTenant({ ...tenant, status: "provisioning_failed" });
      recordAudit({
        actor: "system",
        action: "tenant.provisioning_failed",
        target: tenant.id,
        tenantId: tenant.id,
        severity: "warning",
        detail: `Saga ${job.id} blocked at step ${job.blocker?.stepNum} — ${job.blocker?.message}`,
      });
      pushNotification({
        title: `Provisioning blocked: ${tenant.name}`,
        message: `Step ${job.blocker?.stepNum} failed — manual resume required from the console.`,
        severity: "warning",
        module: "super-admin",
      });
    } else if (job.state === "compensated") {
      setTenant({ ...tenant, status: "invited" });
      recordAudit({
        actor: user.name,
        action: "tenant.provisioning_compensated",
        target: tenant.id,
        tenantId: tenant.id,
        severity: "warning",
        detail: `Saga ${job.id} compensated — completed steps rolled back in reverse order`,
      });
    }
  }, [job, job?.state, availableTenants, setTenant, pushNotification, user.name]);

  if (!job) {
    return (
      <Page>
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("create-tenant")}>
          <ArrowLeft className="mr-1 h-4 w-4" />Back
        </Button>
        <EmptyState
          title="Provisioning job not found"
          description="This job may have been created in another session, or the link is stale."
          icon={GitBranch}
          hint="Start a new provisioning run from Create Tenant."
        />
      </Page>
    );
  }

  const tenant = availableTenants.find((t) => t.id === job.tenantId);
  const done = job.steps.filter((s) => s.state === "completed").length;
  const runnable = job.steps.filter((s) => s.state !== "skipped").length;
  const pct = Math.round(
    (job.steps.filter((s) => s.state === "completed" || s.state === "compensated").length /
      runnable) *
      100,
  );
  const failedStep = job.steps.find((s) => s.state === "failed");
  const isRoot = (s: SagaStep) => !s.subOf;

  const onRetry = () => {
    if (!failedStep) return;
    const ok = retryStep(job.id, failedStep.num);
    if (ok) {
      recordAudit({
        actor: user.name,
        action: "console.operator_action",
        target: `provisioning.step_${failedStep.num}`,
        tenantId: job.tenantId,
        severity: "warning",
        detail: `Retried failed saga step ${failedStep.num} on ${job.id} (idempotent resume)`,
      });
      toast({
        title: `Retrying step ${failedStep.num}`,
        description: `${job.tenantName} — job context preserved, resuming from the failed step.`,
      });
    }
  };

  const onCompensate = () => {
    compensateJob(job.id);
    toast({
      title: "Compensation started",
      description: `${job.tenantName} — completed steps rolled back in reverse order (audited).`,
      variant: "destructive",
    });
  };

  return (
    <Page>
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("create-tenant")}>
        <ArrowLeft className="mr-1 h-4 w-4" />Back to wizard
      </Button>

      <PageHeader
        title={`Provisioning: ${job.tenantName}`}
        description={`Job ${job.id} · plan ${job.plan} · slug ${job.slug}. This screen is the live saga view — step state, blockers, per-step retry, operator-driven compensation.`}
        icon={GitBranch}
        actions={
          <>
            <Badge
              variant={
                job.state === "completed"
                  ? "default"
                  : job.state === "blocked"
                    ? "destructive"
                    : "secondary"
              }
              className="capitalize"
            >
              {job.state}
            </Badge>
            {tenant ? (
              <Button size="sm" variant="outline" onClick={() => navigate("tenant-detail", { id: tenant.id })}>
                Tenant detail <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : null}
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading saga…"
        >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Steps complete" value={`${done}/${runnable}`} icon={CheckCircle2} tone={job.state === "blocked" ? "warning" : "positive"} />
          <MetricCard label="Progress" value={`${pct}%`} icon={Activity} />
          <MetricCard label="Job id" value={job.id.slice(0, 12)} icon={GitBranch} />
          <MetricCard
            label="Blocked" value={job.blocker ? 1 : 0} icon={AlertTriangle}
            tone={job.blocker ? "negative" : "positive"}
          />
        </div>

        <Progress value={pct} className="h-2" />

        {/* ── Blocker panel (spec: blockers + retry per failed step) ── */}
        {job.state === "blocked" && failedStep ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Blocked at step {failedStep.num} — manual resume required
            </p>
            <p className="mt-1 text-sm">{failedStep.error}</p>
            <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <span>Compensate: <span className="text-foreground">{failedStep.compensate}</span></span>
              <span>Spec fail-mode: <span className="text-foreground">{failedStep.failMode}</span></span>
              <span>Attempts: <span className="text-foreground">{failedStep.attempts}</span></span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={onRetry}>
                <Play className="mr-1 h-3.5 w-3.5" /> Retry step {failedStep.num}
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={onCompensate}>
                <Undo2 className="mr-1 h-3.5 w-3.5" /> Compensate completed steps
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Retries are idempotent and the job context (`provisioning_jobs`) is preserved —
              the saga resumes from this exact step, not from the start.
            </p>
          </div>
        ) : null}

        {job.state === "completed" ? (
          <div className="rounded-lg border border-emerald-600/40 bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Provisioning complete — tenant is onboarding
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              All {runnable} runnable steps completed (skipped sub-steps excluded). Owner invite
              (step 8) was sent; the ADM-39 onboarding checklist starts on the tenant side.
              Recorded as `tenant.provisioned` in the audit trail.
            </p>
          </div>
        ) : null}

        {job.state === "compensated" ? (
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Undo2 className="h-4 w-4" /> Job compensated
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Completed steps were rolled back in reverse order (compensation column of the
              spec table). The tenant was reset to `invited` — start a fresh run when ready.
            </p>
          </div>
        ) : null}

        {/* ── Live step view ─────────────────────────────────────── */}
        <Card>
          <CardContent className="space-y-1 p-4">
            {job.steps.map((step) => (
              <div key={step.num}>
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-md px-2 py-2",
                    step.subOf && "ml-6 border-l-2 border-muted pl-3",
                    step.state === "running" && "bg-amber-50/60 dark:bg-amber-950/20",
                    step.state === "failed" && "bg-destructive/5",
                    step.state === "skipped" && "opacity-60",
                  )}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                    <StepIcon state={step.state} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[9px]">{step.num}</Badge>
                      <span className="text-sm font-medium">{step.title}</span>
                      <Badge
                        variant={
                          stateTone(step.state) === "danger"
                            ? "destructive"
                            : stateTone(step.state) === "success"
                              ? "default"
                              : "secondary"
                        }
                        className="text-[9px] capitalize"
                      >
                        {step.state}
                      </Badge>
                      {step.attempts > 0 ? (
                        <span className="text-[10px] text-muted-foreground">
                          attempt {step.attempts}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Compensate: {step.compensate} · fails → {step.failMode}
                      {step.error ? (
                        <span className="text-destructive"> · {step.error}</span>
                      ) : null}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How the saga works (03 §3.5)</p>
          <p className="mt-1">
            The orchestrator runs in workers on a PG `FOR UPDATE SKIP LOCKED` job queue. Every
            step is idempotent with a timeout and ≤3 retries; on terminal failure the tenant
            becomes `provisioning_failed`, an alert lands in the console, and the job context is
            saved here for manual resume. Step 3a runs only when the tenant contracted SSO.
            Compensation (rollback of completed steps) is operator-driven from this screen.
          </p>
          <p className="mt-1 flex items-center gap-1">
            <Server className="h-3 w-3" /> Started by {job.createdBy} ·{" "}
            <RotateCcw className="ml-2 h-3 w-3" /> demo: step 5 fails on attempt 1 — retry to resume.
          </p>
        </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
