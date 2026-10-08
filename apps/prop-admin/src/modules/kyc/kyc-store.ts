"use client";

import { useEffect, useState } from "react";
import type { KycRecord } from "@/lib/platform/mock-data";

/**
 * Session-scoped KYC decision store.
 *
 * Approve / Reject / Request-Info actions mutate this store; the KYC
 * overview KPIs, review queue, risk page and widgets all render from
 * `effectiveKycStatus()` and subscribe via `useKycVersion()`, so a
 * decision made on any row instantly updates every KYC surface.
 */
export type KycDecision = "approved" | "rejected" | "info-requested";

const decisions = new Map<string, { status: KycDecision; at: string }>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

export function applyKycDecision(recordId: string, decision: KycDecision) {
  decisions.set(recordId, { status: decision, at: new Date().toISOString() });
  emit();
}

export function getKycDecision(recordId: string) {
  return decisions.get(recordId);
}

/**
 * Effective status of a KYC record, honoring session decisions.
 * "info-requested" moves the record into the review state (the applicant
 * was contacted and the submission is being re-checked).
 */
export function effectiveKycStatus(
  r: Pick<KycRecord, "id" | "status">,
): KycRecord["status"] {
  const d = decisions.get(r.id);
  if (!d) return r.status;
  if (d.status === "approved") return "approved";
  if (d.status === "rejected") return "rejected";
  return "review";
}

/** Subscribe the calling component to store mutations. */
export function useKycVersion(): number {
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
