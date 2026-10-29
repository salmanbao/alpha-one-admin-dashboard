"use client";

import { useEffect, useState } from "react";
import type { KycRecord } from "@/lib/platform/mock-data";
import { kycRecords as seedKyc } from "@/lib/platform/mock-data";
import { setNavBadge } from "@/lib/platform/nav-badges";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { demoKycSchema } from "@/lib/platform/validation";

/**
 * Session-scoped KYC decision store.
 *
 * Approve / Reject / Request-Info actions mutate this store; the KYC
 * overview KPIs, review queue, risk page and widgets all render from
 * `effectiveKycStatus()` and subscribe via `useKycVersion()`, so a
 * decision made on any row instantly updates every KYC surface.
 */
export type KycDecision = "approved" | "rejected" | "info-requested";

// Rehydrate decisions from a previous visit (demo persistence).
const decisions = new Map<string, { status: KycDecision; at: string }>(
  Object.entries(loadDemoState("kyc", demoKycSchema, {})),
);
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  saveDemoState("kyc", Object.fromEntries(decisions));
  syncBadge();
  listeners.forEach((l) => l());
}

/**
 * PRD §4.6.2 pending_kyc sidebar badge — every record still awaiting a
 * decision (pending or in review) counts, across all tenants.
 */
function syncBadge() {
  let n = 0;
  for (const r of seedKyc) {
    const s = effectiveKycStatus(r);
    if (s === "pending" || s === "review") n += 1;
  }
  setNavBadge("kyc", n);
}

export function applyKycDecision(
  recordId: string,
  decision: KycDecision,
  opts?: { reason?: string },
) {
  decisions.set(recordId, { status: decision, at: new Date().toISOString() });
  // Audit chokepoint (lib/audit.ts) — see payout-store.applyPayoutDecision.
  const r = seedKyc.find((x) => x.id === recordId);
  const who = r ? r.traderName : recordId;
  recordAudit({
    action:
      decision === "approved"
        ? "Approved KYC"
        : decision === "rejected"
          ? "Rejected KYC"
          : "Requested KYC info",
    entity: "kyc",
    entityId: recordId,
    summary: opts?.reason ? `${who} — ${opts.reason}` : `${who} — ${decision}`,
    severity: decision === "rejected" ? "warning" : "info",
  });
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

// Seed the sidebar badge at boot (this module is imported by the kyc
// manifest, which module-bootstrap loads eagerly).
syncBadge();
