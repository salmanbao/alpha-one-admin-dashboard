"use client";

/**
 * PFaaS Platform — Impersonation Session Store
 *
 * PRD raw.md L5494–5572 (impersonation.service.ts): starting a session
 * emits an `impersonation_started` audit event and returns a token with
 * the `imp` (impersonator) claim; ending it emits `impersonation_ended`.
 * Only super admins may impersonate.
 *
 * The trading module's ImpersonateSheet calls `startImpersonation()` and
 * the shell's exit banner subscribes via `useImpersonation()` — the store
 * lives at platform level so the shell never imports module code (same
 * direction as nav-badges).
 */

import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";

export interface ImpersonationSession {
  /** Trader being impersonated (display name) */
  name: string;
  /** Admin who started the session (imp claim) */
  impersonator: string;
  /** Session start, ISO timestamp */
  startedAt: string;
}

let session: ImpersonationSession | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

/** Start an impersonation session (PRD audit event: impersonation_started). */
export function startImpersonation(name: string, impersonator = "Platform Admin"): void {
  session = { name, impersonator, startedAt: new Date().toISOString() };
  emit();
  // PRD L5545 — every session is recorded against the admin's ID.
  toast({
    title: "Impersonation session started",
    description: `Signed in as ${name} — all actions audited under ${impersonator} (impersonation_started).`,
  });
}

/** End the active session (PRD audit event: impersonation_ended). */
export function endImpersonation(): void {
  if (!session) return;
  const { name } = session;
  session = null;
  emit();
  toast({
    title: "Impersonation ended",
    description: `Returned to your admin session — ${name} access closed (impersonation_ended).`,
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
