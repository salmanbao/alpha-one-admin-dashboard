"use client";

/**
 * Payout holds — R12 GAP-T5.
 *
 * The eligibility gates used to stop at KYC: nothing surfaced the holds
 * that actually stall money, so a trader saw a healthy processing state
 * while operations held the funds (the "why is my payout stuck" class).
 * This module reads the SAME-ORIGIN demo state the operator side already
 * writes and returns the active holds for one account:
 *
 *   fraud   `payout.fraud-blocked` / `payout.fraud-escalated` verdicts on
 *           the shared lifecycle log (R9 W2 UC-O5) — matched to this
 *           trader by `payload.traderId` (the terra accountId the intake
 *           row carried) or by the request's own reference/id. A later
 *           `payout.fraud-cleared` releases it.
 *   aml     prop-admin's AML console cases (`pfaas:demo:aml-cases`,
 *           same-origin demo transport — the same shared-storage premise
 *           as the lifecycle log) with a live `payoutHold`, matched to
 *           this trader by traderId, email or display name.
 *   review  `payout.escalated` (second-signature review) on one of this
 *           trader's in-flight requests, cleared by any later decision
 *           event. Non-blocking: it reports a review in progress without
 *           refusing new requests.
 *
 * Only blocking holds (fraud-blocked, AML) fail the
 * "No compliance holds on payouts" criterion in buildPayoutCriteria —
 * which is what actually gates submission, so display and enforcement
 * cannot drift apart.
 */

import { readLifecycleLog } from "@pfaas/lifecycle";

export type PayoutHoldKind = "aml" | "fraud" | "review";

export type PayoutHold = {
  kind: PayoutHoldKind;
  /** Stable-ish id (flag id / case id / reference) for keys and notes. */
  id: string;
  /** Short human label shown in the criterion note. */
  label: string;
  /** One-line reason — why money is stopped. */
  detail: string;
  /** true → fails the compliance-holds criterion and gates submission. */
  blocking: boolean;
};

/** prop-admin AML console persistence slot (demo-persistence PREFIX). */
const AML_STORAGE_KEY = "pfaas:demo:aml-cases";

/** Live AML statuses that keep a payout hold enforced (mirrors aml-store). */
const AML_LIVE_STATUSES = new Set(["open", "investigating", "escalated"]);

type StoredAmlCase = {
  id?: string;
  traderId?: string;
  traderName?: string;
  email?: string;
  typology?: string;
  risk?: string;
  status?: string;
  payoutHold?: boolean;
};

/** The trader's identity keys — used to join operator AML cases. */
function identityKeys(accountId: string): { traderId: string; email: string; name: string } {
  let email = "";
  let name = "";
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("pfaas:trader:session");
      const session = raw ? (JSON.parse(raw) as { email?: string; displayName?: string }) : null;
      email = session?.email ?? "";
      name = session?.displayName ?? "";
    } catch {
      /* no session — join falls back to traderId only */
    }
  }
  return { traderId: accountId, email, name };
}

/**
 * AML holds from prop-admin's console, joined to this trader. Reads the
 * shared same-origin demo state (documented transport for this repo's
 * three-app demo gateway); degrades to "no hold" whenever the key is
 * absent, unreadable or SSR — never throws, never blocks on ambiguity.
 */
function amlHoldsFor(accountId: string): PayoutHold[] {
  if (typeof window === "undefined") return [];
  let cases: StoredAmlCase[] = [];
  try {
    const raw = window.localStorage.getItem(AML_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) cases = parsed as StoredAmlCase[];
  } catch {
    return [];
  }
  const id = identityKeys(accountId);
  return cases
    .filter(
      (c) =>
        c.payoutHold === true &&
        typeof c.status === "string" &&
        AML_LIVE_STATUSES.has(c.status) &&
        (c.traderId === id.traderId ||
          (!!id.email && c.email === id.email) ||
          (!!id.name && c.traderName === id.name)),
    )
    .map((c) => ({
      kind: "aml" as const,
      id: String(c.id ?? "aml-hold"),
      label: `AML hold (${String(c.id ?? "case")})`,
      detail: `${c.typology ?? "Transaction monitoring"} — payouts frozen pending compliance disposition${c.risk ? ` • risk ${c.risk}` : ""}`,
      blocking: true,
    }));
}

