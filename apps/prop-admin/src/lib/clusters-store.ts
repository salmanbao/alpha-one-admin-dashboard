"use client";

/**
 * Collusion & correlation clusters — R9 W4 UC-O4.
 *
 * Derives candidate clusters of accounts that share suspicious signals:
 *   ip-overlap       — same IP address across ≥ 2 accounts (from ip-records)
 *   method-reuse     — same payout-method fingerprint across ≥ 2 accounts
 *                       (from `payout.requested` log events)
 *   mirrored-fills   — opposing positions on the same symbol within a
 *                       short window (from exposure fixtures + trade.opened)
 *   shared-referral  — same affiliate/referral source (fixture for demo)
 *
 * Each `ClusterCase` has signals[], status ("candidate"|"escalated"|"dismissed"),
 * notes[], and an `escalateToFraud` action that creates a manual flag in
 * the payout fraud queue (one-click escalation).
 *
 * Persistence: case status/notes persist under `pfaas:demo:clusters` (R10).
 * Named consumers: correlation-clusters view, risk dashboard badges.
 */

import { useEffect, useState } from "react";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { emitLifecycle, readLifecycleLog, useLifecycleLog } from "@pfaas/lifecycle";
import { buildIpRecords } from "@/lib/ip-records";
import { escalateClusterToFraud, getPayoutFraudFlags } from "@/lib/payout-fraud-store";
import { createFirmExposureStore } from "@/lib/exposure-store";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ClusterSignal = "ip-overlap" | "method-reuse" | "mirrored-fills" | "shared-referral";

export type ClusterStatus = "candidate" | "escalated" | "dismissed";

export interface ClusterNote {
  id: string;
  text: string;
  at: string;
  actor: string;
}

export interface ClusterCase {
  id: string;
  accountIds: string[];
  accountLogins: string[];
  traderIds: string[];
  traderNames: string[];
  signals: ClusterSignal[];
  evidence: string[];
  status: ClusterStatus;
  notes: ClusterNote[];
  createdAt: string;
  escalatedAt?: string;
  fraudFlagId?: string;
}

/* ------------------------------------------------------------------ */
/* Schema & persistence                                                */
/* ------------------------------------------------------------------ */

const clusterNoteSchema = z.object({
  id: z.string(),
  text: z.string(),
  at: z.string(),
  actor: z.string(),
});

const clusterCaseSchema = z.object({
  id: z.string(),
  accountIds: z.array(z.string()),
  accountLogins: z.array(z.string()),
  traderIds: z.array(z.string()),
  traderNames: z.array(z.string()),
  signals: z.array(z.enum(["ip-overlap", "method-reuse", "mirrored-fills", "shared-referral"])),
  evidence: z.array(z.string()),
  status: z.enum(["candidate", "escalated", "dismissed"]),
  notes: z.array(clusterNoteSchema),
  createdAt: z.string(),
  escalatedAt: z.string().optional(),
  fraudFlagId: z.string().optional(),
});

const clustersSchema = z.object({
  overrides: z.record(z.string(), clusterCaseSchema),
});

type ClustersState = { overrides: Record<string, ClusterCase> };

const SLOT = "clusters";
let state: ClustersState = loadDemoState(SLOT, clustersSchema, { overrides: {} });
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  saveDemoState(SLOT, state);
  listeners.forEach((l) => l());
}

export function useClustersVersion(): number {
  const log = useLifecycleLog();
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v + log.length;
}

/* ------------------------------------------------------------------ */
/* Signal derivation (pure)                                            */
/* ------------------------------------------------------------------ */

const MIRRORED_WINDOW_HOURS = 2;
const MIN_SIGNALS_TO_ESCALATE = 2;

function deriveIpOverlap(tenantId: string): Map<string, { accounts: string[]; logins: string[]; traders: string[]; names: string[]; evidence: string[] }> {
  const records = buildIpRecords(tenantId);
  const byIp = new Map<string, typeof records>();
  for (const r of records) {
    if (!byIp.has(r.ipAddress)) byIp.set(r.ipAddress, []);
    byIp.get(r.ipAddress)!.push(r);
  }

  const clusters = new Map<string, { accounts: string[]; logins: string[]; traders: string[]; names: string[]; evidence: string[] }>();
  for (const [ip, recs] of byIp) {
    if (recs.length < 2) continue;
    const accounts = [...new Set(recs.map((r) => r.accountId))];
    const logins = [...new Set(recs.map((r) => r.accountLogin))];
    const traders = [...new Set(recs.map((r) => r.traderId))];
    const names = [...new Set(recs.map((r) => r.traderName))];
    clusters.set(`ip:${ip}`, {
      accounts,
      logins,
      traders,
      names,
      evidence: [`Shared IP ${ip} across accounts #${logins.join(", #")}`],
    });
  }
  return clusters;
}

