"use client";

/**
 * Competitions operator store — R7 I3 (rule R5: one object, one write path).
 *
 * The competitions screen used to be `useState` + toast: an operator
 * could "create" a competition and it died with the tab, and the trader
 * hub never saw it. Every operator action now writes through this
 * module, persisted under the `pfaas:demo:` prefix like every other
 * decision store:
 *
 *   saveOperatorCompetition       → create/update CRUD
 *   close/reopenRegistration      → registration window flips
 *   startCompetition              → upcoming → active
 *   toggleCompetitionPause        → scoring frozen / live
 *   endCompetitionEarly           → finalize from standings
 *   announceCompetitionWinners    → results declared (podium)
 *   distributeCompetitionPrizes   → payout record on the winners
 *   decideCompetitionEnrollment   → approve / reject an entrant
 *   enrollCompetitionTrader       → direct roster add
 *
 * Every action writes `recordAudit` AND emits a lifecycle event whose
 * named consumers are:
 *   - trader `lib/competitions-catalog.ts` — projects created/updated/
 *     finished events into the trader competition catalog (overrides the
 *     fixture with the same id), so an operator create shows up in the
 *     trader hub and an announce shows up in the winners gallery;
 *   - trader `lib/inbox/competition-notices.ts` — inbox messages
 *     ("Registration open: …" / "Results declared: …");
 *   - prop-admin `lib/platform/cross-app-intake.ts` — reads the trader's
 *     competition.joined events back into the participant list below.
 *
 * The projection (`projectToTrader`) is the trader-side shape of a
 * competition, derived from this store's operator model. It is defined
 * here (not imported from the trader app) because the two apps are
 * separate bundles — the payload structurally mirrors the trader's
 * `Competition` fixture shape so the trader catalog can validate it
 * defensively without a cross-app import.
 */

import { useSyncExternalStore } from "react";
import { emitLifecycle, type LifecycleEventName } from "@pfaas/lifecycle";
import { formatCurrencyValue } from "@pfaas/platform-core";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { demoCompetitionsOpsSchema } from "@/lib/platform/validation";
import { recordAudit } from "@/lib/audit";

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

export interface CompetitionEntrant {
  id: string;
  trader: string;
  status: "pending" | "approved" | "rejected";
}

/** Physical / cash / credit prize band as the operator configures it. */
export interface OperatorPrizeTier {
  /** Inclusive rank range — 1..1 for a single place, 4..10 for a band. */
  rankFrom: number;
  rankTo: number;
  kind: "cash" | "funded-account" | "physical" | "promo-credit";
  /** Display label — "iPhone 17 Pro" | "$2,500 cash" | "$100K evaluation". */
  label: string;
  /** Display value in USD when the prize has one. */
  valueUsd?: number;
  /** Extra context — "Ships within 30 days of your claim". */
  detail?: string;
}

export interface Competition {
  id: string;
  name: string;
  /** One-line pitch shown on the trader catalog card. */
  tagline: string;
  status: "upcoming" | "active" | "completed";
  templateId: string;
  participants: number;
  /** "Capped at N" limit (undefined = uncapped). */
  participantCap?: number;
  prizePool: number;
  payoutPlaces: number;
  /** Payout split across the podium, in percent (must sum to 100). */
  split: { first: number; second: number; third: number };
  /** Operator-authored prize tiers; when absent the trader projection
   *  derives them from the pool/split/places. */
  prizeTiers?: OperatorPrizeTier[];
  /** ISO dates (yyyy-mm-dd) — editable in the editor dialog. */
  startDate: string;
  endDate: string;
  /** One rule per line. */
  rules: string[];
  registrationOpen: boolean;
  paused: boolean;
  winnersAnnounced: boolean;
  prizesDistributed: boolean;
  entrants: CompetitionEntrant[];
  leaderboard: { rank: number; trader: string; score: number; prizeAmount: number }[];
  winners: { place: string; trader: string; prizeAmount: number }[];
}

/* ------------------------------------------------------------------ */
/* Date helpers (house rule R9: daysAgo/daysFromNow only)              */
/* ------------------------------------------------------------------ */

const isoDay = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};
const daysAgo = (d: number) => isoDay(-d);
const daysFromNow = (d: number) => isoDay(d);

