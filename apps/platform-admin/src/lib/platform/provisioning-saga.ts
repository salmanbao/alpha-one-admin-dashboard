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
import { updateTenant, removeTenant } from "./tenant-store";
import { recordAudit } from "./console-store";

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
  /** Tenant admin identity from wizard (TM-07). */
  adminName?: string;
  adminEmail?: string;
  /** Tenant owner identity from wizard (TM-11). */
  owner?: string;
  ownerEmail?: string;
  createdAt: number;
  completedAt?: number;
  state: JobState;
  steps: SagaStep[];
  /** Set when the job went terminal before an operator resumed it. */
  blocker?: { stepNum: string; message: string };
  /**
   * TM-07 — persisted invitation record: written the moment step 8
   * completes, so the "invite sent" claim is backed by stored state
   * (survives reload) rather than a toast that evaporates.
   */
  invitation?: { email: string; name: string; sentAt: number };
}

/* ------------------------------------------------------------------ */
/* Spec table (03 §3.5)                                                */
/* ------------------------------------------------------------------ */

function baseSteps(adminEmail?: string): SagaStep[] {
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
      title: `Welcome invite email to owner${adminEmail ? ` — ${adminEmail}` : ""}`,
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

/**
 * R13 TM-06 — jobs persist across reloads. A page refresh mid-saga used
 * to destroy the job while the tenant stayed `provisioning` forever with
 * no console recovery path; the array now lives in localStorage like the
 * other platform stores, and running jobs re-schedule their timers on
 * module load.
 */
const STORAGE_KEY = "pfaas:platform-admin:provisioning-jobs";

function loadState(): ProvisioningState {
  if (typeof window === "undefined") return { jobs: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { jobs: [] };
    const parsed = JSON.parse(raw) as ProvisioningState;
    if (!parsed || !Array.isArray(parsed.jobs)) return { jobs: [] };
    // A step persisted mid-flight has no timer behind it — demote it
    // back to pending so the resumed runner picks it up again.
    return {
      jobs: parsed.jobs.map((j) =>
        j.state === "running"
          ? {
              ...j,
              steps: j.steps.map((s) =>
                s.state === "running" ? { ...s, state: "pending" as StepState } : s,
              ),
            }
          : j,
      ),
    };
  } catch {
    return { jobs: [] };
  }
}

export interface ProvisioningState {
  jobs: ProvisioningJob[];
}

let state: ProvisioningState = loadState();
const SERVER_STATE: ProvisioningState = { jobs: [] };
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function emit(next: ProvisioningState) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota — state stays in memory for this session */
    }
  }
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

    // TM-07 — step 8 completes: record the persisted invitation so
    // "invite sent" is backed by stored state (survives reload).
    const isStep8 = step.num === "8";
    updateJob(jobId, (j) => ({
      ...j,
      ...(isStep8 && j.adminEmail
        ? { invitation: { email: j.adminEmail, name: j.adminName ?? "", sentAt: Date.now() } }
        : {}),
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
  adminName?: string;
  adminEmail?: string;
  owner?: string;
  ownerEmail?: string;
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
    adminName: input.adminName,
    adminEmail: input.adminEmail,
    owner: input.owner,
    ownerEmail: input.ownerEmail,
    createdAt: Date.now(),
    state: "running",
    steps: baseSteps(input.adminEmail),
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
  // Newest first (startProvisioning prepends) — a tenant may have a
  // completed history job plus a fresh re-attached one.
  return state.jobs.find((j) => j.tenantId === tenantId);
}

/** A job can still make progress (running, or blocked awaiting a retry). */
export function isLiveJob(job: ProvisioningJob | undefined): job is ProvisioningJob {
  return !!job && (job.state === "running" || job.state === "blocked");
}

/**
 * R13 TM-06 — the tenant claims an in-flight provisioning but nothing
 * is driving it (no job, or only terminal jobs): the classic orphan
 * left behind by a reload before persistence existed. The console shows
 * a stale-provisioning callout with a one-click re-attach for these.
 */
export function isStaleProvisioning(tenant: {
  id: string;
  status: string;
}): boolean {
  if (tenant.status !== "provisioning" && tenant.status !== "provisioning_failed") {
    return false;
  }
  return !isLiveJob(jobForTenant(tenant.id));
}

/**
 * TM-06 recovery — re-attach: start a fresh saga for a stuck tenant and
 * put it back on `provisioning`. Prior terminal jobs stay in the store
 * as history; the new job is prepended so jobForTenant resolves to it.
 */
export function reattachProvisioning(input: {
  tenantId: string;
  tenantName: string;
  slug: string;
  plan: string;
  sso?: boolean;
  createdBy: string;
}): ProvisioningJob {
  const job = startProvisioning({
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    slug: input.slug,
    plan: input.plan,
    sso: input.sso ?? false,
    createdBy: input.createdBy,
  });
  updateTenant(input.tenantId, { status: "provisioning" });
  recordAudit({
    actor: input.createdBy,
    action: "tenant.provisioning_reattached",
    target: input.tenantId,
    tenantId: input.tenantId,
    severity: "warning",
    detail: `Stale provisioning for ${input.tenantName} re-attached — new saga ${job.id} running`,
  });
  return job;
}

/**
 * TM-06 recovery — delete a stuck draft (rolled_back / failed with no
 * live job): drops its jobs + timers and removes the tenant row.
 */
export function deleteProvisioningDraft(
  tenantId: string,
  createdBy: string,
): boolean {
  // At least one saga job or a live tenant row must exist; otherwise
  // there's nothing to delete (tenant already removed by another page).
  const job = jobForTenant(tenantId);
  if (!job && !state.jobs.some((x) => x.tenantId === tenantId)) return false;
  for (const j of state.jobs.filter((x) => x.tenantId === tenantId)) {
    const t = timers.get(j.id);
    if (t) clearTimeout(t);
    timers.delete(j.id);
  }
  emit({ ...state, jobs: state.jobs.filter((x) => x.tenantId !== tenantId) });
  removeTenant(tenantId);
  recordAudit({
    actor: createdBy,
    action: "tenant.provisioning_draft_deleted",
    target: tenantId,
    tenantId,
    severity: "warning",
    detail: `Stuck provisioning draft deleted${job ? ` (last saga ${job.id})` : ""} — tenant row removed`,
  });
  return true;
}

/**
 * TM-06 recovery — resume: blocked → retry the failed step (idempotent,
 * job context preserved); running without a timer (defensive) → re-arm.
 */
export function resumeJob(jobId: string): boolean {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return false;
  if (job.state === "blocked") {
    const failed = job.steps.find((s) => s.state === "failed");
    return failed ? retryStep(jobId, failed.num) : false;
  }
  if (job.state === "running") {
    if (timers.has(jobId)) return false;
    schedule(jobId);
    return true;
  }
  return false;
}

export function useProvisioningStore(): ProvisioningState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ------------------------------------------------------------------ */
/* TM-06 — resume persisted jobs on load                               */
/* ------------------------------------------------------------------ */

/**
 * A page refresh mid-run used to destroy the job (in-memory singleton),
 * orphaning the tenant in `provisioning`. Jobs now persist, and any job
 * still `running` when the module loads re-arms its timer — loadState
 * already demoted its in-flight step back to `pending`, so the runner
 * picks it up. `blocked` jobs intentionally do NOT auto-resume: the
 * spec requires an operator retry (job context preserved).
 */
if (typeof window !== "undefined") {
  for (const j of state.jobs) {
    if (j.state === "running" && !timers.has(j.id)) schedule(j.id);
  }
}
