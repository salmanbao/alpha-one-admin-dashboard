"use client";

/**
 * Outage claims — trader side (R9 W1 Part B4, UC-T7).
 *
 * A trader who was mid-position during a platform outage files a claim
 * instead of arguing in support chat. The claim is:
 *
 *   • pre-filled with evidence — the closed trades inside the reported
 *     window are read from `lib/trading/trading-store` and their ids are
 *     attached at submit time, so the operator reviews the same trades the
 *     trader sees (no "please list your trades" round-trip);
 *   • persisted (`pfaas:trader:claims`, prefix-wiped on delete-account);
 *   • published as `appeal.claim-submitted` on the shared lifecycle log.
 *
 * Named consumers of `appeal.claim-submitted` (rule 7):
 *   - prop-admin `lib/appeals-store` — derives an `Appeal` row in the
 *     `appeals-queue` view and `recordAudit`s the intake, which is where
 *     the claim actually enters the firm's audit trail;
 *   - prop-admin `lib/platform/cross-app-intake`-style readers of the log.
 *
 * Verdicts do NOT come back through a second write path: the operator's
 * `appeal.accepted` / `appeal.rejected` events are overlaid onto these rows
 * on read (see `projectVerdicts`), so the queue and the trader's claim list
 * can never disagree — both read one log.
 *
 * Honest demo copy: the form says a review agent assesses the claim; no
 * SLA is promised that the product does not implement.
 */

import { useMemo } from "react";
import { emitLifecycle, useLifecycleLog, type LifecycleEvent } from "@pfaas/lifecycle";

const STORAGE_KEY = "pfaas:trader:claims";

export type OutageClaimStatus = "submitted" | "under-review" | "accepted" | "rejected";

export interface OutageClaim {
  id: string;
  accountId: string;
  symbol: string;
  windowFrom: string;
  windowTo: string;
  description: string;
  status: OutageClaimStatus;
  submittedAt: string;
  /** Closed-trade ids inside the window — attached evidence (UC-T7). */
  tradeRefs: string[];
  decidedAt?: string;
  verdictReason?: string;
}

export interface SubmitOutageClaimInput {
  accountId: string;
  symbol: string;
  windowFrom: string;
  windowTo: string;
  description: string;
  tradeRefs: string[];
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

function readStored(): OutageClaim[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutageClaim[]) : [];
  } catch {
    return [];
  }
}

function writeStored(claims: OutageClaim[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(claims));
  } catch {
    /* storage full / private mode — best-effort */
  }
}

/* ------------------------------------------------------------------ */
/* Verdict projection (shared log → claim rows)                        */
/* ------------------------------------------------------------------ */

function verdictOf(e: LifecycleEvent): { id: string; status: OutageClaimStatus; decidedAt: string; reason: string } | null {
  if (e.name !== "appeal.accepted" && e.name !== "appeal.rejected") return null;
  const id = e.entity?.id ?? "";
  if (!id) return null;
  return {
    id,
    status: e.name === "appeal.accepted" ? "accepted" : "rejected",
    decidedAt: e.at,
    reason: String(e.payload?.verdictReason ?? ""),
  };
}

/**
 * Overlay operator verdicts onto stored claims. Takes the log as an
 * argument so callers derive from the `useLifecycleLog` snapshot
 * (hydration-safe: the server snapshot is `[]`).
 */
export function projectVerdicts(claims: OutageClaim[], log: LifecycleEvent[]): OutageClaim[] {
  const verdicts = new Map<string, { status: OutageClaimStatus; decidedAt: string; reason: string }>();
  for (const e of log) {
    const v = verdictOf(e);
    if (v) verdicts.set(v.id, { status: v.status, decidedAt: v.decidedAt, reason: v.reason });
  }
  return claims.map((c) => {
    const v = verdicts.get(c.id);
    return v ? { ...c, status: v.status, decidedAt: v.decidedAt, verdictReason: v.reason || c.verdictReason } : c;
  });
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function readOutageClaims(log: LifecycleEvent[] = []): OutageClaim[] {
  return projectVerdicts(readStored(), log).sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt),
  );
}

/**
 * Reactive claims, including verdicts that arrived from the operator.
 *
 * Derived during render from the `useLifecycleLog` snapshot (the
 * competitions-catalog pattern): during hydration that snapshot is the
 * server's `[]`, so the first client render matches the server HTML and
 * no setState-in-effect is needed.
 */
export function useOutageClaims(): OutageClaim[] {
  const log = useLifecycleLog();
  return useMemo(() => readOutageClaims(log), [log]);
}

/* ------------------------------------------------------------------ */
/* Submit (persisted + published)                                      */
/* ------------------------------------------------------------------ */

export function submitOutageClaim(input: SubmitOutageClaimInput): OutageClaim {
  const claim: OutageClaim = {
    id: `claim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    accountId: input.accountId,
    symbol: input.symbol,
    windowFrom: input.windowFrom,
    windowTo: input.windowTo,
    description: input.description.trim(),
    status: "submitted",
    submittedAt: new Date().toISOString(),
    tradeRefs: input.tradeRefs,
  };

  const next = [claim, ...readStored()];
  writeStored(next);

  emitLifecycle({
    entity: { kind: "appeal", id: claim.id },
    name: "appeal.claim-submitted",
    actor: "trader",
    key: `submitted:${claim.id}`,
    payload: {
      claimId: claim.id,
      accountId: claim.accountId,
      symbol: claim.symbol,
      windowFrom: claim.windowFrom,
      windowTo: claim.windowTo,
      description: claim.description,
      tradeRefs: claim.tradeRefs,
      kind: "outage-claim",
    },
  });

  return claim;
}
