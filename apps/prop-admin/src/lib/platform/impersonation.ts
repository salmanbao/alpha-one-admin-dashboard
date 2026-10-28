"use client";

/**
 * PFaaS Platform — Impersonation Session Store
 *
 * PRD raw.md L5494–5572 (impersonation.service.ts): starting a session
 * emits an `impersonation_started` audit event and returns a token with
 * the `imp` (impersonator) claim; ending it emits `impersonation_ended`.
 * Only users holding the `impersonation.start` permission may impersonate
 * (enforced at the ImpersonateSheet).
 *
 * Session controls (gap analysis §4):
 * - a BUSINESS REASON is required before the session can start,
 * - a duration (15/30/60 min) is chosen up front and the session carries
 *   an `expiresAt`; the shell banner counts down and the session
 *   auto-expires (`endImpersonation("auto-expired")`).
 *
 * Both events are recorded through the audit chokepoint (lib/audit.ts)
 * as `critical` severity.
 *
 * The trading module's ImpersonateSheet calls `startImpersonation()` and
 * the shell's exit banner subscribes via `useImpersonation()` — the store
 * lives at platform level so the shell never imports module code (same
 * direction as nav-badges).
 */

import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { recordAudit } from "@/lib/audit";

export interface ImpersonationSession {
  /** Trader being impersonated (display name) */
  name: string;
  /** Admin who started the session (imp claim) */
  impersonator: string;
  /** Session start, ISO timestamp */
  startedAt: string;
  /** Business reason captured at start (required — see ImpersonateSheet) */
  reason: string;
  /** Auto-expiry, ISO timestamp (startedAt + durationMinutes) */
  expiresAt: string;
}

export interface StartImpersonationOptions {
  /** Why the admin is impersonating (required). */
  reason: string;
  /** Session length in minutes (15 / 30 / 60 in the UI). */
  durationMinutes: number;
}

let session: ImpersonationSession | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

/** Start an impersonation session (PRD audit event: impersonation_started). */
export function startImpersonation(
  name: string,
  impersonator = "Platform Admin",
  opts: StartImpersonationOptions,
): void {
  const reason = opts.reason.trim();
  if (!reason) {
    toast({
      title: "Reason required",
      description: "A business reason is required before starting an impersonation session.",
      variant: "destructive",
    });
    return;
  }
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + opts.durationMinutes * 60_000);
  session = {
    name,
    impersonator,
    startedAt: startedAt.toISOString(),
    reason,
    expiresAt: expiresAt.toISOString(),
  };
  emit();
  // PRD L5545 — every session is recorded against the admin's ID.
  recordAudit({
    action: "Started impersonation",
    entity: "impersonation",
    entityId: name,
    summary: `${impersonator} → ${name} for ${opts.durationMinutes} min — ${reason}`,
    severity: "critical",
  });
  toast({
    title: "Impersonation session started",
    description: `Signed in as ${name} for ${opts.durationMinutes} min — all actions audited under ${impersonator} (impersonation_started).`,
  });
}

/**
 * End the active session (PRD audit event: impersonation_ended).
 * `endReason` marks automatic expiry ("auto-expired") vs manual exit.
 */
export function endImpersonation(endReason?: string): void {
  if (!session) return;
  const { name, impersonator, reason } = session;
  session = null;
  emit();
  recordAudit({
    action: "Ended impersonation",
    entity: "impersonation",
    entityId: name,
    summary: `${impersonator} → ${name} ended (${endReason ?? "manual exit"}) — reason at start: ${reason}`,
    severity: "critical",
  });
  toast({
    title: endReason === "auto-expired" ? "Impersonation expired" : "Impersonation ended",
    description:
      endReason === "auto-expired"
        ? `Session duration reached — returned to your admin session (${name} access closed).`
        : `Returned to your admin session — ${name} access closed (impersonation_ended).`,
  });
}

/** The active session, if any. */
export function getImpersonation(): ImpersonationSession | null {
  return session;
}

/** Subscribe to session changes (returns an unsubscribe function). */
export function subscribeImpersonation(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** React subscription hook for the active session. */
export function useImpersonation(): ImpersonationSession | null {
  const [current, setCurrent] = useState<ImpersonationSession | null>(session);
  useEffect(() => subscribeImpersonation(() => setCurrent(session)), []);
  return current;
}
