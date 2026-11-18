"use client";

/**
 * Onboarding time-to-value stamps — R9 W6 UC-P3.
 *
 * Both platform onboarding wizards stamp their stage transitions here:
 *   - **Create tenant** (create-tenant-page) — `openRun` on mount,
 *     `stampStage` as the operator advances, `finishRun` when the
 *     tenant is registered;
 *   - **Go-live wizard** (go-live-wizard-page) — `openRun` on mount,
 *     `stampStage` from `completeStep` in go-live-store (each completion
 *     enters the next stage), `finishRun` in `goLive()`.
 *
 * A stamp records the moment the operator ENTERS a stage; the first
 * stage's entry is `startedAt` (written by `openRun` when the wizard
 * opens), and `finishedAt` lands when the terminal stage fires
 * ("created" / "live"). Median time per stage = the middle of the
 * entry-to-entry durations across runs; a run that never finishes
 * shows up in the drop-off list at the last stage it did enter.
 *
 * Persistence: `pfaas:platform-admin:onboarding-runs`, seed → stored
 * merge by id (stored wins). Seeded rows are demo history laid out so
 * each seed tenant's create run ends on its `createdAt` and its
 * go-live run ends on its `liveAt` — the platform-analytics panel's
 * days-to-live reconciles with them. Seeds are flagged `seeded` so the
 * panel can label them "(Demo)" and so `openRun` never resumes one as
 * an active run.
 *
 * Named consumer: the "Onboarding time to value" panel on the
 * platform-analytics page (median per stage, drop-off list, days to
 * first live firm). No lifecycle event is emitted — these stamps are
 * measurement input for that panel, not an action the console claims
 * to log (§1 rule 2).
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "pfaas:platform-admin:onboarding-runs";

export type OnboardingFlow = "create-tenant" | "go-live";

export interface FlowStage {
  id: string;
  label: string;
}

/**
 * Stage order per wizard. The last entry is the terminal STAGE (a
 * completion event, not a screen) — it never gets a median row because
 * nothing follows it to measure against.
 */
export const FLOW_STAGES: Record<OnboardingFlow, FlowStage[]> = {
  "create-tenant": [
    { id: "basics", label: "Basics" },
    { id: "branding", label: "Branding" },
    { id: "modules", label: "Modules" },
    { id: "admin", label: "Admin" },
    { id: "review", label: "Review" },
    { id: "created", label: "Tenant created" },
  ],
  // Labels mirror the go-live wizard's STEP_META (review = "Go live").
  "go-live": [
    { id: "tenant", label: "Tenant" },
    { id: "plan", label: "Plan" },
    { id: "kyc", label: "KYC" },
    { id: "connectors", label: "Connectors" },
    { id: "risk", label: "Risk" },
    { id: "review", label: "Go live" },
    { id: "live", label: "Firm live" },
  ],
};

export interface OnboardingRun {
  id: string;
  flow: OnboardingFlow;
  /** Tenant this run stands up — null until known / for abandoned drafts. */
  tenantId: string | null;
  /** Display name for the panel (draft name before the tenant exists). */
  tenantName: string;
  /** Stage id → ISO time the operator ENTERED that stage. */
  stamps: Record<string, string>;
  /** Wizard opened — entry into the first stage. */
  startedAt: string;
  /** Terminal stage fired — the tenant was created / the firm went live. */
  finishedAt: string | null;
  updatedAt: string;
  /** Demo history derived from the seed tenants (never resumed, labeled). */
  seeded?: true;
}

/** Run-level facts stamped alongside a stage (go-live's tenant step). */
export interface RunContext {
  tenantId?: string | null;
  tenantName?: string;
}

/* ------------------------------------------------------------------ */
/* Date helpers (§1 rule 5 — no hand-written date strings)             */
/* ------------------------------------------------------------------ */

function hoursAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

/* ------------------------------------------------------------------ */
/* Seed — demo history aligned with the seed tenants' dates            */
/* ------------------------------------------------------------------ */

function seedRun(
  id: string,
  flow: OnboardingFlow,
  tenantId: string | null,
  tenantName: string,
  startedH: number,
  enteredH: Record<string, number>,
  finishedH?: number,
): OnboardingRun {
  const stamps: Record<string, string> = {};
  for (const [stage, h] of Object.entries(enteredH)) stamps[stage] = hoursAgo(h);
  if (finishedH !== undefined) {
    // The terminal stage is an entry too — `finishRun` stamps it the
    // same way at runtime, and the last median row measures against it.
    const stages = FLOW_STAGES[flow];
    stamps[stages[stages.length - 1].id] = hoursAgo(finishedH);
  }
  return {
    id,
    flow,
    tenantId,
    tenantName,
    stamps,
    startedAt: hoursAgo(startedH),
    finishedAt: finishedH === undefined ? null : hoursAgo(finishedH),
    updatedAt: hoursAgo(finishedH ?? Math.min(startedH, ...Object.values(enteredH))),
    seeded: true,
  };
}

