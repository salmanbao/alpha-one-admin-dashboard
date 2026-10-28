"use client";

import { useEffect, useState } from "react";
import type { Breach } from "@/lib/platform/mock-data";
import { breaches as seedBreaches } from "@/lib/platform/mock-data";
import { recordAudit } from "@/lib/audit";

/**
 * Session-scoped breach resolution store.
 *
 * Breaches can be resolved from the Breaches table and from the
 * BreachResolutionActions panel. This store keeps those decisions in
 * one place so every risk surface (tables, KPIs, attention center)
 * reflects them instantly instead of leaving rows "open" after a
 * success toast.
 */
const resolvedIds = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Mark a breach resolved for this session. */
export function resolveBreach(breachId: string) {
  resolvedIds.add(breachId);
  // Audit chokepoint (lib/audit.ts) — every resolve surface (breach table,
  // BreachResolutionActions panel) lands here.
  const b = seedBreaches.find((x) => x.id === breachId);
  recordAudit({
    action: "Resolved breach",
    entity: "breach",
    entityId: breachId,
    summary: b ? `${b.traderName} — ${b.type} breach marked resolved.` : `Breach ${breachId} marked resolved.`,
    severity: "info",
  });
  emit();
}

/** Re-open is not part of the demo flows, but keep the API symmetric. */
export function reopenBreach(breachId: string) {
  resolvedIds.delete(breachId);
  const b = seedBreaches.find((x) => x.id === breachId);
  recordAudit({
    action: "Reopened breach",
    entity: "breach",
    entityId: breachId,
    summary: b ? `${b.traderName} — ${b.type} breach reopened.` : `Breach ${breachId} reopened.`,
    severity: "warning",
  });
  emit();
}

/** Effective status of a breach, honoring session resolutions. */
export function effectiveBreachStatus(
  b: Pick<Breach, "id" | "status">,
): Breach["status"] {
  return b.status === "resolved" || resolvedIds.has(b.id) ? "resolved" : "open";
}

/** Subscribe the calling component to store mutations. */
export function useBreachVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}