/* ------------------------------------------------------------------ */
/* Seeds (moved from competitions-page — helper-dated, R9)             */
/* ------------------------------------------------------------------ */

export const OPERATOR_COMPETITION_SEEDS: Competition[] = [
  {
    id: "COMP-001",
    name: "Alpha Trading Challenge Q3",
    tagline: "Highest profit % wins — trade any challenge account.",
    status: "active",
    templateId: "profit-sprint",
    participants: 142,
    prizePool: 25000,
    payoutPlaces: 10,
    split: { first: 50, second: 30, third: 20 },
    startDate: daysAgo(21),
    endDate: daysFromNow(7),
    rules: [
      "Trade any challenge account",
      "Highest profit % wins",
      "Minimum 10 trades required",
      "No copy trading between participants",
      "Max drawdown rules apply",
    ],
    registrationOpen: false,
    paused: false,
    winnersAnnounced: false,
    prizesDistributed: false,
    entrants: [
      { id: "e-1", trader: "Liam Smith", status: "approved" },
      { id: "e-2", trader: "Emma Wilson", status: "approved" },
      { id: "e-3", trader: "Noah Davis", status: "approved" },
      { id: "e-4", trader: "Olivia Brown", status: "pending" },
    ],
    leaderboard: [
      { rank: 1, trader: "Liam Smith", score: 18.5, prizeAmount: 12500 },
      { rank: 2, trader: "Emma Wilson", score: 16.2, prizeAmount: 7500 },
      { rank: 3, trader: "Noah Davis", score: 14.8, prizeAmount: 5000 },
      { rank: 4, trader: "Olivia Brown", score: 12.1, prizeAmount: 0 },
      { rank: 5, trader: "James Taylor", score: 11.3, prizeAmount: 0 },
    ],
    winners: [],
  },
  {
    id: "COMP-002",
    name: "Summer Sizzle Trading Cup",
    tagline: "Highest cumulative profit with a consistency gate.",
    status: "completed",
    templateId: "consistency-cup",
    participants: 89,
    prizePool: 10000,
    payoutPlaces: 5,
    split: { first: 50, second: 30, third: 20 },
    startDate: daysAgo(46),
    endDate: daysAgo(32),
    rules: ["Open to all funded traders", "Highest cumulative profit", "Minimum 20 trades"],
    registrationOpen: false,
    paused: false,
    winnersAnnounced: false,
    prizesDistributed: false,
    entrants: [
      { id: "e-5", trader: "Sophia Miller", status: "approved" },
      { id: "e-6", trader: "Mason Anderson", status: "approved" },
      { id: "e-7", trader: "Ava Thomas", status: "approved" },
    ],
    leaderboard: [],
    winners: [
      { place: "1st", trader: "Sophia Miller", prizeAmount: 5000 },
      { place: "2nd", trader: "Mason Anderson", prizeAmount: 3000 },
      { place: "3rd", trader: "Ava Thomas", prizeAmount: 2000 },
    ],
  },
  {
    id: "COMP-003",
    name: "Q4 Funded Trader Showdown",
    tagline: "Risk-adjusted returns over a month of steady trading.",
    status: "upcoming",
    templateId: "consistency-cup",
    participants: 0,
    prizePool: 50000,
    payoutPlaces: 20,
    split: { first: 45, second: 30, third: 25 },
    startDate: daysFromNow(4),
    endDate: daysFromNow(34),
    rules: [
      "Open to all active traders",
      "Highest risk-adjusted return (Sharpe)",
      "Minimum 30 trades",
      "Max 2 accounts per trader",
    ],
    registrationOpen: true,
    paused: false,
    winnersAnnounced: false,
    prizesDistributed: false,
    entrants: [
      { id: "e-8", trader: "James Taylor", status: "pending" },
      { id: "e-9", trader: "Mia Rodriguez", status: "pending" },
    ],
    leaderboard: [],
    winners: [],
  },
];

/* ------------------------------------------------------------------ */
/* Trader projection                                                   */
/* ------------------------------------------------------------------ */

/** Podium row published on `competition.finished` (trader gallery shape). */
export interface CompetitionPodiumEntry {
  rank: number;
  trader: string;
  prize: string;
  prizeAmount: number;
}

