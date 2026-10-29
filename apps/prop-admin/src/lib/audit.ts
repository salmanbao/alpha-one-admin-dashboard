/**
 * PFaaS Platform — Session audit chokepoint
 *
 * Every consequential decision (payout approve/reject/escalate/process,
 * KYC decisions, breach resolve/reopen, evaluation review, impersonation
 * sessions) funnels through `recordAudit()` from its store, so each
 * decision produces an `AuditEntry` regardless of which surface triggered
 * it (table row, dashboard widget, contextual panel, batch action).
 *
 * Entries are:
 * - attributed to the current demo user/tenant via `setAuditContext()`
 *   (wired from platform-context's user/tenant persistence effect),
 * - appended to an in-session list so the Audit log and entity timelines
 *   re-render live via `useAuditVersion()`,
 * - persisted to localStorage so a refresh doesn't lose the trail.
 *
 * Hydration is lazy (first `setAuditContext` / `recordAudit` /
 * `useAuditVersion` call on the client) — never during SSR — so server
 * and first client render always agree (no hydration mismatch), and the
 * loaded entries notify subscribers afterwards.
 *
 * The seeded `auditLog` in mock-data.ts remains the static historical
 * baseline; session entries are merged on top by `getTenantAudit()`.
 */

import { useEffect, useState } from "react";
import type { AuditEntry } from "@/lib/platform/types";
import { parseAuditSession } from "@/lib/platform/validation";

const SESSION_KEY = "pfaas:auditSession";
/** Cap persisted entries so localStorage can't grow unbounded. */
const MAX_SESSION_ENTRIES = 200;

let context: { actor: string; tenantId?: string } = { actor: "System" };
let sessionEntries: AuditEntry[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version += 1;
  listeners.forEach((l) => l());
}

/**
 * Load persisted session entries from localStorage (once, client-only).
 * If anything was restored, notify subscribers so mounted views re-render.
 */
export function hydrateSessionAudit(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) {
      // zod-validated (lib/platform/validation.ts) — malformed or
      // hand-edited entries are dropped instead of crashing the log.
      const restored = parseAuditSession(raw);
      if (restored.length > 0) {
        sessionEntries = restored;
        emit();
      }
    }
  } catch {
    /* storage access denied — start from an empty session trail */
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify(sessionEntries.slice(-MAX_SESSION_ENTRIES)),
    );
  } catch {
    /* quota errors — entries stay in memory for this session */
  }
}

/**
 * Set the actor/tenant attributed to subsequent `recordAudit()` calls.
 * Called from platform-context whenever the demo user or tenant changes.
 */
export function setAuditContext(actor: string, tenantId?: string): void {
  hydrateSessionAudit();
  context = { actor, tenantId };
}

export interface RecordAuditInput {
  /** Short past-tense action, e.g. "Approved payout" (matches seed style). */
  action: string;
  /** Entity kind, e.g. "payout" — also the default `module` (seed style). */
  entity: string;
  entityId?: string;
  /** Human-readable one-liner shown in the audit table. */
  summary: string;
  severity?: AuditEntry["severity"];
  /** Audit-log filter vocabulary; defaults to `entity`. */
  module?: string;
  /** Override the context actor (rare — prefer setAuditContext). */
  actor?: string;
  /** Override the context tenant (rare — prefer setAuditContext). */
  tenantId?: string;
}

/** Record a session audit entry (the single write path for the trail). */
export function recordAudit(input: RecordAuditInput): AuditEntry {
  hydrateSessionAudit();
  const entry: AuditEntry = {
    id: `ses-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    actor: input.actor ?? context.actor,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    summary: input.summary,
    severity: input.severity ?? "info",
    module: input.module ?? input.entity,
    tenantId: input.tenantId ?? context.tenantId,
  };
  sessionEntries = [...sessionEntries, entry];
  persist();
  emit();
  return entry;
}

/** Session entries recorded in this browser (oldest → newest). */
export function getSessionAudit(): readonly AuditEntry[] {
  return sessionEntries;
}

/** React hook — re-renders whenever a session audit entry is recorded. */
export function useAuditVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    // Register the listener BEFORE hydrating: hydration restores persisted
    // entries and emits, which must reach this listener — otherwise a fresh
    // page load would render the pre-hydration (empty) trail and never
    // re-render with the restored entries.
    const l = () => setV(version);
    listeners.add(l);
    hydrateSessionAudit();
    // If the version moved between render and this effect (or hydration ran
    // earlier without emitting), sync so useMemo consumers recompute.
    if (version !== v) setV(version);
    return () => {
      listeners.delete(l);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- v is the mount-time snapshot; changes after mount arrive via the listener
  }, []);
  return v;
}
