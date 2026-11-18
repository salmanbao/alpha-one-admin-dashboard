"use client";

/**
 * @pfaas/lifecycle — shared lifecycle event layer (R2-W3-01).
 *
 * Why this exists: Round 2 ended up with six independent stores that each
 * answer "what happened to this thing?" their own way (trader verification,
 * payout requests, payout methods, competitions; prop-admin KYC decisions,
 * payout decisions, challenge funding). Every new surface re-derived the same
 * transitions, so status cards, checklists and queues drifted apart.
 *
 * One primitive replaces that duplication:
 *
 *   emitLifecycle()   — publish a typed transition (idempotent per key)
 *   readLifecycleLog()/useLifecycleLog() — the persisted append-only log
 *   useLifecycle(id)  — subscribe to one entity's events
 *   projectStatus(id) — derive current stage + ETA from the log
 *
 * Stores stay the projections (they keep owning their own state); the log is
 * the bus. Consumers subscribe to the bus so one emission updates every
 * surface that cares, without any store polling another store.
 *
 * ── Persistence & the cross-app demo bridge ────────────────────────────
 *
 * The log is persisted under a single shared key (`pfaas:demo:lifecycle-log`)
 * using the repo-wide `pfaas:demo:` convention. Because the key is identical
 * in every app, the three apps read and append to *the same log* whenever
 * they are served under one origin — which the demo gateway does:
 * `Caddyfile` fronts all three apps on `:81` (`?XTransformPort=3002` shows
 * the trader app on that origin). The `storage` event then carries writes
 * across windows, so a trader's `kyc.submitted` lands in prop-admin's
 * pendings hub live, in-session.
 *
 * This is documented, demo-only transport (rule R3): separate dev origins
 * (`localhost:3000/3001/3002`) do NOT share storage, so cross-app intake is
 * simply empty there rather than simulated. The real transport (queue
 * API/Webhooks) is out of scope for Round 2.
 *
 * SSR-safe: module init and every read are no-ops without a `window`.
 */

import { useSyncExternalStore } from "react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type LifecycleActor = "trader" | "prop-admin" | "platform-admin" | "system";

export type LifecycleEntityKind =
  | "kyc"
  | "payout"
  | "payout-method"
  | "purchase"
  | "provisioning"
  | "challenge"
  | "competition"
  | "account"
  | "trade"
  | "compliance"
  | "trader"
  // R9 W1 — rule versioning (rules), trader claims + operator appeals
  // (appeal), and breach reversal after an accepted appeal (breach).
  | "rules"
  | "appeal"
  | "breach";

export interface EntityRef {
  kind: LifecycleEntityKind;
  /** Stable id of the entity in its own store (record id, reference, …). */
  id: string;
}