function deriveMethodReuse(): Map<string, { accounts: string[]; logins: string[]; traders: string[]; names: string[]; evidence: string[] }> {
  const log = readLifecycleLog();
  const requested = log.filter((e) => e.name === "payout.requested" && e.entity.kind === "payout");

  const byFingerprint = new Map<string, Set<{ accountId: string; login: string; traderId: string; name: string }>>();
  for (const e of requested) {
    const fp = typeof e.payload?.methodFingerprint === "string" ? e.payload.methodFingerprint : null;
    const accountId = typeof e.payload?.accountId === "string" ? e.payload.accountId : "";
    const login = typeof e.payload?.accountLogin === "string" ? e.payload.accountLogin : "";
    const traderId = typeof e.payload?.traderId === "string" ? e.payload.traderId : accountId;
    const name = typeof e.payload?.traderName === "string" ? e.payload.traderName : login;
    if (!fp || !accountId) continue;
    if (!byFingerprint.has(fp)) byFingerprint.set(fp, new Set());
    byFingerprint.get(fp)!.add({ accountId, login, traderId, name });
  }

  const clusters = new Map<string, { accounts: string[]; logins: string[]; traders: string[]; names: string[]; evidence: string[] }>();
  for (const [fp, accts] of byFingerprint) {
    if (accts.size < 2) continue;
    const list = [...accts];
    const accounts = [...new Set(list.map((a) => a.accountId))];
    const logins = [...new Set(list.map((a) => a.login))];
    const traders = [...new Set(list.map((a) => a.traderId))];
    const names = [...new Set(list.map((a) => a.name))];
    clusters.set(`fp:${fp}`, {
      accounts,
      logins,
      traders,
      names,
      evidence: [`Payout method fingerprint ${fp} shared across accounts #${logins.join(", #")}`],
    });
  }
  return clusters;
}

function deriveMirroredFills(): Map<string, { accounts: string[]; logins: string[]; traders: string[]; names: string[]; evidence: string[] }> {
  const store = createFirmExposureStore();
  const positions = store.positions;

  // Group by symbol, find opposing pairs within window
  const bySymbol = new Map<string, typeof positions>();
  for (const p of positions) {
    if (!bySymbol.has(p.symbol)) bySymbol.set(p.symbol, []);
    bySymbol.get(p.symbol)!.push(p);
  }

  const clusters = new Map<string, { accounts: string[]; logins: string[]; traders: string[]; names: string[]; evidence: string[] }>();
  for (const [symbol, pos] of bySymbol) {
    const longs = pos.filter((p) => p.side === "long");
    const shorts = pos.filter((p) => p.side === "short");
    for (const l of longs) {
      for (const s of shorts) {
        const lTime = new Date(l.openedAt).getTime();
        const sTime = new Date(s.openedAt).getTime();
        if (Math.abs(lTime - sTime) > MIRRORED_WINDOW_HOURS * 3600 * 1000) continue;
        const accounts = [...new Set([l.accountId, s.accountId])];
        const logins = [...new Set([l.accountLogin, s.accountLogin])];
        const traders = [...new Set([l.accountId, s.accountId])]; // accountId as trader proxy
        const names = [...new Set([l.accountLogin, s.accountLogin])];
        const key = `mirror:${symbol}:${accounts.sort().join("-")}`;
        clusters.set(key, {
          accounts,
          logins,
          traders,
          names,
          evidence: [
            `Mirrored fills on ${symbol}: #${l.accountLogin} long ${l.size} lots vs #${s.accountLogin} short ${s.size} lots within ${MIRRORED_WINDOW_HOURS}h`,
          ],
        });
      }
    }
  }
  return clusters;
}

/**
 * Fixture: shared referral source for demo pair.
 * acct-tenant-alpha-1 and acct-tenant-alpha-2 share referral code "REF-COLLUSION-01".
 */
const FIXTURE_SHARED_REFERRALS: Record<string, string> = {
  "acct-tenant-alpha-1": "REF-COLLUSION-01",
  "acct-tenant-alpha-2": "REF-COLLUSION-01",
};

function deriveSharedReferral(tenantId: string): Map<string, { accounts: string[]; logins: string[]; traders: string[]; names: string[]; evidence: string[] }> {
  const byReferral = new Map<string, string[]>();
  for (const [acctId, ref] of Object.entries(FIXTURE_SHARED_REFERRALS)) {
    if (!byReferral.has(ref)) byReferral.set(ref, []);
    byReferral.get(ref)!.push(acctId);
  }

  const clusters = new Map<string, { accounts: string[]; logins: string[]; traders: string[]; names: string[]; evidence: string[] }>();
  for (const [ref, accts] of byReferral) {
    if (accts.length < 2) continue;
    const logins = accts.map((a) => a.replace("acct-tenant-alpha-", "10000")); // rough login mapping
    clusters.set(`ref:${ref}`, {
      accounts: accts,
      logins,
      traders: accts,
      names: accts,
      evidence: [`Shared referral code ${ref} across accounts #${logins.join(", #")}`],
    });
  }
  return clusters;
}

