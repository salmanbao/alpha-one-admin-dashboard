"use client";

/**
 * PFaaS Platform — Console Mock Store (docs/21 CON-32/30/07/15)
 *
 * Shared, subscribable mock state for the console's *safety* surfaces —
 * the pieces that must behave like real state across screens:
 *
 *   - Two-operator approval requests (CON-32): initiator → `pending_approval`
 *     → second operator approves within 10 min → executes. Self-approval is
 *     a *structural* denial (403 semantics), not a warning.
 *   - Console sessions (CON-30): concurrent, revocable, 15-min idle copy.
 *   - Impersonation sessions (CON-07): 15-min countdown, renewable, with
 *     an audit trail on start/end/expiry.
 *   - Emergency controls (CON-15/28): halt / relay pause / maintenance /
 *     flag kill-switch state.
 *   - Operator audit trail: every 2FA'd action and approval decision
 *     appends a record (`console.operator_action`,
 *     `console.escalation_approved`, `console.impersonation_*`).
 *
 * Pattern mirrors prop-admin's `live-data.ts`: singleton state + listener
 * set + `useSyncExternalStore`. Pending approvals expire on a 1s sweeper;
 * impersonations auto-end at their deadline.
 */

import { useSyncExternalStore } from "react";
import type { AuthUser } from "./types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface OperatorRef {
  id: string;
  name: string;
}

export type ApprovalStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "expired"
  | "executed";

export interface ApprovalRequest {
  id: string;
  /** Stable action key, e.g. `tenant.suspend`, `platform.halt`. */
  actionKey: string;
  /** Human label shown to the approver, e.g. "Suspend tenant Alpha Capital". */
  actionLabel: string;
  /** Blast-radius lines — the exact consequences the approver must see. */
  blastRadius: string[];
  /** Operator A. The approval token names A; A can never approve. */
  initiator: OperatorRef;
  tenantId?: string;
  createdAt: number;
  /** 10 minutes per CON-32 §3.5. */
  expiresAt: number;
  status: ApprovalStatus;
  approver?: OperatorRef;
  decidedAt?: number;
  executedAt?: number;
  /** Extra context for the approver's review card (runbook, severity…). */
  detail?: string;
}

export type ApprovalDecisionResult =
  | { ok: true; request: ApprovalRequest }
  | {
      ok: false;
      code: "self_approval" | "expired" | "not_found" | "already_decided";
      message: string;
    };

export interface ConsoleSession {
  id: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  createdAt: number;
  lastSeenAt: number;
  current: boolean;
}

export interface ImpersonationSession {
  id: string;
  tenantId: string;
  tenantName: string;
  startedBy: OperatorRef;
  startedAt: number;
  /** 15 minutes per docs/21 CON-07. */
  expiresAt: number;
  renewCount: number;
  endedAt?: number;
  endReason?: "manual" | "expired" | "revoked";
}

export type ControlKey =
  | "platform_halt"
  | "relay_pause"
  | "maintenance_mode"
  | "flag_kill_switches";

export type ControlState = "normal" | "pending_approval" | "engaged";

export interface AuditRecord {
  id: string;
  at: number;
  actor: string;
  /** Event name per docs/21 §4 (`console.*`). */
  action: string;
  target?: string;
  severity: "info" | "warning" | "critical";
  detail?: string;
  /**
   * Tenant scope of the event. Set when the action happened in the context
   * of a specific tenant (lifecycle change, saga, support assist…); omit for
   * platform-wide events. The Platform Audit Log uses this to resolve the
   * tenant badge — including runtime-created tenants.
   */
  tenantId?: string;
}