export const LIFECYCLE_EVENT_NAMES = [
  // KYC / verification
  "kyc.submitted",
  "kyc.reviewing",
  "kyc.approved",
  "kyc.rejected",
  "kyc.info-requested",
  // Payouts
  "payout.requested",
  "payout.approved",
  "payout.rejected",
  "payout.processing",
  "payout.paid",
  "payout.escalated",
  "payout.info-requested",
  "payout.cancelled",
  // Payout automation (R7 I4) — consumers: prop-admin payouts rules store
  // (evaluator run rows) + trader inbox bridge receipt ("approved
  // automatically under rule X — review window 24h (Demo)"); emitted by
  // prop-admin modules/payouts/payout-rules-store after applyPayoutDecision
  "payout.auto-decided",
  // Payout methods
  "payout-method.added",
  "payout-method.updated",
  "payout-method.rejected",
  "payout-method.unverified",
  "payout-method.removed",
  "payout-method.primary-set",
  // Purchase / provisioning
  "purchase.completed",
  "provisioning.started",
  "provisioning.dispatched",
  "provisioning.credentials",
  "provisioning.activated",
  "provisioning.retry",
  "provisioning.failed",
  // Challenge funding
  "challenge.funding-requested",
  "challenge.funded",
  // Competitions
  "competition.joined",
  "competition.left",
  "competition.prize-claimed",
  // Operator competition management (R7 I3) — consumers: trader
  // competitions-catalog (operator event → catalog projection) +
  // competition-notices ("Registration open: …" / "Results declared");
  // emitted by prop-admin lib/competitions-operator-store
  "competition.created",
  "competition.updated",
  "competition.finished",
  // Account
  "account.created",
  "account.password-reset",
  "account.extended",
  "account.re-enabled",
  "account.blocked",
  "account.failed",
  // Account pause / vacation mode (R9 W5 UC-T9) — consumers: prop-admin
  // cross-app intake pause queue (requested) + trader account-pause-store
  // and inbox bridge (approved/rejected)
  "account.pause-requested",
  "account.pause-approved",
  "account.pause-rejected",
  // Breach-aware retry discount (R9 W5 UC-T8) — consumer: trader inbox
  // bridge ("Your retry discount is ready"); emitted by the compliance
  // evaluator when it issues the rewards-store grant
  "promo.retry-discount-issued",
  // Trader status (R7 I9) — consumer: trader inbox-lifecycle-bridge
  "trader.suspended",
  "trader.reactivated",
  // KYC document requests (R7 I9)
  "kyc.document-requested",
  "kyc.document-decided",
  // Purchases (R4-09) — consumer: trader purchase-history refund overlay
  // + inbox bridge ("Refund issued")
  "purchase.refunded",
  // Operator → trader message (R4-09, rule R6) — consumer: trader
  // inbox-lifecycle-bridge, which projects it as an inbox message
  "comms.message-sent",
  // Trades (R7 I1) — consumers: trader inbox-lifecycle-bridge receipts
  // ("Position opened/closed/modified"); emitted by lib/trading/trading-store
  "trade.opened",
  "trade.closed",
  "trade.modified",
  // Compliance (R7 I2) — consumers: trader inbox-lifecycle-bridge receipts
  // ("Rule violation" / "Buffer running low"); emitted by
  // lib/compliance/compliance-store when a computed rule breaks
  "compliance.violation",
  "compliance.buffer-warning",
  // Risk rule engine (R7 I5) — consumer: trader inbox-lifecycle-bridge
  // ("Warning: you used N% of your daily loss limit (Demo)") + trader
  // risk-dashboard "operator warnings" panel + my-accounts account flag
  // + account-breach wiring; emitted by prop-admin lib/risk-rules-store
  "risk.alert.raised",
  // Rule versioning (R9 W1) — emitted by prop-admin lib/rules-versions-store.
  // Consumers: prop-admin risk-rules evaluator (resolves each account's
  // pinned version before comparing thresholds) + trader lib/rules/rules-store
  // (version history + pinned badge on /rules) + trader inbox-lifecycle-bridge
  // ("Rules v4 published — here is what changed (Demo)").
  "rules.version-published",
  // Appeals (R9 W1) — emitted by trader lib/appeals/claims-store (submit)
  // and prop-admin lib/appeals-store (verdict + breach reversal).
  // Consumers: prop-admin appeals-queue (claims intake → appeal rows) +
  // trader inbox-lifecycle-bridge (verdict receipt + breach reversal).
  "appeal.claim-submitted",
  "appeal.accepted",
  "appeal.rejected",
  "breach.reversed",
  // Payout fraud queue (R9 W2) — emitted by prop-admin lib/payout-fraud-store
  // on each verdict. Consumers: prop-admin payout queue chokepoint
  // (applyPayoutDecision refuses money-moving decisions while a flag is
  // blocked; clearing restores the Approve button) + trader
  // inbox-lifecycle-bridge receipts ("Payout PO-x blocked by compliance
  // review (Demo)" / "... flag cleared").
  "payout.fraud-cleared",
  "payout.fraud-blocked",
  "payout.fraud-escalated",
  // Fee-refund ledger (R9 W2) — emitted by trader lib/purchases-store when
  // a paid payout matches a fee-back purchase. Consumers: trader
  // inbox-lifecycle-bridge receipt ("Challenge fee refunded with payout
  // PO-x (Demo)") + the purchase-history/invoice ledger line (store field
  // the flip persists under pfaas:trader:purchases).
  "purchase.fee-refunded",
  // Graduated enforcement ladder (R9 W4) — emitted by prop-admin
  // lib/risk-rules-store when an account's rung advances or resets.
  // Consumers: trader lib/ladder/ladder-store (syncs compliance config
  // maxLots + ladderRung) + trader inbox-lifecycle-bridge receipt
  // ("Risk enforcement — Warning (rung 1)").
  "risk.ladder-moved",
  "risk.ladder-reset",
  // Collusion cluster escalation (R9 W4) — emitted by prop-admin
  // lib/clusters-store when a cluster is escalated to the fraud queue.
  // Consumers: prop-admin payout-fraud-store (manual flag appears in queue)
  // + correlation-clusters view (status flips to escalated).
  "risk.cluster-escalated",
] as const;

