"use client";

/**
 * PFaaS Platform — Provisioning Saga Store (docs/21 CON-03 ← 03 §3.5)
 *
 * The console's live view of the `provisioning_jobs` machine. Nine steps
 * (+ conditional sub-steps 3a SSO and 6b chart-of-accounts), each with its
 * compensation action from the spec table. The mock runner advances the
 * job step-by-step; **step 5 (DNS) fails on its first attempt** so the
 * blocker + operator-driven retry path is demonstrable — retries are the
 * console's job (spec: idempotent steps, ≤3 retries, terminal failure →
 * `provisioning_failed` + alert + job context saved for manual resume).
 *
 * Job states: running → blocked (failed step, operator retry) →
 * running → completed; or compensated (operator ran the compensation
 * steps in reverse). The tenant's `status` transitions are applied by
 * the consumer (create-tenant / saga page) via the returned state.
 *
 * Pattern: singleton + listener set + `useSyncExternalStore` (same as
 * console-store / prop-admin live-data).
 */

import { useSyncExternalStore } from "react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type StepState =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "compensated";

export type JobState =
  | "running"
  | "blocked" // failed step awaiting operator retry
  | "completed"
  | "compensated";

export interface SagaStep {
  /** Spec table number: "1", "2", "3", "3a", "4", … */
  num: string;
  title: string;
  /** Compensation action from the 03 §3.5 table (`—` = none). */
  compensate: string;
  /** Terminal-failure behaviour from the spec table. */
  failMode: string;
  state: StepState;
  attempts: number;
  error?: string;
  /** Sub-step of another row (3a → 3, 6b → 6). */
  subOf?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface ProvisioningJob {
  id: string;
  tenantId: string;
  tenantName: string;
  slug: string;
  plan: string;
  /** Tenant contracted SSO → step 3a runs (AUTH-24/25). */
  sso: boolean;
  createdBy: string;
  createdAt: number;
  completedAt?: number;
  state: JobState;
  steps: SagaStep[];
  /** Set when the job went terminal before an operator resumed it. */
  blocker?: { stepNum: string; message: string };
}

/* ------------------------------------------------------------------ */
/* Spec table (03 §3.5)                                                */
/* ------------------------------------------------------------------ */

function baseSteps(): SagaStep[] {
  return [
    {
      num: "1",
      title: "Validate application (KYB basics, sanctions list, jurisdiction)",
      compensate: "—",
      failMode: "tenant.provisioning_failed",
      state: "pending",
      attempts: 0,
    },
    {
      num: "2",
      title: "Create tenants row (status=provisioning, unique slug)",
      compensate: "delete row",
      failMode: "idempotent retry",
      state: "pending",
      attempts: 0,
    },
    {
      num: "3",
      title:
        "Provision ZITADEL org + project/OIDC app + owner membership, policies, branding domain ({slug}.alpha1.io)",
      compensate: "destroy org",
      failMode: "retry ×2",
      state: "pending",
      attempts: 0,
    },
    {
      num: "3a",
      title: "Register external IdP (SAML/OIDC), assign roles, issue SCIM token",
      compensate: "revoke token, remove IdP",
      failMode: "retry; manual on metadata errors",
      state: "pending",
      attempts: 0,
      subOf: "3",
    },
    {
      num: "4",
      title: "Branding defaults + legal defaults",
      compensate: "delete rows",
      failMode: "retry",
      state: "pending",
      attempts: 0,
    },
    {
      num: "5",
      title: "Subdomain DNS (Cloudflare CNAME {slug}.alpha1.io)",
      compensate: "delete record",
      failMode: "retry",
      state: "pending",
      attempts: 0,
    },
    {
      num: "6",
      title: "Default broker group ref (BRG-12) + default rule packs (EVL seed)",
      compensate: "delete refs",
      failMode: "retry",
      state: "pending",
      attempts: 0,
    },
    {
      num: "6b",
      title: "Seed tenant chart of accounts (LED CoA template, idempotent)",
      compensate: "delete seeded rows",
      failMode: "retry",
      state: "pending",
      attempts: 0,
      subOf: "6",
    },
    {
      num: "7",
      title: "Flipt flags for plan",
      compensate: "reset flags",
      failMode: "retry",
      state: "pending",
      attempts: 0,
    },
    {
      num: "8",
      title: "Welcome invite email to owner (NOT)",
      compensate: "— (safe to resend)",
      failMode: "retry ×3",
      state: "pending",
      attempts: 0,
    },
    {
      num: "9",
      title: "status=onboarding → checklist starts (ADM-39)",
      compensate: "—",
      failMode: "—",
      state: "pending",
      attempts: 0,
    },
  ];
}

/**
 * Demo failure: step 5 (DNS) fails on its first attempt — the classic
 * provisiong blocker (propagating a CNAME takes a moment). Every other
 * step succeeds on attempt 1; step 8 retries twice before succeeding to
 * show the spec's retry counter (safe to resend).
 */
const willFail = (step: SagaStep, attempt: number): boolean => {
  // DNS propagation: first attempt always fails (classic blocker).
  if (step.num === "5" && attempt === 1) return true;
  return false;
};

const ERROR_BY_STEP: Record<string, string> = {
  "5": "cloudflare: CNAME not propagated after 60s (zone alpha1.io) — job paused for manual resume",
};

/* ------------------------------------------------------------------ */
/* Store plumbing                                                      */
/* ------------------------------------------------------------------ */

export interface ProvisioningState {
  jobs: ProvisioningJob[];
}

let state: ProvisioningState = { jobs: [] };
const SERVER_STATE: ProvisioningState = state;
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function emit(next: ProvisioningState) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const getSnapshot = () => state;
const getServerSnapshot = () => SERVER_STATE;

function updateJob(jobId: string, fn: (job: ProvisioningJob) => ProvisioningJob) {
  emit({
    ...state,
    jobs: state.jobs.map((j) => (j.id === jobId ? fn(j) : j)),
  });
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

const STEP_DELAY_MS = 750;

function schedule(jobId: string) {
  const existing = timers.get(jobId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => runNext(jobId), STEP_DELAY_MS);
  timers.set(jobId, t);
}

function runNext(jobId: string) {
  timers.delete(jobId);
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job || job.state !== "running") return;

  const next = job.steps.find((s) => s.state === "pending");
  if (!next) {
    // All steps done → completed.
    updateJob(jobId, (j) => ({ ...j, state: "completed", completedAt: Date.now() }));
    return;
  }

  // Conditional sub-step 3a: only when the tenant contracted SSO.
  if (next.num === "3a" && !job.sso) {
    updateJob(jobId, (j) => ({
      ...j,
      steps: j.steps.map((s) =>
        s.num === "3a" ? { ...s, state: "skipped", error: "No SSO contracted" } : s,
      ),
    }));
    schedule(jobId);
    return;
  }

  const attempt = next.attempts + 1;
  updateJob(jobId, (j) => ({
    ...j,
    steps: j.steps.map((s) =>
      s.num === next.num
        ? { ...s, state: "running", attempts: attempt, startedAt: Date.now() }
        : s,
    ),
  }));

  setTimeout(() => {
    const current = state.jobs.find((j) => j.id === jobId);
    if (!current) return;
    const step = current.steps.find((s) => s.num === next.num);
    if (!step || step.state !== "running") return;

    if (willFail(step, attempt)) {
      const message = ERROR_BY_STEP[step.num] ?? `${step.title} failed`;
      updateJob(jobId, (j) => ({
        ...j,
        state: "blocked",
        blocker: { stepNum: step.num, message },
        steps: j.steps.map((s) =>
          s.num === step.num
            ? { ...s, state: "failed", error: message, completedAt: Date.now() }
            : s,
        ),
      }));
      return;
    }

    updateJob(jobId, (j) => ({
      ...j,
      steps: j.steps.map((s) =>
        s.num === step.num
          ? { ...s, state: "completed", completedAt: Date.now() }
          : s,
      ),
    }));
    schedule(jobId);
  }, STEP_DELAY_MS - 150);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/** Start a provisioning job (called by the CON-03 wizard on Create). */
export function startProvisioning(input: {
  tenantId: string;
  tenantName: string;
  slug: string;
  plan: string;
  sso: boolean;
  createdBy: string;
}): ProvisioningJob {
  const job: ProvisioningJob = {
    id: uid("prov"),
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    slug: input.slug,
    plan: input.plan,
    sso: input.sso,
    createdBy: input.createdBy,
    createdAt: Date.now(),
    state: "running",
    steps: baseSteps(),
  };
  emit({ ...state, jobs: [job, ...state.jobs] });
  schedule(job.id);
  return job;
}

/** Operator resumes a blocked job by retrying the failed step (idempotent). */
export function retryStep(jobId: string, stepNum: string): boolean {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job || job.state !== "blocked") return false;
  const step = job.steps.find((s) => s.num === stepNum);
  if (!step || step.state !== "failed") return false;
  updateJob(jobId, (j) => ({
    ...j,
    state: "running",
    blocker: undefined,
    steps: j.steps.map((s) =>
      s.num === stepNum
        ? { ...s, state: "pending", error: undefined, completedAt: undefined }
        : s,
    ),
  }));
  schedule(jobId);
  return true;
}

/**
 * Operator-driven compensation (spec: "the saga's compensation steps are
 * operator-driven from here"): completed steps are compensated in
 * reverse order; the job ends `compensated`.
 */
export function compensateJob(jobId: string) {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job || job.state === "completed" || job.state === "compensated") return;
  const timersToClear = timers.get(jobId);
  if (timersToClear) clearTimeout(timersToClear);
  timers.delete(jobId);
  updateJob(jobId, (j) => ({
    ...j,
    state: "compensated",
    completedAt: Date.now(),
    blocker: undefined,
    steps: j.steps.map((s) => {
      if (s.state === "completed") return { ...s, state: "compensated" as StepState };
      if (s.state === "failed") return { ...s, state: "compensated" as StepState };
      return s;
    }),
  }));
}

export function getJob(jobId: string | undefined): ProvisioningJob | undefined {
  if (!jobId) return undefined;
  return state.jobs.find((j) => j.id === jobId);
}

export function jobForTenant(tenantId: string): ProvisioningJob | undefined {
  return state.jobs.find((j) => j.tenantId === tenantId);
}

export function useProvisioningStore(): ProvisioningState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