/**
 * Trader-side view of an operator competition. Structurally mirrors the
 * trader app's `Competition` fixture shape (`tagline`, `startsAt`,
 * `entryRequirement`, `prizeHeadline`, `prizes`, `rules`, `theme`, `faq`)
 * so `apps/trader/src/lib/competitions-catalog.ts` can validate it
 * defensively without importing across apps.
 */
export interface ProjectedTraderCompetition {
  id: string;
  name: string;
  tagline: string;
  status: "active" | "upcoming" | "ended";
  startsAt: string;
  endsAt: string;
  registrationClosesAt?: string;
  participantCap?: number;
  participants: number;
  entryRequirement: { label: string; accountTypes: string[]; requiresKyc: boolean };
  prizeHeadline: string;
  prizes: OperatorPrizeTier[];
  rules: {
    metric: "gain-percent" | "absolute-profit" | "risk-adjusted";
    minTrades: number;
    maxDailyDrawdownPct?: number;
    consistencyRule?: string;
  };
  theme: "aurora" | "ember" | "abyss";
  faq: { q: string; a: string }[];
}

/**
 * Default prize tiers from the pool + podium split: top 3 cash, then a
 * promo-credit band for the remaining paid places. Used whenever the
 * operator hasn't authored explicit tiers.
 */
export function derivePrizeTiers(c: {
  prizePool: number;
  split: { first: number; second: number; third: number };
  payoutPlaces: number;
}): OperatorPrizeTier[] {
  const at = (pct: number) => Math.round((c.prizePool * pct) / 100);
  const tiers: OperatorPrizeTier[] = [
    {
      rankFrom: 1,
      rankTo: 1,
      kind: "cash",
      label: `${formatCurrencyValue(at(c.split.first), "USD")} cash`,
      valueUsd: at(c.split.first),
      detail: "Paid to your Promo Wallet",
    },
    {
      rankFrom: 2,
      rankTo: 2,
      kind: "cash",
      label: `${formatCurrencyValue(at(c.split.second), "USD")} cash`,
      valueUsd: at(c.split.second),
      detail: "Paid to your Promo Wallet",
    },
    {
      rankFrom: 3,
      rankTo: 3,
      kind: "cash",
      label: `${formatCurrencyValue(at(c.split.third), "USD")} cash`,
      valueUsd: at(c.split.third),
      detail: "Paid to your Promo Wallet",
    },
  ];
  if (c.payoutPlaces > 3) {
    tiers.push({
      rankFrom: 4,
      rankTo: c.payoutPlaces,
      kind: "promo-credit",
      label: `Top ${c.payoutPlaces} finisher credit`,
      detail: "Each finisher in the band",
    });
  }
  return tiers;
}

/** Rule strings → the trader's structured competition rules. */
function projectRules(c: Competition): ProjectedTraderCompetition["rules"] {
  const minTradesRule = c.rules.find((r) => /\d+\s+trades/i.test(r));
  const minTrades = minTradesRule ? Number(/\d+/.exec(minTradesRule)?.[0]) || 10 : 10;
  const ddRule = c.rules.find((r) =>
    /max(?:imum)? daily (?:loss|drawdown)[^0-9]*\d+/i.test(r),
  );
  const ddMatch = ddRule ? /max(?:imum)? daily (?:loss|drawdown)[^0-9]*(\d+)/i.exec(ddRule) : null;
  const consistencyRule = c.rules.find((r) => /consistency|single day/i.test(r));
  const rules: ProjectedTraderCompetition["rules"] = {
    metric:
      c.templateId === "consistency-cup" || c.templateId === "low-risk-league"
        ? "risk-adjusted"
        : "gain-percent",
    minTrades,
  };
  if (ddMatch) rules.maxDailyDrawdownPct = Number(ddMatch[0]);
  if (consistencyRule) rules.consistencyRule = consistencyRule;
  return rules;
}

const THEME_BY_TEMPLATE: Record<string, "aurora" | "ember" | "abyss"> = {
  "profit-sprint": "aurora",
  "consistency-cup": "ember",
  "low-risk-league": "abyss",
};

/**
 * Project an operator competition into the trader catalog shape.
 * Status flips `completed → ended`, dates get explicit end-of-day
 * timestamps, and the FAQ/entry copy is derived honestly (labeled Demo)
 * from what the operator configured.
 */