export type LifecycleEventName = (typeof LIFECYCLE_EVENT_NAMES)[number];

export function isLifecycleEventName(value: string): value is LifecycleEventName {
  return (LIFECYCLE_EVENT_NAMES as readonly string[]).includes(value);
}

export interface LifecycleEvent {
  /** Monotonic id — `${seq}` scoped to this log. */
  id: string;
  entity: EntityRef;
  name: LifecycleEventName;
  /** Transition-specific detail (amounts, reasons, attempts…). */
  payload: Record<string, unknown>;
  /** ISO timestamp of the transition. */
  at: string;
  actor: LifecycleActor;
  /** Idempotency key used for de-duplication (see emitLifecycle). */
  dedupeKey: string | null;
}

export interface EmitLifecycleInput {
  entity: EntityRef;
  name: LifecycleEventName;
  actor?: LifecycleActor;
  payload?: Record<string, unknown>;
  /**
   * Idempotent transition key. Re-emitting the same `entity + name + key`
   * is a no-op, so a resolver that re-writes an unchanged state, or a page
   * remount, can never double-count a transition (rule R2).
   */
  key?: string;
  /** Override the timestamp (seeded/demo data back-dating). */
  at?: string;
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

export const LIFECYCLE_LOG_KEY = "pfaas:demo:lifecycle-log";
/** Cap so a long demo session cannot grow the log without bound. */
const MAX_EVENTS = 500;
const SERVER_SNAPSHOT = "[]";

const listeners = new Set<() => void>();
let cache: LifecycleEvent[] | null = null;
let seq = 0;

function parseLog(raw: string | null): LifecycleEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is LifecycleEvent =>
        !!e && typeof e.id === "string" && typeof e.name === "string" && !!e.entity,
    );
  } catch {
    return [];
  }
}

function readLogFromStorage(): LifecycleEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return parseLog(window.localStorage.getItem(LIFECYCLE_LOG_KEY));
  } catch {
    return [];
  }
}

function currentLog(): LifecycleEvent[] {
  if (cache) return cache;
  cache = readLogFromStorage();
  seq = cache.reduce((max, e) => {
    const n = Number(String(e.id).split(":")[0]);
    return Number.isFinite(n) && n > max ? n : max;
  }, seq);
  return cache;
}

function persist(events: LifecycleEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LIFECYCLE_LOG_KEY, JSON.stringify(events));
  } catch {
    /* storage full / private mode — demo persistence is best-effort */
  }
}

function notify(): void {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // Cross-window/cross-app sync: `storage` fires in OTHER documents on the
  // same origin — this is what carries trader events into prop-admin when
  // both are served by the demo gateway (:81).
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function onStorage(e: StorageEvent): void {
  if (e.key !== null && e.key !== LIFECYCLE_LOG_KEY) return;
  cache = readLogFromStorage();
  notify();
}

/* ------------------------------------------------------------------ */
/* Write                                                               */
/* ------------------------------------------------------------------ */

/**
 * Publish a lifecycle transition. Returns the appended event, or `null`
 * when the transition was already recorded (idempotent `key`) or storage
 * is unavailable (SSR).
 */
export function emitLifecycle(input: EmitLifecycleInput): LifecycleEvent | null {
  if (typeof window === "undefined") return null;
  const log = currentLog();
  const dedupeKey = input.key ?? null;

  if (dedupeKey) {
    const full = `${input.entity.kind}:${input.entity.id}:${input.name}:${dedupeKey}`;
    if (log.some((e) => e.dedupeKey === full)) return null;
  }

  seq += 1;
  const event: LifecycleEvent = {
    id: `${seq}:${input.entity.kind}:${input.entity.id}`,
    entity: { ...input.entity },
    name: input.name,
    payload: input.payload ?? {},
    at: input.at ?? new Date().toISOString(),
    actor: input.actor ?? "system",
    dedupeKey: dedupeKey
      ? `${input.entity.kind}:${input.entity.id}:${input.name}:${dedupeKey}`
      : null,
  };

  const next = [...log, event].slice(-MAX_EVENTS);
  cache = next;
  persist(next);
  notify();
  return event;
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

/** Full log (newest last). Non-reactive — use `useLifecycleLog()` in React. */
export function readLifecycleLog(): LifecycleEvent[] {
  return [...currentLog()];
}

/** Events for one entity, oldest first. Non-reactive. */
export function lifecycleEventsFor(entityId: string): LifecycleEvent[] {
  return currentLog().filter((e) => e.entity.id === entityId);
}

function snapshotOf(events: LifecycleEvent[]): string {
  return JSON.stringify(events);
}

/** Reactive full log — one subscription for "any lifecycle event". */
export function useLifecycleLog(): LifecycleEvent[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => snapshotOf(currentLog()),
    () => SERVER_SNAPSHOT,
  );
  return JSON.parse(raw) as LifecycleEvent[];
}

/** Reactive events for a single entity (kind-agnostic id match). */
export function useLifecycle(entityId: string): LifecycleEvent[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => snapshotOf(currentLog().filter((e) => e.entity.id === entityId)),
    () => SERVER_SNAPSHOT,
  );
  return JSON.parse(raw) as LifecycleEvent[];
}

