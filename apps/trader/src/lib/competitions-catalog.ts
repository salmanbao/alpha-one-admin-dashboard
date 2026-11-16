"use client";

/**
 * Competitions catalog — operator events → trader catalog (R7 I3).
 *
 * The hub used to render fixtures only, so a competition the operator
 * created in prop-admin could never appear here. Every operator action
 * in `prop-admin/src/lib/competitions-operator-store.ts` emits
 * `competition.created` / `competition.updated` / `competition.finished`
 * onto the shared lifecycle log (one localStorage key under the demo
 * gateway) — this module projects those events over the fixtures:
 *
 *   fixtures               — the seeded hub competitions (R6)
 *   + operator events      — latest event per competition id wins, so an
 *                            edited/finished competition replaces its
 *                            fixture row and a created one is appended
 *
 * Defensive by design: the payload crosses an app boundary, so
 * `coerceCompetition` validates every field the detail page renders
 * (faq, theme, prizes, rules, entryRequirement) instead of trusting the
 * shape — a malformed payload drops that row to its fixture, never a
 * crash. Reads derive from the log only — no extra storage key.
 *
 * Consumers (named, rule R6): competitions hub, competition detail,
 * winners gallery, competitions-store join/claim validation, and
 * competition-notices inbox messages.
 */

import { useMemo } from "react";
import { useLifecycleLog, readLifecycleLog, type LifecycleEvent } from "@pfaas/lifecycle";
import {
  competitions as fixtureCompetitions,
  competitionWinners as fixtureWinners,
  type Competition,
  type CompetitionRules,
  type PrizeTier,
} from "@/lib/fixtures/terra-fixtures";

/** Operator-side events this catalog projects. */
const OPERATOR_EVENTS = new Set<string>([
  "competition.created",
  "competition.updated",
  "competition.finished",
]);

/**
 * Filter the operator events out of a log. Takes the log as an argument
 * (not `readLifecycleLog()`) so the reactive hooks below derive from the
 * `useLifecycleLog` snapshot — during hydration that snapshot is the
 * server's `[]`, and reading localStorage directly here would render the
 * client tree differently from the server HTML (hydration mismatch).
 */
function operatorEvents(log: LifecycleEvent[]): LifecycleEvent[] {
  return log.filter(
    (e) =>
      e.actor === "prop-admin" &&
      e.entity.kind === "competition" &&
      OPERATOR_EVENTS.has(e.name),
  );
}

/* ------------------------------------------------------------------ */
/* Defensive coercion (cross-app payload)                              */
/* ------------------------------------------------------------------ */

type Raw = Record<string, unknown>;

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function coerceTier(raw: unknown): PrizeTier | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Raw;
  const kind = t.kind;
  if (
    kind !== "cash" &&
    kind !== "funded-account" &&
    kind !== "physical" &&
    kind !== "promo-credit"
  ) {
    return null;
  }
  if (typeof t.label !== "string" || !t.label.trim()) return null;
  if (typeof t.rankFrom !== "number" || typeof t.rankTo !== "number") return null;
  const tier: PrizeTier = { rankFrom: t.rankFrom, rankTo: t.rankTo, kind, label: t.label };
  if (typeof t.valueUsd === "number" && Number.isFinite(t.valueUsd)) tier.valueUsd = t.valueUsd;
  if (typeof t.detail === "string" && t.detail) tier.detail = t.detail;
  return tier;
}

function coerceRules(raw: unknown): CompetitionRules {
  const r = (raw && typeof raw === "object" ? raw : {}) as Raw;
  const metric =
    r.metric === "absolute-profit" || r.metric === "risk-adjusted" ? r.metric : "gain-percent";
  const rules: CompetitionRules = { metric, minTrades: num(r.minTrades, 10) };
  if (typeof r.maxDailyDrawdownPct === "number" && Number.isFinite(r.maxDailyDrawdownPct)) {
    rules.maxDailyDrawdownPct = r.maxDailyDrawdownPct;
  }
  if (typeof r.consistencyRule === "string" && r.consistencyRule) {
    rules.consistencyRule = r.consistencyRule;
  }
  return rules;
}

function coerceFaq(raw: unknown): { q: string; a: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((f) => {
    if (!f || typeof f !== "object") return [];
    const o = f as Raw;
    if (typeof o.q !== "string" || !o.q || typeof o.a !== "string" || !o.a) return [];
    return [{ q: o.q, a: o.a }];
  });
}