/* ------------------------------------------------------------------ */
/* Cluster derivation (combines all signals)                           */
/* ------------------------------------------------------------------ */

function deriveClusters(tenantId: string): ClusterCase[] {
  const ipClusters = deriveIpOverlap(tenantId);
  const fpClusters = deriveMethodReuse();
  const mirrorClusters = deriveMirroredFills();
  const refClusters = deriveSharedReferral(tenantId);

  // Merge overlapping account sets
  const accountToCluster = new Map<string, Set<string>>(); // accountId → cluster keys
  const clusterData = new Map<string, { accounts: Set<string>; logins: Set<string>; traders: Set<string>; names: Set<string>; signals: Set<ClusterSignal>; evidence: Set<string> }>();

  const addSignal = (key: string, signal: ClusterSignal, data: { accounts: string[]; logins: string[]; traders: string[]; names: string[]; evidence: string[] }) => {
    if (!clusterData.has(key)) {
      clusterData.set(key, { accounts: new Set(), logins: new Set(), traders: new Set(), names: new Set(), signals: new Set(), evidence: new Set() });
    }
    const c = clusterData.get(key)!;
    for (const a of data.accounts) c.accounts.add(a);
    for (const l of data.logins) c.logins.add(l);
    for (const t of data.traders) c.traders.add(t);
    for (const n of data.names) c.names.add(n);
    c.signals.add(signal);
    for (const e of data.evidence) c.evidence.add(e);
    for (const a of data.accounts) {
      if (!accountToCluster.has(a)) accountToCluster.set(a, new Set());
      accountToCluster.get(a)!.add(key);
    }
  };

  for (const [key, data] of ipClusters) addSignal(key, "ip-overlap", data);
  for (const [key, data] of fpClusters) addSignal(key, "method-reuse", data);
  for (const [key, data] of mirrorClusters) addSignal(key, "mirrored-fills", data);
  for (const [key, data] of refClusters) addSignal(key, "shared-referral", data);

  // Merge clusters that share accounts
  const merged = new Map<string, { accounts: Set<string>; logins: Set<string>; traders: Set<string>; names: Set<string>; signals: Set<ClusterSignal>; evidence: Set<string> }>();
  const visited = new Set<string>();
  for (const [key, data] of clusterData) {
    if (visited.has(key)) continue;
    // BFS to find all connected clusters
    const queue = [key];
    const component = new Set<string>();
    while (queue.length > 0) {
      const k = queue.pop()!;
      if (component.has(k)) continue;
      component.add(k);
      visited.add(k);
      const d = clusterData.get(k);
      if (!d) continue;
      for (const acct of d.accounts) {
        for (const neighbor of accountToCluster.get(acct) ?? []) {
          if (!component.has(neighbor)) queue.push(neighbor);
        }
      }
    }
    // Merge component
    const mergedKey = [...component].sort().join("+");
    if (!merged.has(mergedKey)) {
      merged.set(mergedKey, { accounts: new Set(), logins: new Set(), traders: new Set(), names: new Set(), signals: new Set(), evidence: new Set() });
    }
    const m = merged.get(mergedKey)!;
    for (const k of component) {
      const d = clusterData.get(k);
      if (!d) continue;
      for (const a of d.accounts) m.accounts.add(a);
      for (const l of d.logins) m.logins.add(l);
      for (const t of d.traders) m.traders.add(t);
      for (const n of d.names) m.names.add(n);
      for (const s of d.signals) m.signals.add(s);
      for (const e of d.evidence) m.evidence.add(e);
    }
  }

  // Convert to ClusterCase[]
  const cases: ClusterCase[] = [];
  for (const [key, data] of merged) {
    if (data.accounts.size < 2) continue; // need ≥ 2 accounts
    const id = key.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 64);
    cases.push({
      id,
      accountIds: [...data.accounts],
      accountLogins: [...data.logins],
      traderIds: [...data.traders],
      traderNames: [...data.names],
      signals: [...data.signals],
      evidence: [...data.evidence],
      status: "candidate",
      notes: [],
      createdAt: new Date().toISOString(),
    });
  }

  return cases.sort((a, b) => b.signals.length - a.signals.length || a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

/** Reactive cluster cases (view + badges). */
export function useClusterCases(tenantId: string): ClusterCase[] {
  const log = useLifecycleLog();
  useClustersVersion();
  const derived = deriveClusters(tenantId);
  const overrides = state.overrides;
  return derived.map((c) => overrides[c.id] ?? c);
}

/** Non-reactive read. */
export function getClusterCases(tenantId: string): ClusterCase[] {
  const derived = deriveClusters(tenantId);
  const overrides = state.overrides;
  return derived.map((c) => overrides[c.id] ?? c);
}

/** Check if a cluster has an active fraud flag. */
export function clusterHasFraudFlag(clusterId: string): boolean {
  const flags = getPayoutFraudFlags();
  return flags.some((f) => f.reference === `cluster-${clusterId}` && f.status !== "cleared");
}

/* ------------------------------------------------------------------ */
/* Actions (audited + persisted)                                       */
/* ------------------------------------------------------------------ */

/** Add a note to a cluster case. */
export function addClusterNote(clusterId: string, text: string, actor: string): void {
  const derived = deriveClusters("platform"); // tenant doesn't matter for override lookup
  const existing = derived.find((c) => c.id === clusterId);
  if (!existing) return;

  const current = state.overrides[clusterId] ?? existing;
  const note: ClusterNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    at: new Date().toISOString(),
    actor,
  };

  state.overrides = {
    ...state.overrides,
    [clusterId]: { ...current, notes: [...current.notes, note] },
  };
  notify();

  recordAudit({
    action: "Added cluster note",
    entity: "risk",
    entityId: clusterId,
    summary: `Cluster ${clusterId} — note added by ${actor}: "${note.text.slice(0, 80)}"`,
    severity: "info",
    module: "risk",
  });
}

