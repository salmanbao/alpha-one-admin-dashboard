"use client";

/**
 * TraderStage — R2-W3-02, one "where is this trader?" answer.
 *
 * Before this, four surfaces each answered the question their own way:
 * the journey checklist (localStorage flags), the verification store
 * (sessionStorage draft), the provisioning page (purchasedAt arithmetic)
 * and the state-adaptive simulator (component state that changed nothing).
 * They could — and did — disagree.
 *
 * Now every surface reads ONE stage derived from the `@pfaas/lifecycle`
 * event log (R2-W3-01):
 *
 *   browsing → purchased → verifying → provisioned → funded → payout-ready
 *
 * The stores keep owning their own detail (the wizard still owns KYC, the
 * provisioning page still owns its six rows); this module only answers
 * "which milestone has the trader reached", plus the banner copy for it.
 *
 * `backfillTraderLifecycle()` runs once per session so a trader who had
 * already bought/verified before this layer existed starts from a log that
 * matches their stored state — no surface is left answering "browsing"
 * while the checklist says "Purchased".
 *
 * The state-adaptive page (`/state-adaptive`, gated by the existing
 * `lifecycle.simulator` feature flag) is now a dev tool over this same log:
 * it writes the events below, so what it shows is what every real surface
 * shows.
 */

import {
  clearLifecycleLog,
  emitLifecycle,
  readLifecycleLog,
  useLifecycleLog,
  type LifecycleEvent,
} from "@pfaas/lifecycle";
import { readJourney } from "@/lib/onboarding/journey-store";
import { readVerificationDraft } from "@/lib/verification/verification-store";
import { readProvisioningHandoff } from "@/lib/onboarding/provisioning-handoff";

export type TraderStage =
  | "browsing"
  | "purchased"
  | "verifying"
  | "provisioned"
  | "provisioning-failed"
  | "funded"
  | "payout-ready";

export const TRADER_STAGES: TraderStage[] = [
  "browsing",
  "purchased",
  "verifying",
  "provisioned",
  "provisioning-failed",
  "funded",
  "payout-ready",
];

const STAGE_RANK: Record<TraderStage, number> = {
  browsing: 0,
  purchased: 1,
  verifying: 2,
  provisioned: 3,
  "provisioning-failed": 4,
  funded: 5,
  "payout-ready": 6,
};

export interface StageFacts {
  purchased: boolean;
  kycSubmitted: boolean;
  kycApproved: boolean;
  provisioningUnderway: boolean;
  provisioned: boolean;
  provisioningFailed: boolean;
  provisioningFailedReason?: string;
  provisioningRetry: boolean;
  funded: boolean;
  payoutRequested: boolean;
}

const EMPTY_FACTS: StageFacts = {
  purchased: false,
  kycSubmitted: false,
  kycApproved: false,
  provisioningUnderway: false,
  provisioned: false,
  provisioningFailed: false,
  provisioningFailedReason: undefined,
  provisioningRetry: false,
  funded: false,
  payoutRequested: false,
};

export interface TraderStageState {
  stage: TraderStage;
  facts: StageFacts;
  /** When the current stage was entered (ISO), null before the first event. */
  since: string | null;
}

/* ------------------------------------------------------------------ */
/* Derivation                                                          */
/* ------------------------------------------------------------------ */

/** Fold a log into the facts this stage model cares about. */
export function stageFactsFrom(log: LifecycleEvent[]): StageFacts {
  const facts: StageFacts = { ...EMPTY_FACTS };
  for (const e of log) {
    switch (e.name) {
      case "purchase.completed":
        facts.purchased = true;
        break;
      case "kyc.submitted":
      case "kyc.reviewing":
      case "kyc.rejected":
      case "kyc.info-requested":
        facts.kycSubmitted = true;
        break;
      case "kyc.approved":
        facts.kycSubmitted = true;
        facts.kycApproved = true;
        break;
      case "provisioning.started":
        facts.provisioningUnderway = true;
        break;
      case "provisioning.activated":
        facts.provisioningUnderway = true;
        facts.provisioned = true;
        break;
      case "provisioning.failed":
        facts.provisioningUnderway = true;
        facts.provisioningFailed = true;
        facts.provisioningFailedReason = typeof e.payload?.reason === "string" ? e.payload.reason : undefined;
        break;
      case "provisioning.retry":
        facts.provisioningUnderway = true;
        facts.provisioningRetry = true;
        break;
      case "challenge.funded":
        facts.funded = true;
        break;
      case "payout.requested":
        facts.payoutRequested = true;
        break;
      default:
        break;
    }
  }
  return facts;
}

/**
 * Stage rules (highest match wins):
 *
 *   payout-ready  identity approved AND the account is live
 *   funded        a challenge was funded for this trader (prop-admin action,
 *                 arrives through the shared demo log)
 *   provisioned   provisioning started (started = underway, activated = live)
 *   verifying     identity in flight — submitted, in review, rejected or
 *                 approved-but-not-yet-provisioned
 *   purchased     order confirmed, no KYC handed in yet
 *   browsing      nothing has happened yet
 */