/** Validate one payload's `competition` object into the fixture shape. */
function coerceCompetition(raw: unknown): Competition | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Raw;
  if (typeof r.id !== "string" || !r.id) return null;
  if (typeof r.name !== "string" || !r.name) return null;
  const status = r.status;
  if (status !== "active" && status !== "upcoming" && status !== "ended") return null;

  const er = (r.entryRequirement && typeof r.entryRequirement === "object"
    ? r.entryRequirement
    : {}) as Raw;

  const out: Competition = {
    id: r.id,
    name: r.name,
    tagline: str(r.tagline, "Operator-published competition (Demo)"),
    status,
    startsAt: str(r.startsAt, new Date().toISOString()),
    endsAt: str(r.endsAt, new Date(Date.now() + 7 * 86_400_000).toISOString()),
    participants: num(r.participants, 0),
    entryRequirement: {
      label: str(er.label, status === "ended" ? "Closed" : "Free entry (Demo)"),
      accountTypes: Array.isArray(er.accountTypes)
        ? er.accountTypes.filter((x): x is string => typeof x === "string")
        : ["Funded", "Evaluation"],
      requiresKyc: er.requiresKyc !== false,
    },
    prizeHeadline: str(r.prizeHeadline, "Prize pool announced in the hub (Demo)"),
    prizes: Array.isArray(r.prizes)
      ? r.prizes.map(coerceTier).filter((t): t is PrizeTier => t !== null)
      : [],
    rules: coerceRules(r.rules),
    theme: r.theme === "ember" || r.theme === "abyss" ? r.theme : "aurora",
    faq: coerceFaq(r.faq),
  };
  if (typeof r.registrationClosesAt === "string") out.registrationClosesAt = r.registrationClosesAt;
  if (typeof r.participantCap === "number" && Number.isFinite(r.participantCap)) {
    out.participantCap = r.participantCap;
  }
  if (typeof r.placement === "number" && Number.isFinite(r.placement)) out.placement = r.placement;
  if (r.featured === true) out.featured = true;
  return out;
}

/* ------------------------------------------------------------------ */
/* Catalog reads                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fixture hub competitions with operator-published competitions merged
 * over them (latest event per id wins; new ids append).
 *
 * `log` is explicit so reactive hooks pass the `useLifecycleLog`
 * snapshot (server snapshot = `[]` at hydration); the no-arg form is
 * for non-React callers (store validation, effects).
 */
export function projectCatalogCompetitions(log: LifecycleEvent[]): Competition[] {
  const overrides = new Map<string, Competition>();
  for (const e of operatorEvents(log)) {
    const c = coerceCompetition(e.payload?.competition);
    if (c) overrides.set(c.id, c);
  }
  return fixtureCompetitions
    .filter((c) => !overrides.has(c.id))
    .concat(Array.from(overrides.values()));
}

/** Non-reactive read (event handlers, effects) — current persisted log. */
export function catalogCompetitions(): Competition[] {
  return projectCatalogCompetitions(readLifecycleLog());
}

/** Winners-gallery entry shape (mirrors `competitionWinners` fixtures). */
export interface CatalogWinnersEntry {
  competitionId: string;
  podium: { rank: number; trader: string; prize: string; me?: boolean }[];
}

function coercePodium(raw: unknown): CatalogWinnersEntry["podium"] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const podium = raw.flatMap((p) => {
    if (!p || typeof p !== "object") return [];
    const o = p as Raw;
    if (typeof o.rank !== "number" || !Number.isFinite(o.rank)) return [];
    if (typeof o.trader !== "string" || !o.trader) return [];
    const row: CatalogWinnersEntry["podium"][number] = {
      rank: o.rank,
      trader: o.trader,
      prize: str(o.prize, "Prize (Demo)"),
    };
    if (o.me === true) row.me = true;
    return [row];
  });
  return podium.length ? podium : null;
}

/** Fixture podiums + operator `competition.finished` podiums (deduped by id). */
export function projectCatalogWinners(log: LifecycleEvent[]): CatalogWinnersEntry[] {
  const byCompetition = new Map<string, CatalogWinnersEntry>();
  for (const e of operatorEvents(log)) {
    if (e.name !== "competition.finished") continue;
    const podium = coercePodium(e.payload?.podium);
    if (!podium) continue;
    const competitionId = String(e.payload?.competitionId ?? e.entity.id);
    byCompetition.set(competitionId, { competitionId, podium });
  }
  return fixtureWinners
    .filter((w) => !byCompetition.has(w.competitionId))
    .concat(Array.from(byCompetition.values()));
}

/** Non-reactive read (event handlers, effects) — current persisted log. */
export function catalogWinners(): CatalogWinnersEntry[] {
  return projectCatalogWinners(readLifecycleLog());
}

/* ------------------------------------------------------------------ */
/* Reactive reads                                                      */
/* ------------------------------------------------------------------ */

/** Catalog that re-derives whenever any lifecycle event lands. */
export function useCatalogCompetitions(): Competition[] {
  const log = useLifecycleLog();
  return useMemo(() => projectCatalogCompetitions(log), [log]);
}

/** Winners gallery fed by fixture podiums + operator result announcements. */
export function useCatalogWinners(): CatalogWinnersEntry[] {
  const log = useLifecycleLog();
  return useMemo(() => projectCatalogWinners(log), [log]);
}