/** Dismiss a cluster case (no fraud). */
export function dismissCluster(clusterId: string, reason: string, actor: string): void {
  const derived = deriveClusters("platform");
  const existing = derived.find((c) => c.id === clusterId);
  if (!existing) return;

  const current = state.overrides[clusterId] ?? existing;
  state.overrides = {
    ...state.overrides,
    [clusterId]: {
      ...current,
      status: "dismissed",
      notes: [
        ...current.notes,
        { id: `note-${Date.now()}`, text: `Dismissed: ${reason}`, at: new Date().toISOString(), actor },
      ],
    },
  };
  notify();

  recordAudit({
    action: "Dismissed collusion cluster",
    entity: "risk",
    entityId: clusterId,
    summary: `Cluster ${clusterId} — dismissed by ${actor}: ${reason}`,
    severity: "info",
    module: "risk",
  });
}

/**
 * Escalate a cluster to the payout fraud queue (one-click).
 * Creates a manual fraud flag with the cluster's signals as evidence.
 */
export function escalateCluster(clusterId: string, actor: string): boolean {
  const derived = deriveClusters("platform");
  const cluster = derived.find((c) => c.id === clusterId);
  if (!cluster) return false;
  if (cluster.status === "escalated") return false;
  if (cluster.signals.length < MIN_SIGNALS_TO_ESCALATE) return false; // guardrail

  const flag = escalateClusterToFraud({
    clusterId,
    accountLogins: cluster.accountLogins,
    traderIds: cluster.traderIds,
    traderNames: cluster.traderNames,
    signals: cluster.signals,
    evidence: cluster.evidence,
    reason: `Escalated from collusion workbench — ${cluster.signals.length} signals: ${cluster.signals.join(", ")}`,
  });

  if (!flag) return false;

  const current = state.overrides[clusterId] ?? cluster;
  state.overrides = {
    ...state.overrides,
    [clusterId]: {
      ...current,
      status: "escalated",
      escalatedAt: new Date().toISOString(),
      fraudFlagId: flag.id,
      notes: [
        ...current.notes,
        { id: `note-${Date.now()}`, text: `Escalated to fraud queue (${flag.id})`, at: new Date().toISOString(), actor },
      ],
    },
  };
  notify();

  emitLifecycle({
    entity: { kind: "compliance", id: clusterId },
    name: "risk.cluster-escalated",
    actor: "prop-admin",
    key: `cluster:${clusterId}:escalated:${Date.now()}`,
    payload: {
      clusterId,
      accountLogins: cluster.accountLogins,
      signals: cluster.signals,
      fraudFlagId: flag.id,
      escalatedBy: actor,
    },
  });

  return true;
}

/** Get signal strength label for UI. */
export function signalStrengthLabel(signals: ClusterSignal[]): { label: string; tone: "success" | "warning" | "error" } {
  const n = signals.length;
  if (n >= 3) return { label: "Strong", tone: "error" };
  if (n === 2) return { label: "Moderate", tone: "warning" };
  return { label: "Weak", tone: "success" };
}