export function projectToTrader(c: Competition): ProjectedTraderCompetition {
  const prizes = c.prizeTiers?.length ? c.prizeTiers : derivePrizeTiers(c);
  const registrationOpen = c.registrationOpen && c.status === "upcoming";
  const rules = projectRules(c);
  const pool = formatCurrencyValue(c.prizePool, "USD");
  const physical = prizes.find((t) => t.kind === "physical");

  const entryLabel =
    c.status === "completed"
      ? "Closed — results settled"
      : c.status === "active"
        ? "In progress — registration closed"
        : !registrationOpen
          ? "Closed — registration is shut"
          : c.participantCap
            ? `Free for funded traders — capped at ${c.participantCap.toLocaleString()}`
            : "Free for funded traders";

  const capNote = c.participantCap ? ` Limited to ${c.participantCap.toLocaleString()} participants.` : "";
  const metricBasis =
    rules.metric === "risk-adjusted"
      ? "Risk-adjusted return across the window."
      : rules.metric === "absolute-profit"
        ? "Absolute profit in USD across the window."
        : "Highest net gain (%) across the window.";
  const ddNote = rules.maxDailyDrawdownPct ? ` Daily drawdown capped at ${rules.maxDailyDrawdownPct}%.` : "";

  return {
    id: c.id,
    name: c.name,
    tagline: c.tagline,
    status: c.status === "completed" ? "ended" : c.status,
    startsAt: `${c.startDate}T00:00:00.000Z`,
    endsAt: `${c.endDate}T23:59:59.999Z`,
    // Open → the start day's end; closed/finished → yesterday, so the
    // trader's join flow refuses honestly instead of pretending.
    registrationClosesAt: registrationOpen
      ? `${c.startDate}T23:59:59.999Z`
      : `${daysAgo(1)}T23:59:59.999Z`,
    participants: c.participants,
    entryRequirement: {
      label: entryLabel,
      accountTypes: ["Funded", "Evaluation"],
      requiresKyc: true,
    },
    prizeHeadline: physical
      ? `${physical.label} + ${pool} pool`
      : `${pool} prize pool · Top ${c.payoutPlaces} paid`,
    prizes,
    rules,
    theme: THEME_BY_TEMPLATE[c.templateId] ?? "aurora",
    faq: [
      {
        q: "Who can enter?",
        a: `Funded and evaluation traders with an approved KYC profile. Entry is free — one account per trader.${capNote} (Demo)`,
      },
      {
        q: "How is rank decided?",
        a: `${metricBasis} Minimum ${rules.minTrades} closed trades to place.${ddNote} (Demo standings)`,
      },
      {
        q: "When are prizes paid?",
        a: "Within 5 business days of settlement — cash to your Promo Wallet, physical prizes ship after you claim them (Demo).",
      },
    ],
  };
}