// Create runs end at each tenant's `createdAt` (220 / 410 / 95 days
// ago); go-live runs end at its `liveAt` (205 / 380 / 90 days ago) —
// see mock-data.ts. Offsets are hours so consecutive stages can differ
// by less than a day.
const SEED: OnboardingRun[] = [
  seedRun("seed-create-alpha", "create-tenant", "tenant-alpha", "Alpha Capital",
    5310, { branding: 5306, modules: 5301, admin: 5295, review: 5289 }, 5280),
  seedRun("seed-golive-alpha", "go-live", "tenant-alpha", "Alpha Capital",
    5170, { plan: 5166, kyc: 5150, connectors: 5110, risk: 5070, review: 4990 }, 4920),
  seedRun("seed-create-beta", "create-tenant", "tenant-beta", "Beta Trading",
    9870, { branding: 9866, modules: 9861, admin: 9855, review: 9848 }, 9840),
  seedRun("seed-golive-beta", "go-live", "tenant-beta", "Beta Trading",
    9400, { plan: 9396, kyc: 9370, connectors: 9300, risk: 9240, review: 9150 }, 9120),
  seedRun("seed-create-gamma", "create-tenant", "tenant-gamma", "Gamma Futures",
    2300, { branding: 2296, modules: 2293, admin: 2291, review: 2286 }, 2280),
  seedRun("seed-golive-gamma", "go-live", "tenant-gamma", "Gamma Futures",
    2200, { plan: 2197, kyc: 2185, connectors: 2175, risk: 2170, review: 2166 }, 2160),
  // Abandoned attempts — these are what the drop-off list shows.
  seedRun("seed-drop-create-atlas", "create-tenant", null, "Atlas Capital",
    102, { branding: 100, modules: 97 }),
  seedRun("seed-drop-golive-evergreen", "go-live", "tenant-evergreen", "Evergreen Capital",
    264, { plan: 262, kyc: 250 }),
];

const isRun = (x: unknown): x is OnboardingRun =>
  !!x && typeof x === "object" &&
  typeof (x as OnboardingRun).id === "string" &&
  typeof (x as OnboardingRun).flow === "string";

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function readRaw(): OnboardingRun[] {
  if (typeof window === "undefined") return SEED.map((r) => ({ ...r }));
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    // Seed → stored (stored wins): a run added to the seed later still
    // appears for operators whose browser already persisted an older set.
    const byId = new Map<string, OnboardingRun>(SEED.map((r) => [r.id, { ...r }]));
    if (Array.isArray(stored)) {
      for (const raw of stored) {
        if (!isRun(raw)) continue;
        byId.set(raw.id, { ...(byId.get(raw.id) ?? {}), ...raw });
      }
    }
    return [...byId.values()];
  } catch {
    return SEED.map((r) => ({ ...r }));
  }
}

function writeRaw(next: OnboardingRun[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* best-effort persistence */
  }
  notify();
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function getSnapshot(): string {
  return JSON.stringify(readRaw());
}
function getServerSnapshot(): string {
  return JSON.stringify(SEED);
}

export function readRuns(): OnboardingRun[] {
  return readRaw().map((r) => ({ ...r }));
}

export function useRuns(): OnboardingRun[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as OnboardingRun[];
}

/* ------------------------------------------------------------------ */
/* Active run — one open attempt per flow                              */
/* ------------------------------------------------------------------ */

/** The run still in progress for `flow` (seeds are demo, never active). */
function activeRun(list: OnboardingRun[], flow: OnboardingFlow): OnboardingRun | undefined {
  return list.find((r) => r.flow === flow && !r.finishedAt && !r.seeded);
}

function newRunId(): string {
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeRun(flow: OnboardingFlow, now: string): OnboardingRun {
  return {
    id: newRunId(),
    flow,
    tenantId: null,
    tenantName: "",
    stamps: {},
    startedAt: now,
    finishedAt: null,
    updatedAt: now,
  };
}

function applyContext(run: OnboardingRun, ctx?: RunContext): OnboardingRun {
  if (!ctx) return run;
  return {
    ...run,
    ...(ctx.tenantId !== undefined ? { tenantId: ctx.tenantId } : {}),
    ...(ctx.tenantName ? { tenantName: ctx.tenantName } : {}),
  };
}

/**
 * The wizard opened — start a run unless one is already in flight
 * (a resumed wizard keeps its original `startedAt`, so stage 1's
 * duration spans every visit).
 */
export function openRun(flow: OnboardingFlow): void {
  if (typeof window === "undefined") return;
  const runs = readRaw();
  if (activeRun(runs, flow)) return;
  const now = new Date().toISOString();
  writeRaw([...runs, makeRun(flow, now)]);
}

/** The operator ENTERED `stage` — stamp it (first entry wins). */
export function stampStage(flow: OnboardingFlow, stage: string, ctx?: RunContext): void {
  if (typeof window === "undefined") return;
  const runs = readRaw();
  const now = new Date().toISOString();
  const open = activeRun(runs, flow);
  if (!open) {
    // Safety net: the wizard stamped without mounting (shouldn't happen —
    // both wizards open a run on mount).
    writeRaw([...runs, applyContext({ ...makeRun(flow, now), stamps: { [stage]: now } }, ctx)]);
    return;
  }
  const stamped: OnboardingRun = {
    ...applyContext(open, ctx),
    stamps: open.stamps[stage] ? open.stamps : { ...open.stamps, [stage]: now },
    updatedAt: now,
  };
  writeRaw(runs.map((r) => (r.id === open.id ? stamped : r)));
}

/** Terminal stage fired — close the run (tenant created / firm live). */
export function finishRun(flow: OnboardingFlow, ctx?: RunContext): void {
  if (typeof window === "undefined") return;
  const runs = readRaw();
  const now = new Date().toISOString();
  const open = activeRun(runs, flow);
  const stages = FLOW_STAGES[flow];
  const terminal = stages[stages.length - 1].id;
  if (!open) {
    writeRaw([...runs, applyContext({ ...makeRun(flow, now), stamps: { [terminal]: now }, finishedAt: now }, ctx)]);
    return;
  }
  const finished: OnboardingRun = {
    ...applyContext(open, ctx),
    stamps: open.stamps[terminal] ? open.stamps : { ...open.stamps, [terminal]: now },
    finishedAt: now,
    updatedAt: now,
  };
  writeRaw(runs.map((r) => (r.id === open.id ? finished : r)));
}