/** Drop the log — demo reset (prop-admin topbar "Reset demo session"). */
export function clearLifecycleLog(): void {
  if (typeof window === "undefined") return;
  cache = [];
  seq = 0;
  try {
    window.localStorage.removeItem(LIFECYCLE_LOG_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

/* ------------------------------------------------------------------ */
/* Projectors                                                          */
/* ------------------------------------------------------------------ */

/** Human label for each event name. */
const STAGE_LABEL: Record<LifecycleEventName, string> = {
  "kyc.submitted": "Submitted",
  "kyc.reviewing": "In review",
  "kyc.approved": "Approved",
  "kyc.rejected": "Rejected",
  "kyc.info-requested": "Info requested",
  "kyc.document-requested": "Document requested",
  "kyc.document-decided": "Document decided",
  "payout.requested": "Requested",
  "payout.approved": "Approved",
  "payout.rejected": "Rejected",
  "payout.processing": "Processing",
  "payout.paid": "Paid",
  "payout.escalated": "Escalated",
  "payout.info-requested": "Info requested",
  "payout.cancelled": "Cancelled",
  "payout.auto-decided": "Auto-decided",
  "payout-method.added": "Method added",
  "payout-method.updated": "Method updated",
  "payout-method.rejected": "Method rejected",
  "payout-method.unverified": "Method unverified",
  "payout-method.removed": "Method removed",
  "payout-method.primary-set": "Primary method set",
  "purchase.completed": "Purchased",
  "provisioning.started": "Provisioning",
  "provisioning.dispatched": "Dispatched",
  "provisioning.credentials": "Credentials delivered",
  "provisioning.activated": "Active",
  "provisioning.retry": "Retry queued",
  "provisioning.failed": "Failed",
  "challenge.funding-requested": "Funding requested",
  "challenge.funded": "Funded",
  "competition.joined": "Joined",
  "competition.left": "Left",
  "competition.prize-claimed": "Prize claimed",
  "competition.created": "Published",
  "competition.updated": "Updated",
  "competition.finished": "Results declared",
  "account.created": "Account created",
  "account.password-reset": "Password reset",
  "account.extended": "Time extended",
  "account.re-enabled": "Re-enabled",
  "account.blocked": "Blocked",
  "account.failed": "Manual fail",
  "account.pause-requested": "Pause requested",
  "account.pause-approved": "Pause approved",
  "account.pause-rejected": "Pause rejected",
  "promo.retry-discount-issued": "Retry discount issued",
  "trader.suspended": "Trader suspended",
  "trader.reactivated": "Trader reactivated",
  "purchase.refunded": "Refunded",
  "comms.message-sent": "Message sent",
  "trade.opened": "Position opened",
  "trade.closed": "Position closed",
  "trade.modified": "Position modified",
  "compliance.violation": "Rule violated",
  "compliance.buffer-warning": "Buffer warning",
  "risk.alert.raised": "Risk alert raised",
  "rules.version-published": "Rules published",
  "appeal.claim-submitted": "Claim submitted",
  "appeal.accepted": "Appeal accepted",
  "appeal.rejected": "Appeal rejected",
  "breach.reversed": "Breach reversed",
  "payout.fraud-cleared": "Fraud flag cleared",
  "payout.fraud-blocked": "Fraud flag blocked",
  "payout.fraud-escalated": "Fraud flag escalated",
  "purchase.fee-refunded": "Challenge fee refunded",
  "risk.ladder-moved": "Ladder rung advanced",
  "risk.ladder-reset": "Ladder rung reset",
  "risk.cluster-escalated": "Cluster escalated to fraud",
};

/**
 * Expected follow-up for a non-terminal stage: label + hours until the
 * next transition. Display-only projection — stores remain responsible for
 * actually resolving their own state (this never *decides* anything).
 */
const FOLLOW_UP: Partial<
  Record<LifecycleEventName, { label: string; afterHours: number }>
> = {
  "kyc.submitted": { label: "Review started", afterHours: 1 },
  "kyc.reviewing": { label: "Verdict", afterHours: 3 },
  "kyc.info-requested": { label: "Re-review after documents", afterHours: 24 },
  "kyc.document-requested": { label: "Documents requested", afterHours: 24 },
  "kyc.document-decided": { label: "Documents verified", afterHours: 1 },
  "payout.requested": { label: "Processing", afterHours: 2 },
  "payout.approved": { label: "Processing", afterHours: 2 },
  "payout.processing": { label: "Paid", afterHours: 46 },
  "payout.escalated": { label: "Second signature", afterHours: 8 },
  "payout.info-requested": { label: "Re-review after documents", afterHours: 24 },
  // Automated decision — the operator review window (matches the trader
  // inbox receipt copy: "review window 24h (Demo)").
  "payout.auto-decided": { label: "Review window ends", afterHours: 24 },
  "challenge.funding-requested": { label: "Funded", afterHours: 4 },
  "purchase.completed": { label: "Provisioned", afterHours: 1 },
  "provisioning.started": { label: "Credentials delivered", afterHours: 0.5 },
  "provisioning.dispatched": { label: "Provisioning dispatched", afterHours: 0.5 },
  "provisioning.credentials": { label: "Active", afterHours: 0.5 },
  "account.pause-requested": { label: "Operator decision", afterHours: 24 },
  "account.created": { label: "Verification started", afterHours: 48 },
  "account.password-reset": { label: "Updated", afterHours: 0 },
  "account.extended": { label: "Deadline extended", afterHours: 0 },
  "account.re-enabled": { label: "Re-enabled", afterHours: 0 },
  "account.blocked": { label: "Blocked", afterHours: 0 },
  "account.failed": { label: "Manual fail", afterHours: 0 },
  "trader.suspended": { label: "Suspended", afterHours: 0 },
  "trader.reactivated": { label: "Reactivated", afterHours: 0 },
};

export interface ProjectedStatus {
  entityId: string;
  /** Latest event, or null when the entity has never emitted. */
  latest: LifecycleEvent | null;
  /** Label of the current stage ("Not started" when the log is empty). */
  stage: string;
  /** When the current stage was entered (ISO), null when unknown. */
  since: string | null;
  /** Label of the expected next stage, null when terminal. */
  nextStage: string | null;
  /** Expected transition time (ISO), null when terminal or unknown. */
  eta: string | null;
  events: LifecycleEvent[];
}

/**
 * Project the current stage + ETA for an entity from its event history.
 * Pure read of the log — safe to call during render.
 */
export function projectStatus(entityId: string): ProjectedStatus {
  const events = lifecycleEventsFor(entityId);
  const latest = events.length ? events[events.length - 1] : null;
  if (!latest) {
    return {
      entityId,
      latest: null,
      stage: "Not started",
      since: null,
      nextStage: null,
      eta: null,
      events,
    };
  }
  const follow = FOLLOW_UP[latest.name];
  const sinceMs = Date.parse(latest.at);
  return {
    entityId,
    latest,
    stage: STAGE_LABEL[latest.name],
    since: Number.isFinite(sinceMs) ? latest.at : null,
    nextStage: follow?.label ?? null,
    eta:
      follow && Number.isFinite(sinceMs)
        ? new Date(sinceMs + follow.afterHours * 3_600_000).toISOString()
        : null,
    events,
  };
}

/** Reactive `projectStatus` — re-derives on every log change. */
export function useProjectedStatus(entityId: string): ProjectedStatus {
  useLifecycleLog();
  return projectStatus(entityId);
}

/** Stage label for an event name (shared by logs/timelines). */
export function lifecycleStageLabel(name: LifecycleEventName): string {
  return STAGE_LABEL[name];
}

/** Names of events that resolve an entity (terminal — no follow-up). */
export function isTerminalEvent(name: LifecycleEventName): boolean {
  return !(name in FOLLOW_UP);
}