/** Winners → the podium payload published on `competition.finished`. */
function podiumFromWinners(
  winners: Competition["winners"],
): CompetitionPodiumEntry[] {
  return winners.map((w) => ({
    rank: parseInt(w.place, 10) || 0,
    trader: w.trader,
    prize: formatCurrencyValue(w.prizeAmount, "USD"),
    prizeAmount: w.prizeAmount,
  }));
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

const SLOT = "competitions-ops";
const SERVER_SNAPSHOT = JSON.stringify(OPERATOR_COMPETITION_SEEDS);
const listeners = new Set<() => void>();

let state: Competition[] = (() => {
  const persisted = loadDemoState(SLOT, demoCompetitionsOpsSchema, OPERATOR_COMPETITION_SEEDS);
  return persisted as Competition[];
})();

/** Monotonic suffix so two actions in the same millisecond never dedupe. */
let keySeq = 0;
const uniqueKey = (id: string) => `${Date.now().toString(36)}-${++keySeq}`;

function commit(): void {
  listeners.forEach((l) => l());
  try {
    saveDemoState(SLOT, state);
  } catch {
    /* persistence is best-effort */
  }
}

function publish(
  c: Competition,
  change: string,
  name: LifecycleEventName,
  key: string,
  podium?: CompetitionPodiumEntry[],
): void {
  emitLifecycle({
    entity: { kind: "competition", id: c.id },
    name,
    actor: "prop-admin",
    key,
    payload: {
      competitionId: c.id,
      name: c.name,
      change,
      registrationOpen: c.registrationOpen,
      competition: projectToTrader(c),
      ...(podium ? { podium } : {}),
    },
  });
}

function replace(id: string, next: Competition): void {
  state = state.map((c) => (c.id === id ? next : c));
}

function get(id: string): Competition | undefined {
  return state.find((c) => c.id === id);
}

/* ------------------------------------------------------------------ */
/* Actions — every one: mutate → recordAudit → emit → commit           */
/* ------------------------------------------------------------------ */

/** Create or update a competition (editor dialog Save). */
export function saveOperatorCompetition(comp: Competition): void {
  const exists = state.some((c) => c.id === comp.id);
  state = exists ? state.map((c) => (c.id === comp.id ? comp : c)) : [...state, comp];
  recordAudit({
    action: exists ? "Updated competition" : "Created competition",
    entity: "competition",
    entityId: comp.id,
    summary: `${comp.name} — ${formatCurrencyValue(comp.prizePool, "USD")} pool, top ${comp.payoutPlaces} paid`,
    severity: "info",
  });
  publish(
    comp,
    exists ? "updated" : "created",
    exists ? "competition.updated" : "competition.created",
    exists ? `updated:${comp.id}:${uniqueKey(comp.id)}` : `created:${comp.id}`,
  );
  commit();
}

/** Close the registration window (upcoming competitions). */
export function closeCompetitionRegistration(id: string): void {
  const c = get(id);
  if (!c) return;
  const next = { ...c, registrationOpen: false };
  replace(id, next);
  recordAudit({
    action: "Closed competition registration",
    entity: "competition",
    entityId: id,
    summary: `${c.name} — no new entrants can join`,
    severity: "info",
  });
  publish(next, "registration-closed", "competition.updated", `updated:${id}:${uniqueKey(id)}`);
  commit();
}

/** Reopen the registration window (upcoming competitions). */
export function reopenCompetitionRegistration(id: string): void {
  const c = get(id);
  if (!c) return;
  const next = { ...c, registrationOpen: true };
  replace(id, next);
  recordAudit({
    action: "Reopened competition registration",
    entity: "competition",
    entityId: id,
    summary: `${c.name} — entrants can join again`,
    severity: "info",
  });
  publish(next, "registration-opened", "competition.updated", `updated:${id}:${uniqueKey(id)}`);
  commit();
}

/** Start an upcoming competition now (registration shuts). */
export function startCompetition(id: string): void {
  const c = get(id);
  if (!c) return;
  const next = { ...c, status: "active" as const, registrationOpen: false };
  replace(id, next);
  recordAudit({
    action: "Started competition",
    entity: "competition",
    entityId: id,
    summary: `${c.name} is live — leaderboard tracking`,
    severity: "info",
  });
  publish(next, "started", "competition.updated", `updated:${id}:${uniqueKey(id)}`);
  commit();
}

/** Freeze / unfreeze scoring on an active competition. */
export function toggleCompetitionPause(id: string): void {
  const c = get(id);
  if (!c) return;
  const pausing = !c.paused;
  const next = { ...c, paused: pausing };
  replace(id, next);
  recordAudit({
    action: pausing ? "Paused competition" : "Resumed competition",
    entity: "competition",
    entityId: id,
    summary: pausing ? `${c.name} — scoring frozen` : `${c.name} — scoring live again`,
    severity: "info",
  });
  publish(next, pausing ? "paused" : "resumed", "competition.updated", `updated:${id}:${uniqueKey(id)}`);
  commit();
}

/**
 * End early: finalize from current standings (podium = top 3 of the
 * leaderboard at the configured split) and publish `competition.finished`
 * — shared idempotency key with announce, so double-finalizing never
 * double-publishes to the trader gallery.
 */
export function endCompetitionEarly(id: string): void {
  const c = get(id);
  if (!c) return;
  const winners = c.leaderboard.slice(0, 3).map((e, i) => ({
    place: i === 0 ? "1st" : i === 1 ? "2nd" : "3rd",
    trader: e.trader,
    prizeAmount:
      Math.round(
        (c.prizePool *
          (i === 0 ? c.split.first : i === 1 ? c.split.second : c.split.third)) /
          100,
      ),
  }));
  const next = { ...c, status: "completed" as const, paused: false, winners };
  replace(id, next);
  recordAudit({
    action: "Ended competition early",
    entity: "competition",
    entityId: id,
    summary: winners.length
      ? `${c.name} — winners finalized from current standings`
      : `${c.name} ended with no qualified standings`,
    severity: "warning",
  });
  publish(next, "ended-early", "competition.finished", `finished:${id}`, podiumFromWinners(winners));
  commit();
}

/** Announce the results (declares the podium to the trader app). */
export function announceCompetitionWinners(id: string): void {
  const c = get(id);
  if (!c) return;
  const next = { ...c, winnersAnnounced: true };
  replace(id, next);
  recordAudit({
    action: "Announced competition winners",
    entity: "competition",
    entityId: id,
    summary: c.winners.length
      ? `${c.name} — ${c.winners.map((w) => `${w.place} ${w.trader}`).join(", ")}`
      : `${c.name} — no winners to announce`,
    severity: "info",
  });
  publish(
    next,
    "winners-announced",
    "competition.finished",
    `finished:${id}`,
    podiumFromWinners(c.winners),
  );
  commit();
}

/** Mark prizes paid out on the completed winners. */
export function distributeCompetitionPrizes(id: string): void {
  const c = get(id);
  if (!c) return;
  const next = { ...c, prizesDistributed: true };
  replace(id, next);
  const total = c.winners.reduce((s, w) => s + w.prizeAmount, 0);
  recordAudit({
    action: "Distributed competition prizes",
    entity: "competition",
    entityId: id,
    summary: `${formatCurrencyValue(total, "USD")} paid to ${c.winners.length} winner${c.winners.length === 1 ? "" : "s"} of ${c.name}`,
    severity: "info",
  });
  publish(next, "prizes-distributed", "competition.updated", `updated:${id}:${uniqueKey(id)}`);
  commit();
}

/** Approve / reject a pending entrant (enrollment dialog). */
export function decideCompetitionEnrollment(
  compId: string,
  entrantId: string,
  decision: "approved" | "rejected",
): void {
  const c = get(compId);
  if (!c) return;
  const entrant = c.entrants.find((e) => e.id === entrantId);
  if (!entrant) return;
  const next: Competition = {
    ...c,
    entrants: c.entrants.map((e) => (e.id === entrantId ? { ...e, status: decision } : e)),
    participants: decision === "approved" ? c.participants + 1 : c.participants,
  };
  replace(compId, next);
  recordAudit({
    action: decision === "approved" ? "Approved competition entrant" : "Rejected competition entrant",
    entity: "competition",
    entityId: compId,
    summary: `${entrant.trader} ${decision} for ${c.name}`,
    severity: "info",
  });
  publish(
    next,
    decision === "approved" ? "entrant-approved" : "entrant-rejected",
    "competition.updated",
    `updated:${compId}:${uniqueKey(compId)}`,
  );
  commit();
}

/** Enroll a trader directly onto the roster (enrollment dialog). */
export function enrollCompetitionTrader(compId: string, trader: string): void {
  const c = get(compId);
  if (!c) return;
  const next: Competition = {
    ...c,
    participants: c.participants + 1,
    entrants: [
      ...c.entrants,
      { id: `e-${uniqueKey(compId)}`, trader, status: "approved" as const },
    ],
  };
  replace(compId, next);
  recordAudit({
    action: "Enrolled trader in competition",
    entity: "competition",
    entityId: compId,
    summary: `${trader} enrolled in ${c.name}`,
    severity: "info",
  });
  publish(next, "trader-enrolled", "competition.updated", `updated:${compId}:${uniqueKey(compId)}`);
  commit();
}

/* ------------------------------------------------------------------ */
/* Reactive read                                                       */
/* ------------------------------------------------------------------ */

/** Full operator competition list — subscribes to the store. */
export function useOperatorCompetitions(): Competition[] {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => JSON.stringify(state),
    () => SERVER_SNAPSHOT,
  );
  return JSON.parse(raw) as Competition[];
}
