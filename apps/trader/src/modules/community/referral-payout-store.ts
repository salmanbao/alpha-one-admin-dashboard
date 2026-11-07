/**
 * N19 — Referral Reward Payout store (trader, dummy data).
 *
 * Shared with the R2-14 rewards catalog header (pending referral payouts)
 * and the N19 payout tracker: lifecycle timeline, fraud-hold flags from
 * risk signals, and cohort breakdown.
 */

export type RewardStage = "earned" | "pending_kyc" | "approved" | "paid";

export interface TimelineEvent {
  stage: RewardStage;
  at: string;
  note: string;
}

export interface ReferralReward {
  id: string;
  friend: string;
  cohort: string;
  amount: number;
  currency: "USD";
  stage: RewardStage;
  conditions: { label: string; done: boolean }[];
  payoutId?: string;
  fraudHold?: { reason: string; riskScore: number };
  timeline: TimelineEvent[];
}

export interface Cohort {
  id: string;
  label: string;
  referred: number;
  kycPassed: number;
  funded: number;
  paid: number;
  amountPaid: number;
  fraudHeld: number;
}

const day = 86_400_000;
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * day).toISOString();

const STAGES: RewardStage[] = ["earned", "pending_kyc", "approved", "paid"];

function timelineFor(stage: RewardStage, daysAgo: number, extra?: Partial<Record<RewardStage, string>>): TimelineEvent[] {
  const idx = STAGES.indexOf(stage);
  return STAGES.slice(0, idx + 1).map((s, i) => ({
    stage: s,
    at: at(daysAgo - (idx - i) * 3),
    note: extra?.[s] ?? defaultNote(s),
  }));
}

function defaultNote(s: RewardStage): string {
  switch (s) {
    case "earned":
      return "Referee signed up with your link";
    case "pending_kyc":
      return "Waiting on referee KYC verification";
    case "approved":
      return "Conditions met; reward approved for payout";
    case "paid":
      return "Paid out through the payouts rail (compliance applied)";
  }
}

const REWARDS: ReferralReward[] = [
  {
    id: "rw1",
    friend: "an***@mail.com",
    cohort: "2026-10",
    amount: 50,
    currency: "USD",
    stage: "paid",
    conditions: [
      { label: "KYC passed", done: true },
      { label: "Traded 1 lot", done: true },
      { label: "Funded account", done: true },
    ],
    payoutId: "po-8821",
    timeline: timelineFor("paid", 18),
  },
  {
    id: "rw2",
    friend: "rk***@proton.me",
    cohort: "2026-11",
    amount: 50,
    currency: "USD",
    stage: "approved",
    conditions: [
      { label: "KYC passed", done: true },
      { label: "Traded 1 lot", done: true },
      { label: "Funded account", done: true },
    ],
    timeline: timelineFor("approved", 6),
  },
  {
    id: "rw3",
    friend: "ps***@gmail.com",
    cohort: "2026-11",
    amount: 50,
    currency: "USD",
    stage: "pending_kyc",
    conditions: [
      { label: "KYC passed", done: false },
      { label: "Traded 1 lot", done: false },
      { label: "Funded account", done: true },
    ],
    timeline: timelineFor("pending_kyc", 4),
  },
  {
    id: "rw4",
    friend: "dv***@outlook.com",
    cohort: "2026-11",
    amount: 50,
    currency: "USD",
    stage: "earned",
    conditions: [
      { label: "Signed up", done: true },
      { label: "KYC passed", done: false },
      { label: "Funded account", done: false },
    ],
    timeline: timelineFor("earned", 1),
  },
  {
    id: "rw5",
    friend: "qk***@fastmail.com",
    cohort: "2026-10",
    amount: 75,
    currency: "USD",
    stage: "approved",
    conditions: [
      { label: "KYC passed", done: true },
      { label: "Traded 1 lot", done: true },
      { label: "Funded account", done: true },
    ],
    fraudHold: { reason: "Velocity + device fingerprint match with a flagged account (risk score 0.81)", riskScore: 0.81 },
    timeline: timelineFor("approved", 9, {
      approved: "Held pending risk review — manual release required",
      pending_kyc: "KYC verified (2 checks)",
    }),
  },
  {
    id: "rw6",
    friend: "mb***@hey.com",
    cohort: "2026-09",
    amount: 50,
    currency: "USD",
    stage: "paid",
    conditions: [
      { label: "KYC passed", done: true },
      { label: "Traded 1 lot", done: true },
      { label: "Funded account", done: true },
    ],
    payoutId: "po-8640",
    timeline: timelineFor("paid", 46),
  },
];

const COHORTS: Cohort[] = [
  { id: "2026-09", label: "Sep 2026", referred: 6, kycPassed: 5, funded: 4, paid: 3, amountPaid: 150, fraudHeld: 0 },
  { id: "2026-10", label: "Oct 2026", referred: 11, kycPassed: 8, funded: 6, paid: 4, amountPaid: 200, fraudHeld: 1 },
  { id: "2026-11", label: "Nov 2026", referred: 9, kycPassed: 5, funded: 4, paid: 0, amountPaid: 0, fraudHeld: 0 },
];

export function listReferralRewards(): ReferralReward[] {
  return REWARDS;
}

export function listCohorts(): Cohort[] {
  return COHORTS;
}

/** R2-14 header: rewards that are approved/earned but not paid out yet. */
export function pendingPayoutSummary(): { count: number; amount: number; fraudHeld: number } {
  const pending = REWARDS.filter((r) => r.stage !== "paid");
  return {
    count: pending.length,
    amount: pending.reduce((s, r) => s + r.amount, 0),
    fraudHeld: pending.filter((r) => r.fraudHold).length,
  };
}

export const stageTone = (s: RewardStage): "success" | "warning" | "info" | "muted" =>
  s === "paid" ? "success" : s === "approved" ? "info" : s === "pending_kyc" ? "warning" : "muted";

export const STAGE_ORDER = STAGES;