export interface ConsoleState {
  approvals: ApprovalRequest[];
  sessions: ConsoleSession[];
  /** Live + ended history (`endedAt` set when finished). */
  impersonations: ImpersonationSession[];
  controls: Record<ControlKey, ControlState>;
  audit: AuditRecord[];
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const APPROVAL_TTL_MS = 10 * 60 * 1000; // CON-32 §3.5 — 10 minutes
export const IMPERSONATION_TTL_MS = 15 * 60 * 1000; // CON-07 — 15 minutes
export const SESSION_IDLE_MIN = 15; // CON-30 — 15-minute idle timeout

const now = () => Date.now();
const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/* ------------------------------------------------------------------ */
/* Initial state                                                       */
/* ------------------------------------------------------------------ */

function seedState(): ConsoleState {
  const t = now();
  return {
    approvals: [
      {
        id: "apr-seed-pending",
        actionKey: "tenant.suspend",
        actionLabel: "Suspend tenant Gamma Futures",
        blastRadius: [
          "All 12 trading accounts stop opening new positions immediately",
          "9 traders lose console access; open positions remain but cannot be closed manually",
          "Payout queue (3 requests, $11,400) freezes until reactivation",
          "Estimated blast radius: $182k monthly volume",
        ],
        initiator: { id: "op-priya", name: "Priya Shah" },
        tenantId: "tenant-gamma",
        createdAt: t - 3 * 60 * 1000,
        expiresAt: t - 3 * 60 * 1000 + APPROVAL_TTL_MS,
        status: "pending_approval",
        detail: "Runbook TEN-04 · abuse investigation AB-118",
      },
      {
        id: "apr-seed-approved",
        actionKey: "control.relay_pause",
        actionLabel: "Pause MetaApi relay (eu-west)",
        blastRadius: ["Market data stalls for tenants on eu-west", "Auto-trading bots pause"],
        initiator: { id: "op-alex", name: "Alex Morgan" },
        createdAt: t - 95 * 60 * 1000,
        expiresAt: t - 85 * 60 * 1000,
        status: "executed",
        approver: { id: "op-priya", name: "Priya Shah" },
        decidedAt: t - 92 * 60 * 1000,
        executedAt: t - 92 * 60 * 1000,
      },
      {
        id: "apr-seed-rejected",
        actionKey: "control.flag_kill_switch",
        actionLabel: "Kill-switch: disable challenge_payouts flag fleet-wide",
        blastRadius: ["All tenants' payout automation halts"],
        initiator: { id: "op-marcus", name: "Marcus Webb" },
        createdAt: t - 5 * 60 * 60 * 1000,
        expiresAt: t - 5 * 60 * 60 * 1000 + APPROVAL_TTL_MS,
        status: "rejected",
        approver: { id: "op-priya", name: "Priya Shah" },
        decidedAt: t - 4.9 * 60 * 60 * 1000,
        detail: "Rejected — insufficient blast-radius justification",
      },
    ],
    sessions: [
      {
        id: "sess-current",
        device: "MacBook Pro",
        browser: "Chrome 141 · macOS",
        ip: "203.0.113.24",
        location: "London, UK",
        createdAt: t - 42 * 60 * 1000,
        lastSeenAt: t,
        current: true,
      },
      {
        id: "sess-office",
        device: "ThinkPad X1",
        browser: "Firefox 132 · Windows",
        ip: "198.51.100.7",
        location: "London, UK",
        createdAt: t - 26 * 60 * 60 * 1000,
        lastSeenAt: t - 14 * 60 * 1000,
        current: false,
      },
      {
        id: "sess-mobile",
        device: "iPhone 16",
        browser: "Safari · iOS 19",
        ip: "192.0.2.144",
        location: "Manchester, UK",
        createdAt: t - 3 * 24 * 60 * 60 * 1000,
        lastSeenAt: t - 2 * 24 * 60 * 60 * 1000,
        current: false,
      },
    ],
    impersonations: [],
    controls: {
      platform_halt: "normal",
      relay_pause: "normal",
      maintenance_mode: "normal",
      flag_kill_switches: "normal",
    },
    audit: [
      {
        id: "aud-seed-1",
        at: t - 92 * 60 * 1000,
        actor: "Priya Shah",
        action: "console.escalation_approved",
        target: "control.relay_pause",
        severity: "critical",
        detail: "Two-operator approval satisfied; relay pause executed",
      },
      {
        id: "aud-seed-2",
        at: t - 95 * 60 * 1000,
        actor: "Alex Morgan",
        action: "console.operator_action",
        target: "control.relay_pause",
        severity: "warning",
        detail: "Initiated two-operator approval (2FA verified)",
      },
      {
        id: "aud-seed-3",
        at: t - 4.9 * 60 * 60 * 1000,
        actor: "Priya Shah",
        action: "console.escalation_rejected",
        target: "control.flag_kill_switch",
        severity: "warning",
        detail: "Rejected: insufficient blast-radius justification",
      },
      {
        id: "aud-seed-4",
        at: t - 26 * 60 * 60 * 1000,
        actor: "Alex Morgan",
        action: "console.session_revoked",
        target: "sess-mobile",
        severity: "info",
        detail: "Revoked stale mobile session",
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Store plumbing                                                      */
/* ------------------------------------------------------------------ */

let state: ConsoleState = seedState();
// Stable server snapshot (same reference every call) — required by
// useSyncExternalStore during SSR/hydration.
const SERVER_STATE: ConsoleState = state;
const listeners = new Set<() => void>();
let sweeper: ReturnType<typeof setInterval> | null = null;

function emit(next: ConsoleState) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureSweeper();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ConsoleState {
  return state;
}

function getServerSnapshot(): ConsoleState {
  return SERVER_STATE;
}

/** 1s sweep: expire pending approvals past their 10-min window and
 *  auto-end impersonations past their 15-min deadline (both audit-logged). */
function ensureSweeper() {
  if (sweeper || typeof window === "undefined") return;
  sweeper = setInterval(() => {
    const t = now();
    let changed = false;
    let approvals = state.approvals;
    let impersonations = state.impersonations;
    let audit = state.audit;

    for (const a of approvals) {
      if (a.status === "pending_approval" && a.expiresAt <= t) {
        approvals = approvals.map((x) =>
          x.id === a.id ? { ...x, status: "expired" as const } : x,
        );
        audit = [
          {
            id: uid("aud"),
            at: t,
            actor: "System",
            action: "console.escalation_expired",
            target: a.actionKey,
            severity: "warning",
            detail: `Approval window (10 min) elapsed for "${a.actionLabel}"`,
          },
          ...audit,
        ];
        changed = true;
      }
    }

    for (const imp of impersonations) {
      if (!imp.endedAt && imp.expiresAt <= t) {
        impersonations = impersonations.map((x) =>
          x.id === imp.id
            ? { ...x, endedAt: t, endReason: "expired" as const }
            : x,
        );
        audit = [
          {
            id: uid("aud"),
            at: t,
            actor: imp.startedBy.name,
            action: "console.impersonation_ended",
            target: imp.tenantName,
            severity: "warning",
            detail: "Session auto-ended after the 15-minute deadline",
          },
          ...audit,
        ];
        changed = true;
      }
    }

    if (changed) emit({ ...state, approvals, impersonations, audit });
  }, 1000);
}

/** Test/demo helper — restore the seeded state. */
export function resetConsoleStore() {
  emit(seedState());
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function pushAudit(entry: Omit<AuditRecord, "id" | "at">): AuditRecord[] {
  const rec: AuditRecord = { id: uid("aud"), at: now(), ...entry };
  return [rec, ...state.audit];
}

/**
 * Operator A initiates a nuclear-set action (already 2FA-verified at the
 * dialog layer). Returns the `pending_approval` request that operator B
 * must approve within 10 minutes.
 */
export function initiateApproval(input: {
  actionKey: string;
  actionLabel: string;
  blastRadius: string[];
  initiator: OperatorRef;
  tenantId?: string;
  detail?: string;
}): ApprovalRequest {
  const t = now();
  const request: ApprovalRequest = {
    id: uid("apr"),
    actionKey: input.actionKey,
    actionLabel: input.actionLabel,
    blastRadius: input.blastRadius,
    initiator: input.initiator,
    tenantId: input.tenantId,
    createdAt: t,
    expiresAt: t + APPROVAL_TTL_MS,
    status: "pending_approval",
    detail: input.detail,
  };
  emit({
    ...state,
    approvals: [request, ...state.approvals],
    audit: pushAudit({
      actor: input.initiator.name,
      action: "console.operator_action",
      target: input.actionKey,
      severity: "warning",
      detail: `Initiated two-operator approval for "${input.actionLabel}" (2FA verified)`,
    }),
  });
  return request;
}

/**
 * Operator B decides. Called only *after* B's 2FA verifies at the UI
 * layer. Structural CON-32 rule: B must not be A — the approval token
 * names A, so a self-approval returns `self_approval` (403 semantics),
 * never a warning-then-proceed.
 */
export function decideApproval(
  id: string,
  approver: OperatorRef,
  decision: "approve" | "reject",
): ApprovalDecisionResult {
  const request = state.approvals.find((a) => a.id === id);
  if (!request) {
    return { ok: false, code: "not_found", message: "Approval request not found." };
  }
  if (request.status !== "pending_approval") {
    return {
      ok: false,
      code: "already_decided",
      message: `This request was already ${request.status.replace("_", " ")}.`,
    };
  }
  if (now() >= request.expiresAt) {
    return {
      ok: false,
      code: "expired",
      message: "The 10-minute approval window has elapsed. The initiator must re-run the action.",
    };
  }
  if (request.initiator.id === approver.id) {
    // Structural self-approval deny (CON-32 §3.5): 403, not a warning.
    return {
      ok: false,
      code: "self_approval",
      message:
        "Self-approval denied — the approval token names you as the initiator. A different platform operator must approve (403).",
    };
  }

  const t = now();
  const decided: ApprovalRequest = {
    ...request,
    status: decision === "approve" ? "approved" : "rejected",
    approver,
    decidedAt: t,
  };
  // Approved control actions execute immediately (the approval *is* the
  // execution gate for the two-operator set — see emergency-controls).
  const controlKey = parseControlAction(request.actionKey);
  emit({
    ...state,
    approvals: state.approvals.map((a) =>
      a.id === id ? (controlKey && decision === "approve" ? { ...decided, status: "executed" as const, executedAt: t } : decided) : a,
    ),
    controls: controlKey && decision === "approve"
      ? { ...state.controls, [controlKey]: "engaged" as const }
      : state.controls,
    audit: [
      {
        id: uid("aud"),
        at: t,
        actor: approver.name,
        action:
          decision === "approve"
            ? "console.escalation_approved"
            : "console.escalation_rejected",
        target: request.actionKey,
        severity: decision === "approve" ? "critical" : "warning",
        detail:
          decision === "approve"
            ? `Approved "${request.actionLabel}" initiated by ${request.initiator.name}${controlKey ? "; control engaged" : ""}`
            : `Rejected "${request.actionLabel}" initiated by ${request.initiator.name}`,
      },
      ...state.audit,
    ],
  });
  return { ok: true, request: decided };
}

/** `control.relay_pause.engage` → `relay_pause`; null for non-control actions. */
function parseControlAction(actionKey: string): ControlKey | null {
  if (!actionKey.startsWith("control.")) return null;
  const candidate = actionKey.split(".")[1];
  return candidate === "platform_halt" ||
    candidate === "relay_pause" ||
    candidate === "maintenance_mode" ||
    candidate === "flag_kill_switches"
    ? candidate
    : null;
}

/** Mark an approved request as executed (called after the action runs). */
export function markApprovalExecuted(id: string) {
  const t = now();
  emit({
    ...state,
    approvals: state.approvals.map((a) =>
      a.id === id && a.status === "approved"
        ? { ...a, status: "executed" as const, executedAt: t }
        : a,
    ),
  });
}

/** CON-30 — revoke a console session (current session can't be revoked here). */
export function revokeSession(id: string, by: OperatorRef) {
  const session = state.sessions.find((s) => s.id === id);
  if (!session || session.current) return;
  emit({
    ...state,
    sessions: state.sessions.filter((s) => s.id !== id),
    audit: pushAudit({
      actor: by.name,
      action: "console.session_revoked",
      target: id,
      severity: "info",
      detail: `Revoked ${session.device} (${session.browser})`,
    }),
  });
}

/** CON-07 — start a 15-minute impersonation (view-as) session. */
export function startImpersonation(input: {
  tenantId: string;
  tenantName: string;
  operator: OperatorRef;
}): ImpersonationSession {
  const t = now();
  const session: ImpersonationSession = {
    id: uid("imp"),
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    startedBy: input.operator,
    startedAt: t,
    expiresAt: t + IMPERSONATION_TTL_MS,
    renewCount: 0,
  };
  emit({
    ...state,
    impersonations: [session, ...state.impersonations],
    audit: pushAudit({
      actor: input.operator.name,
      action: "console.impersonation_started",
      target: input.tenantName,
      severity: "critical",
      detail: "View-as session opened (15-minute limit, read-only)",
    }),
  });
  return session;
}

/** CON-07 — renew for another 15 minutes (tracked for audit). */
export function renewImpersonation(id: string): ImpersonationSession | null {
  const session = state.impersonations.find((s) => s.id === id && !s.endedAt);
  if (!session) return null;
  const t = now();
  const renewed: ImpersonationSession = {
    ...session,
    expiresAt: t + IMPERSONATION_TTL_MS,
    renewCount: session.renewCount + 1,
  };
  emit({
    ...state,
    impersonations: state.impersonations.map((s) => (s.id === id ? renewed : s)),
    audit: pushAudit({
      actor: session.startedBy.name,
      action: "console.impersonation_renewed",
      target: session.tenantName,
      severity: "warning",
      detail: `Extended by 15 minutes (renewal #${renewed.renewCount})`,
    }),
  });
  return renewed;
}

export function endImpersonation(
  id: string,
  reason: ImpersonationSession["endReason"] = "manual",
) {
  const session = state.impersonations.find((s) => s.id === id && !s.endedAt);
  if (!session) return;
  const t = now();
  emit({
    ...state,
    impersonations: state.impersonations.map((s) =>
      s.id === id ? { ...s, endedAt: t, endReason: reason } : s,
    ),
    audit: pushAudit({
      actor: session.startedBy.name,
      action: "console.impersonation_ended",
      target: session.tenantName,
      severity: "info",
      detail:
        reason === "manual"
          ? "Session ended by operator"
          : `Session ended (${reason})`,
    }),
  });
}

/** Emergency control state change — the caller has already 2FA'd. */
export function setControl(
  key: ControlKey,
  value: ControlState,
  by: OperatorRef,
  detail?: string,
) {
  emit({
    ...state,
    controls: { ...state.controls, [key]: value },
    audit: pushAudit({
      actor: by.name,
      action: "console.operator_action",
      target: key,
      severity: value === "engaged" ? "critical" : "warning",
      detail: detail ?? `${key} → ${value}`,
    }),
  });
}

/** Append an arbitrary console audit record (e.g. from screen-level flows). */
export function recordAudit(entry: Omit<AuditRecord, "id" | "at">) {
  emit({ ...state, audit: pushAudit(entry) });
}

/* ------------------------------------------------------------------ */
/* React binding                                                       */
/* ------------------------------------------------------------------ */

/** Subscribe to the whole console store (stable snapshot semantics). */
export function useConsoleStore(): ConsoleState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Operators eligible to approve (any super-admin distinct from the initiator). */
export function isEligibleApprover(
  user: AuthUser | undefined,
  initiator: OperatorRef,
): boolean {
  if (!user) return false;
  if (user.application !== "super-admin") return false;
  return user.id !== initiator.id;
}
