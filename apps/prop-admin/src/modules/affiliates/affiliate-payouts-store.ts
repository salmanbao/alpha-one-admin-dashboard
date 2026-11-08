"use client";

import { useSyncExternalStore } from "react";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { recordAudit } from "@/lib/audit";
import { setNavBadge } from "@/lib/platform/nav-badges";

export interface AffiliatePayout {
  id: string;
  affiliateId: string;
  affiliateName: string;
  tenantId: string;
  amount: number;
  currency: string;
  paidAt: string;
}

const SLOT = "affiliate-payouts";
const listeners = new Set<() => void>();
let state: AffiliatePayout[] = [];

try {
  const persisted = loadDemoState(SLOT, null as any, []);
  if (Array.isArray(persisted)) state = persisted as AffiliatePayout[];
} catch {
  state = [];
}

function notify() {
  listeners.forEach((l) => l());
  try {
    saveDemoState(SLOT, state);
  } catch {
    /* ignore */
  }
}

export function readAffiliatePayouts(tenantId?: string): AffiliatePayout[] {
  return tenantId ? state.filter((p) => p.tenantId === tenantId) : [...state];
}

export function payCommission(p: Omit<AffiliatePayout, "id" | "paidAt">): AffiliatePayout {
  const entry: AffiliatePayout = {
    ...p,
    id: `AP-${Date.now().toString(36).toUpperCase()}`,
    paidAt: new Date().toISOString(),
  };
  state = [entry, ...state];
  recordAudit({
    action: "Paid affiliate commission",
    entity: "affiliate",
    entityId: p.affiliateId,
    summary: `${p.affiliateName} — ${p.amount} ${p.currency}`,
    severity: "info",
  });
  notify();
  return entry;
}

export function useAffiliatePayouts(tenantId?: string): AffiliatePayout[] {
  const raw = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => JSON.stringify(tenantId ? state.filter((p) => p.tenantId === tenantId) : state),
    () => "[]",
  );
  return JSON.parse(raw) as AffiliatePayout[];
}