export function deriveTraderStage(log: LifecycleEvent[]): TraderStage {
  const f = stageFactsFrom(log);
  if (f.kycApproved && (f.provisioned || f.provisioningUnderway)) return "payout-ready";
  if (f.funded) return "funded";
  if (f.provisioningFailed) return "provisioning-failed";
  if (f.provisioned || f.provisioningUnderway) return "provisioned";
  if (f.kycSubmitted) return "verifying";
  if (f.purchased) return "purchased";
  return "browsing";
}

function latestAt(log: LifecycleEvent[]): string | null {
  return log.length ? log[log.length - 1].at : null;
}

/** Non-reactive read (dashboards, tests). */
export function readTraderStageState(): TraderStageState {
  const log = readLifecycleLog();
  return {
    stage: deriveTraderStage(log),
    facts: stageFactsFrom(log),
    since: latestAt(log),
  };
}

/** Reactive read — re-derives on every lifecycle event. */
export function useTraderStage(): TraderStageState {
  const log = useLifecycleLog();
  return {
    stage: deriveTraderStage(log),
    facts: stageFactsFrom(log),
    since: latestAt(log),
  };
}

export function stageRank(stage: TraderStage): number {
  return STAGE_RANK[stage];
}

/* ------------------------------------------------------------------ */
/* Backfill — honor state that predates the event layer                */
/* ------------------------------------------------------------------ */

let backfilled = false;

/**
 * Reflect pre-existing journey / KYC / provisioning state into the log so
 * a trader returning from before R2-W3-01 doesn't read as "browsing" while
 * their checklist says Purchased. Idempotent: the emission keys match the
 * ones the live stores use, so nothing double-counts.
 */
export function backfillTraderLifecycle(): void {
  if (typeof window === "undefined" || backfilled) return;
  backfilled = true;

  const journey = readJourney();
  const handoff = readProvisioningHandoff();
  const provisioningId = handoff?.orderId ?? "backfill";

  if (journey.purchased || handoff) {
    emitLifecycle({
      entity: { kind: "purchase", id: provisioningId },
      name: "purchase.completed",
      actor: "trader",
      key: provisioningId,
      payload: { orderId: handoff?.orderId ?? null, backfilled: true },
      at: handoff?.purchasedAt,
    });
  }

  // Running the draft through its resolver also advances/ emits any review
  // transition that is already due (same path the wizard uses).
  const draft = readVerificationDraft();
  if (draft.reviewStatus === "approved") {
    emitLifecycle({
      entity: { kind: "kyc", id: "self" },
      name: "kyc.approved",
      actor: "trader",
      key: `${draft.attempts}:approved`,
      payload: { status: "approved", attempts: draft.attempts, backfilled: true },
      at: draft.submittedAt,
    });
  } else if (draft.reviewStatus === "rejected") {
    emitLifecycle({
      entity: { kind: "kyc", id: "self" },
      name: "kyc.rejected",
      actor: "trader",
      key: `${draft.attempts}:rejected`,
      payload: { status: "rejected", attempts: draft.attempts, backfilled: true },
      at: draft.submittedAt,
    });
  } else if (draft.reviewStatus === "submitted" || draft.reviewStatus === "in-review") {
    emitLifecycle({
      entity: { kind: "kyc", id: "self" },
      name: draft.reviewStatus === "in-review" ? "kyc.reviewing" : "kyc.submitted",
      actor: "trader",
      key: `${draft.attempts}:${draft.reviewStatus}`,
      payload: { status: draft.reviewStatus, attempts: draft.attempts, backfilled: true },
      at: draft.submittedAt,
    });
  }

  if (journey.provisioned) {
    emitLifecycle({
      entity: { kind: "provisioning", id: provisioningId },
      name: "provisioning.activated",
      actor: "trader",
      key: `activated:${provisioningId}`,
      payload: { backfilled: true },
    });
  }
}

// Run once when the module loads (client only) — every consumer of
// useTraderStage() therefore reads a log that matches stored state.
backfillTraderLifecycle();

/* ------------------------------------------------------------------ */
/* Banner copy — one place, driven by the same facts                   */
/* ------------------------------------------------------------------ */

export interface StageMeta {
  label: string;
  icon: string;
  title: string;
  message: string;
  tone: "primary" | "tertiary" | "secondary" | "success" | "error";
  cta: { label: string; href: string };
  /** 0-100, for the journey/progress surfaces. */
  progress: number;
}