/**
 * Fraud + review holds derived from the shared lifecycle log. The log is
 * processed in order so the LATEST verdict per request wins: a cleared
 * flag releases the hold, and any later decision (approved/paid/rejected)
 * supersedes an older escalation.
 */
function logHoldsFor(accountId: string): PayoutHold[] {
  // This trader's request identities — fraud/escalation events are also
  // matched by payload.traderId, but reference matching covers payloads
  // emitted before that join key existed.
  const myRefs = new Set<string>();
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("pfaas:trader:payoutRequests");
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) {
        for (const r of parsed as Array<{ id?: string; reference?: string }>) {
          if (r.id) myRefs.add(r.id);
          if (r.reference) myRefs.add(r.reference);
        }
      }
    } catch {
      /* no stored requests — traderId matching still applies */
    }
  }

  const isMine = (e: { entity?: { id?: string }; payload?: Record<string, unknown> }): boolean => {
    const p = e.payload ?? {};
    if (p.traderId === accountId || p.accountId === accountId) return true;
    const ref = typeof p.reference === "string" ? p.reference : "";
    if (ref && myRefs.has(ref)) return true;
    const eid = e.entity?.id ?? "";
    return !!eid && myRefs.has(eid);
  };

  // reference → latest state ("blocked" | "escalated" | "cleared" | "review")
  const fraud = new Map<string, { state: string; reason: string }>();
  const review = new Map<string, { state: string; label: string }>();

  for (const e of readLifecycleLog()) {
    if (e.entity?.kind !== "payout" && !e.payload?.reference) continue;
    if (!isMine(e)) continue;
    const ref =
      typeof e.payload?.reference === "string" ? e.payload.reference : String(e.entity?.id ?? "");
    const reason =
      typeof e.payload?.reason === "string" && e.payload.reason
        ? e.payload.reason
        : typeof e.payload?.signal === "string" && e.payload.signal
          ? String(e.payload.signal)
          : "";
    switch (e.name) {
      case "payout.fraud-blocked":
        fraud.set(ref, { state: "blocked", reason });
        break;
      case "payout.fraud-escalated":
        fraud.set(ref, { state: "escalated", reason });
        break;
      case "payout.fraud-cleared":
        fraud.set(ref, { state: "cleared", reason });
        break;
      case "payout.escalated":
        if (!e.payload?.automated) review.set(ref, { state: "review", label: "Second-signature review" });
        break;
      case "payout.approved":
      case "payout.processing":
      case "payout.paid":
      case "payout.rejected":
      case "payout.failed":
      case "payout.cancelled":
        // A later decision closes the escalation window for this request.
        review.delete(ref);
        break;
    }
  }

  const holds: PayoutHold[] = [];
  for (const [ref, f] of fraud) {
    if (f.state === "cleared") continue;
    holds.push({
      kind: "fraud",
      id: `pf-${ref}`,
      label: f.state === "blocked" ? `Fraud hold (${ref})` : `Fraud review (${ref})`,
      detail:
        f.state === "blocked"
          ? `Paused for compliance review${f.reason ? ` — ${f.reason}` : ""}. No money moves while the flag stands.`
          : `Escalated to senior review${f.reason ? ` — ${f.reason}` : ""}.`,
      blocking: f.state === "blocked",
    });
  }
  for (const [ref, r] of review) {
    holds.push({
      kind: "review",
      id: `esc-${ref}`,
      label: `${r.label} (${ref})`,
      detail: "Your request is awaiting a second operator signature — processing continues after it clears.",
      blocking: false,
    });
  }
  return holds;
}

/** Every active hold for one account — the source for the strip criterion. */
export function activePayoutHolds(accountId: string): PayoutHold[] {
  return [...amlHoldsFor(accountId), ...logHoldsFor(accountId)];
}
