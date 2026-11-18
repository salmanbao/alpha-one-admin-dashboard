"use client";

/**
 * Rule versions — trader side (R9 W1 Part A3, UC-T2).
 *
 * prop-admin publishes versions through `lib/rules-versions-store.ts`,
 * which emits `rules.version-published` onto the shared lifecycle log (one
 * localStorage key under the demo gateway). This module is that event's
 * named trader consumer:
 *
 *   history       — every published version, defensively coerced (the
 *                   payload crosses an app boundary, so nothing is trusted)
 *   pinnedVersion — the version this account signed up under. Set once, on
 *                   first hydration, to the newest version known at the
 *                   time; publishing v4 afterwards appends to `history`
 *                   but never moves the pin — that is the grandfathering
 *                   promise the /rules page makes in copy.
 *
 * Persisted under `pfaas:trader:rules` (storage-census: prefix-wiped by
 * `deleteCurrentAccount()` like every other trader key).
 *
 * Hydration-safe: the initial state is the local seed on both server and
 * client, and localStorage is only read inside `useEffect` — reading it
 * during render would mismatch the server HTML.
 *
 * Consumers (named, rule 7): `/rules` "Rule version" section, the risk
 * dashboard version chip, `lib/compliance/compliance-store` (the version
 * the compliance engine enforces), and the inbox bridge notice.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useLifecycleLog, type LifecycleEvent } from "@pfaas/lifecycle";
import { setRuleVersionForAccount } from "@/lib/compliance/compliance-store";
import { terraAccounts } from "@/lib/fixtures/terra-fixtures";

const STORAGE_KEY = "pfaas:trader:rules";

export interface TraderRuleChange {
  field: string;
  from: string;
  to: string;
}

export interface TraderRuleLine {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  severity: string;
  enabled: boolean;
}

export interface TraderRuleVersion {
  id: string;
  version: number;
  programScope: string[];
  effectiveAt: string;
  notes: string;
  publishedBy: string;
  changes: TraderRuleChange[];
  rules: TraderRuleLine[];
}

export interface TraderRulesState {
  /** Publication number the account is pinned to ("Rules v3"). */
  pinnedVersion: number;
  pinnedVersionId: string;
  pinnedAt: string;
  /** Newest first. */
  history: TraderRuleVersion[];
}

/* ------------------------------------------------------------------ */
/* Seed — mirrors the prop-admin v1 baseline so /rules is never empty  */
/* ------------------------------------------------------------------ */

const SEED_RULES: TraderRuleLine[] = [
  { id: "rule-daily-loss-warn", name: "Daily loss early warning", metric: "daily-loss", operator: ">=", threshold: 80, severity: "warn", enabled: true },
  { id: "rule-total-dd-soft", name: "Max drawdown soft limit", metric: "total-drawdown", operator: ">=", threshold: 90, severity: "soft-breach", enabled: true },
  { id: "rule-total-dd-hard", name: "Max drawdown hard stop", metric: "total-drawdown", operator: ">=", threshold: 100, severity: "hard-breach", enabled: true },
];

const SEED_VERSION: TraderRuleVersion = {
  id: "rules-v1",
  version: 1,
  programScope: ["*"],
  effectiveAt: "2026-01-01T00:00:00.000Z",
  notes: "(Demo) — baseline rule set every demo account starts on.",
  publishedBy: "Risk Operations",
  changes: [],
  rules: SEED_RULES,
};

function seedState(): TraderRulesState {
  return {
    pinnedVersion: SEED_VERSION.version,
    pinnedVersionId: SEED_VERSION.id,
    pinnedAt: SEED_VERSION.effectiveAt,
    history: [SEED_VERSION],
  };
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Snapshot for the client — stored state, or the seed on first run. */
function getSnapshot(): string {
  return JSON.stringify(readStored() ?? seedState());
}

/** Snapshot for SSR — the seed, so hydration matches the server HTML. */
function getServerSnapshot(): string {
  return JSON.stringify(seedState());
}

function readStored(): TraderRulesState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TraderRulesState>;
    if (
      typeof parsed?.pinnedVersion !== "number" ||
      typeof parsed?.pinnedVersionId !== "string" ||
      !Array.isArray(parsed?.history)
    ) {
      return null;
    }
    return {
      pinnedVersion: parsed.pinnedVersion,
      pinnedVersionId: parsed.pinnedVersionId,
      pinnedAt: typeof parsed.pinnedAt === "string" ? parsed.pinnedAt : new Date().toISOString(),
      history: parsed.history as TraderRuleVersion[],
    };
  } catch {
    return null;
  }
}

function writeStored(state: TraderRulesState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    listeners.forEach((l) => l());
  } catch {
    /* storage full / private mode — best-effort */
  }
}

/* ------------------------------------------------------------------ */
/* Projection (shared log → history)                                   */
/* ------------------------------------------------------------------ */

type Raw = Record<string, unknown>;

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function coerceChange(raw: unknown): TraderRuleChange | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Raw;
  if (typeof c.field !== "string" || !c.field) return null;
  return { field: c.field, from: str(c.from, ""), to: str(c.to, "") };
}