export function stageMeta(state: TraderStageState): StageMeta {
  const { stage, facts } = state;
  switch (stage) {
    case "browsing":
      return {
        label: "Browsing",
        icon: "👋",
        title: "Pick a challenge to get started",
        message: "Buy a challenge and your journey — KYC, provisioning, payouts — unlocks here.",
        tone: "tertiary",
        cta: { label: "Browse challenges", href: "/marketplace" },
        progress: 0,
      };
    case "purchased":
      return {
        label: "Purchased",
        icon: "🛒",
        title: "Challenge purchased",
        message: "Verify your identity to unlock account provisioning.",
        tone: "primary",
        cta: { label: "Start verification", href: "/verification" },
        progress: 20,
      };
    case "verifying":
      return facts.kycApproved
        ? {
            label: "Verifying",
            icon: "🪪",
            title: "Identity approved",
            message: "Your documents cleared review — open provisioning to activate the account.",
            tone: "success",
            cta: { label: "View provisioning", href: "/account-provisioning" },
            progress: 40,
          }
        : {
            label: "Verifying",
            icon: "🪪",
            title: "Verification in progress",
            message: "We're reviewing your documents. Payouts unlock once identity is approved.",
            tone: "tertiary",
            cta: { label: "Check status", href: "/verification" },
            progress: 40,
          };
    case "provisioning-failed":
      return {
        label: "Provisioning failed",
        icon: "⚠️",
        title: "Account provisioning failed",
        message: facts.provisioningFailedReason
          ? `Provisioning failed: ${facts.provisioningFailedReason}. Contact support or retry.`
          : "Provisioning failed. Contact support or retry.",
        tone: "error",
        cta: { label: "Contact support", href: "/support" },
        progress: 0,
      };
    case "provisioned":
      return {
        label: "Provisioned",
        icon: "⚙️",
        title: facts.provisioned ? "Account live" : "Account being provisioned",
        message: facts.provisioned
          ? "Credentials delivered — trade within the rules to reach the payout stage."
          : "Your trading account is being created; credentials arrive when it completes.",
        tone: "secondary",
        cta: { label: "View provisioning", href: "/account-provisioning" },
        progress: 65,
      };
    case "funded":
      return {
        label: "Funded",
        icon: "🏆",
        title: "Funded account",
        message: "A challenge payout was funded for you — keep trading to reach payout-ready.",
        tone: "success",
        cta: { label: "Open trading", href: "/trading-positions" },
        progress: 85,
      };
    case "payout-ready":
      return {
        label: "Payout ready",
        icon: "💸",
        title: "You're eligible for a payout",
        message: "Identity approved and account live — request your withdrawal whenever you're ready.",
        tone: "success",
        cta: { label: "Request payout", href: "/payout-request" },
        progress: 100,
      };
    default:
      return {
        label: "Unknown",
        icon: "❓",
        title: "Stage unknown",
        message: "Could not determine account stage.",
        tone: "tertiary",
        cta: { label: "View dashboard", href: "/dashboard" },
        progress: 0,
      };
  }
}

/* ------------------------------------------------------------------ */
/* Simulator writes (dev tool — gated by lifecycle.simulator)          */
/* ------------------------------------------------------------------ */

/**
 * Move the trader to `stage` by emitting the events that reach it. Used by
 * `/state-adaptive`; the events are ordinary log entries, so every real
 * surface reflects the change immediately (and after reload).
 */
export function setTraderStage(stage: TraderStage): void {
  const rank = STAGE_RANK[stage];
  const id = "sim";

  // Moving backwards means restarting the log: stage facts are monotonic
  // (an approval can't be un-had), so a dev "set stage" below the current
  // one clears the shared demo log first, then emits the prerequisites.
  if (rank < STAGE_RANK[deriveTraderStage(readLifecycleLog())]) {
    clearLifecycleLog();
  }

  if (rank >= STAGE_RANK.purchased) {
    emitLifecycle({
      entity: { kind: "purchase", id },
      name: "purchase.completed",
      actor: "trader",
      key: id,
      payload: { source: "lifecycle.simulator" },
    });
  }
  if (rank >= STAGE_RANK.verifying) {
    emitLifecycle({
      entity: { kind: "kyc", id: "self" },
      name: "kyc.submitted",
      actor: "trader",
      key: `sim:submitted`,
      payload: { source: "lifecycle.simulator" },
    });
  }
  if (rank >= STAGE_RANK.provisioned) {
    emitLifecycle({
      entity: { kind: "provisioning", id },
      name: "provisioning.started",
      actor: "trader",
      key: `started:${id}`,
      payload: { source: "lifecycle.simulator" },
    });
  }
  if (rank >= STAGE_RANK.funded) {
    emitLifecycle({
      entity: { kind: "challenge", id },
      name: "challenge.funded",
      actor: "trader",
      key: `funded:${id}`,
      payload: { source: "lifecycle.simulator" },
    });
  }
  if (rank >= STAGE_RANK["payout-ready"]) {
    emitLifecycle({
      entity: { kind: "kyc", id: "self" },
      name: "kyc.approved",
      actor: "trader",
      key: `sim:approved`,
      payload: { source: "lifecycle.simulator" },
    });
    emitLifecycle({
      entity: { kind: "provisioning", id },
      name: "provisioning.activated",
      actor: "trader",
      key: `activated:${id}`,
      payload: { source: "lifecycle.simulator" },
    });
  }
}

/**
 * Dev reset — clears the SHARED demo log (all apps on this origin read it).
 * Deliberately loud: it also empties prop-admin's cross-app intake.
 */
export function resetLifecycleLog(): void {
  clearLifecycleLog();
}