/** Validate one `rules.version-published` payload into the trader shape. */
function coerceVersion(e: LifecycleEvent): TraderRuleVersion | null {
  const p = (e.payload ?? {}) as Raw;
  const version = num(p.version, 0);
  const id = str(p.versionId, e.entity?.id ?? "");
  if (version < 1 || !id) return null;
  const scope = Array.isArray(p.programScope)
    ? (p.programScope as unknown[]).filter((s): s is string => typeof s === "string" && !!s)
    : ["*"];
  const rules = Array.isArray(p.rules)
    ? (p.rules as unknown[]).flatMap((r) => {
        if (!r || typeof r !== "object") return [];
        const o = r as Raw;
        const ruleId = str(o.id, "");
        if (!ruleId) return [];
        return [
          {
            id: ruleId,
            name: str(o.name, ruleId),
            metric: str(o.metric, "—"),
            operator: str(o.operator, "—"),
            threshold: num(o.threshold, 0),
            severity: str(o.severity, "warn"),
            enabled: o.enabled !== false,
          },
        ];
      })
    : [];
  const changes = Array.isArray(p.changes)
    ? (p.changes as unknown[]).map(coerceChange).filter((c): c is TraderRuleChange => c !== null)
    : [];
  return {
    id,
    version,
    programScope: scope.length ? scope : ["*"],
    effectiveAt: str(p.effectiveAt, e.at),
    notes: str(p.notes, ""),
    publishedBy: str(p.publishedBy, "Risk Operations"),
    changes,
    rules,
  };
}

/**
 * Operator events → version history. Takes the log as an argument so the
 * reactive hook derives from the `useLifecycleLog` snapshot (hydration-safe:
 * the server snapshot is `[]`, so reading localStorage here would mismatch).
 */
export function projectRuleVersions(log: LifecycleEvent[]): TraderRuleVersion[] {
  const fromLog = log
    .filter((e) => e.actor === "prop-admin" && e.entity?.kind === "rules" && e.name === "rules.version-published")
    .map(coerceVersion)
    .filter((v): v is TraderRuleVersion => v !== null);

  const byId = new Map<string, TraderRuleVersion>([[SEED_VERSION.id, SEED_VERSION]]);
  // Ascending so a re-published id can never overwrite a newer projection.
  for (const v of [...fromLog].sort((a, b) => a.version - b.version)) byId.set(v.id, v);
  return [...byId.values()].sort((a, b) => b.version - a.version);
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function readRulesState(): TraderRulesState {
  const stored = readStored();
  if (stored) return stored;
  return seedState();
}

export function pinnedVersionLabel(state: TraderRulesState): string {
  return `Rules v${state.pinnedVersion}`;
}

/**
 * Display label for a stored `ruleVersionId` ("rules-v3-abc" → "Rules v3").
 * Ids are minted by the prop-admin publish action; unknown shapes fall back
 * to the raw id rather than inventing a number.
 */
export function versionLabelFromId(id?: string): string | null {
  if (!id) return null;
  const m = /^rules-v(\d+)/.exec(id);
  return m ? `Rules v${m[1]}` : id;
}

export function latestVersion(state: TraderRulesState): TraderRuleVersion | null {
  return state.history[0] ?? null;
}

/** Versions published after the account's pin, newest first. */
export function newerVersions(state: TraderRulesState): TraderRuleVersion[] {
  return state.history.filter((v) => v.version > state.pinnedVersion);
}

/* ------------------------------------------------------------------ */
/* React                                                               */
/* ------------------------------------------------------------------ */

/**
 * Reactive rules state: pin + version history.
 *
 * Derived during render from two reactive sources (the
 * competitions-catalog / payout-requests pattern — no setState in an
 * effect):
 *   • `useLifecycleLog()`  → version history (operator publishes)
 *   • `useSyncExternalStore` → the stored pin; `getServerSnapshot` is the
 *     seed so the hydration render matches the server HTML.
 *
 * The effect below only syncs EXTERNAL systems (localStorage + the
 * compliance config) — it never sets React state.
 */
export function useRulesStore(): TraderRulesState {
  const events = useLifecycleLog();
  const history = useMemo(() => projectRuleVersions(events), [events]);
  const storedJson = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const stored = useMemo(() => JSON.parse(storedJson) as TraderRulesState, [storedJson]);

  const state = useMemo(() => {
    const latest = history[0] ?? SEED_VERSION;
    const valid =
      typeof stored?.pinnedVersion === "number" &&
      typeof stored?.pinnedVersionId === "string" &&
      history.some((v) => v.id === stored.pinnedVersionId);
    const pinned = valid
      ? stored
      : {
          // First sight = signup: pin to the newest version known now.
          // (pinnedAt uses the version's effective time — deterministic,
          // so the render is pure; repinAccount stamps real times.)
          pinnedVersion: latest.version,
          pinnedVersionId: latest.id,
          pinnedAt: latest.effectiveAt,
          history,
        };
    return { ...pinned, history };
  }, [history, stored]);

  // External-system sync: persist the pin on first sight (and keep the
  // stored history current), then record which version the compliance
  // engine enforces (R9 W1). Idempotent — safe to re-run.
  useEffect(() => {
    const current = readStored();
    if (!current || JSON.stringify(current) !== JSON.stringify(state)) writeStored(state);
    for (const acc of terraAccounts) setRuleVersionForAccount(acc.id, state.pinnedVersionId);
  }, [state]);

  return state;
}
