"use client";

/**
 * Rule versions — R9 W1 Part A (UC-O2 operator publish, UC-T2 trader
 * visibility, UC-O1 appeal evidence, UC-T3 breach replay).
 *
 * The industry's #1 trust gap: a firm edits a rule and the trader has no
 * proof of what the rules were on the day they signed up. This store makes
 * the rule set a versioned, append-only document:
 *
 *   publishRuleVersion() → freezes the current risk-rule set as a numbered
 *     version, records the field-level diff from the previous version,
 *     persists (`pfaas:demo:rules-versions`, R10), `recordAudit`s, and
 *     emits `rules.version-published`.
 *
 * Named consumers of `rules.version-published` (rule 7):
 *   - prop-admin `lib/risk-rules-store` — the evaluator resolves each
 *     account's pinned `ruleVersionId` before comparing thresholds, so a
 *     grandfathered account keeps evaluating against the version it signed
 *     up under (acceptance: force a breach on v3 and on v4, both cite their
 *     own version);
 *   - prop-admin `lib/rules-versions-store` (this file) — grandfathered
 *     account list on the Rule versions panel;
 *   - trader `lib/rules/rules-store` — version history + pinned badge on
 *     `/rules`;
 *   - trader `lib/inbox/inbox-lifecycle-bridge` — "Rules v4 published —
 *     here is what changed (Demo)".
 *
 * Pinning model: an account is pinned to the latest version *in scope for
 * its program* the first time the evaluator sees it, and never moves on its
 * own — publishing v4 leaves every existing account on v3 (grandfathered)
 * until an operator re-pins it. That is the whole point: rule changes are
 * prospective for new accounts, never retroactive for live ones.
 *
 * Every mutation persists + is audited (§5 rule 2); reads are zod-validated.
 */

import { useEffect, useState } from "react";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { emitLifecycle } from "@pfaas/lifecycle";
import type { RiskRule } from "@/lib/risk-rules-store";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** One field-level difference between two published versions. */
export interface RuleChange {
  field: string;
  from: string;
  to: string;
}

export interface RuleVersion {
  id: string;
  /** Monotonic publication number — "Rules v3" in trader-facing copy. */
  version: number;
  /** Phase-config (plan) ids this version governs; `["*"]` = every program. */
  programScope: string[];
  effectiveAt: string;
  changes: RuleChange[];
  notes: string;
  publishedBy: string;
  /**
   * Frozen rule set as published. The evaluator pins an account to a
   * version and compares against THIS snapshot, not the live rule list —
   * without it, "v3 vs v4" would be cosmetic.
   */
  rules: RiskRule[];
}

/** The account's rule-version pin record (the "ruleVersionId" on an account). */
export interface RuleVersionPin {
  accountId: string;
  login?: string;
  program?: string;
  ruleVersionId: string;
  pinnedAt: string;
  /** Set by an operator re-pin (appeal/grandfather management). */
  repinnedBy?: string;
}

export interface RulesVersionsState {
  versions: RuleVersion[];
  pins: Record<string, RuleVersionPin>;
}

export interface PublishRuleVersionInput {
  notes: string;
  programScope: string[];
  /** Frozen snapshot — supplied by the caller (the rule engine page). */
  rules: RiskRule[];
}

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const ruleChangeSchema = z.object({
  field: z.string().min(1),
  from: z.string(),
  to: z.string(),
});

/* Mirror RiskRule's unions exactly — if risk-rules-store adds a metric,
 * tsc fails here instead of silently widening the snapshot to `string`. */
const RISK_METRICS = ["daily-loss", "total-drawdown", "consistency", "weekend-hold", "news-trading"] as const;
const RISK_OPERATORS = [">=", "<=", ">", "<"] as const;
const RISK_SEVERITIES = ["warn", "soft-breach", "hard-breach"] as const;
const RISK_ACTIONS = ["notify-trader", "flag-account", "recommend-breach"] as const;

const riskRuleSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  metric: z.enum(RISK_METRICS),
  operator: z.enum(RISK_OPERATORS),
  threshold: z.number().finite(),
  severity: z.enum(RISK_SEVERITIES),
  action: z.enum(RISK_ACTIONS),
  enabled: z.boolean(),
  notes: z.string().optional(),
});

const ruleVersionSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  programScope: z.array(z.string().min(1)).min(1),
  effectiveAt: z.string().min(1),
  changes: z.array(ruleChangeSchema),
  notes: z.string(),
  publishedBy: z.string(),
  rules: z.array(riskRuleSnapshotSchema),
});

const pinSchema = z.object({
  accountId: z.string().min(1),
  login: z.string().optional(),
  program: z.string().optional(),
  ruleVersionId: z.string().min(1),
  pinnedAt: z.string().min(1),
  repinnedBy: z.string().optional(),
});

const stateSchema = z.object({
  versions: z.array(ruleVersionSchema),
  pins: z.record(z.string(), pinSchema),
});

const SLOT = "rules-versions";

/* ------------------------------------------------------------------ */
/* Seed — a v1 baseline so the panel and the trader badge are not empty */
/* ------------------------------------------------------------------ */

const SEED_RULES: RiskRule[] = [
  {
    id: "rule-daily-loss-warn",
    name: "Daily loss early warning",
    metric: "daily-loss",
    operator: ">=",
    threshold: 80,
    severity: "warn",
    action: "notify-trader",
    enabled: true,
    notes: "(Demo) — fires when a trader has used ≥80% of the daily loss limit.",
  },
  {
    id: "rule-total-dd-soft",
    name: "Max drawdown soft limit",
    metric: "total-drawdown",
    operator: ">=",
    threshold: 90,
    severity: "soft-breach",
    action: "flag-account",
    enabled: true,
  },
  {
    id: "rule-total-dd-hard",
    name: "Max drawdown hard stop",
    metric: "total-drawdown",
    operator: ">=",
    threshold: 100,
    severity: "hard-breach",
    action: "recommend-breach",
    enabled: true,
  },
];

const SEED_VERSION: RuleVersion = {
  id: "rules-v1",
  version: 1,
  programScope: ["*"],
  effectiveAt: "2026-01-01T00:00:00.000Z",
  changes: [],
  notes: "(Demo) — baseline rule set every demo account starts on.",
  publishedBy: "Risk Operations",
  rules: SEED_RULES,
};

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let state: RulesVersionsState = loadDemoState(SLOT, stateSchema, {
  versions: [SEED_VERSION],
  pins: {},
});
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

function persist(): void {
  saveDemoState(SLOT, state);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function getRuleVersions(): RuleVersion[] {
  return [...state.versions].sort((a, b) => b.version - a.version);
}

export function useRuleVersions(): RuleVersion[] {
  const [v, setV] = useState(() => getRuleVersions());
  useEffect(() => subscribe(() => setV(getRuleVersions())), []);
  return v;
}

export function getLatestRuleVersion(): RuleVersion | null {
  return state.versions.length ? getRuleVersions()[0] : null;
}

/** Latest version whose scope covers `program` (unknown program → any). */
export function latestVersionFor(program?: string): RuleVersion | null {
  const sorted = getRuleVersions();
  if (!sorted.length) return null;
  if (!program) return sorted[0];
  return sorted.find((v) => v.programScope.includes("*") || v.programScope.includes(program)) ?? sorted[0];
}

export function getRuleVersion(id: string): RuleVersion | undefined {
  return state.versions.find((v) => v.id === id);
}

export function getRuleVersionPins(): RuleVersionPin[] {
  return Object.values(state.pins);
}

export function pinFor(accountId: string): RuleVersionPin | undefined {
  return state.pins[accountId];
}

/**
 * Resolve the rule set an account must be evaluated against: its pinned
 * version when one exists, otherwise the latest version in scope (and pin
 * it — first sight is "account creation" for the evaluator).
 */
export function resolvePinnedRules(accountId: string, program?: string, login?: string): { rules: RiskRule[]; version: RuleVersion } | null {
  const existing = state.pins[accountId];
  if (existing) {
    const v = getRuleVersion(existing.ruleVersionId);
    if (v) return { rules: v.rules, version: v };
  }
  const latest = latestVersionFor(program);
  if (!latest) return null;
  state.pins[accountId] = {
    accountId,
    login,
    program,
    ruleVersionId: latest.id,
    pinnedAt: new Date().toISOString(),
  };
  persist();
  return { rules: latest.rules, version: latest };
}

/** Accounts still on an older version than the latest in their scope. */
export function grandfatheredAccounts(): RuleVersionPin[] {
  return getRuleVersionPins()
    .map((pin) => {
      const latest = latestVersionFor(pin.program);
      const pinned = getRuleVersion(pin.ruleVersionId);
      return { pin, latest, pinned };
    })
    .filter(({ latest, pinned }) => latest && pinned && pinned.version < latest.version)
    .map(({ pin }) => pin);
}

/* ------------------------------------------------------------------ */
/* Diff                                                                */
/* ------------------------------------------------------------------ */

const DIFF_FIELDS: (keyof RiskRule)[] = ["name", "metric", "operator", "threshold", "severity", "action", "enabled"];

function display(rule: RiskRule, field: keyof RiskRule): string {
  const v = rule[field];
  if (typeof v === "boolean") return v ? "on" : "off";
  return String(v ?? "");
}

/** Field-level diff between the previous published version and `next`. */
export function diffVersions(prev: RuleVersion | null | undefined, next: RiskRule[]): RuleChange[] {
  const changes: RuleChange[] = [];
  if (!prev) return changes;
  const before = new Map(prev.rules.map((r) => [r.id, r]));
  const after = new Map(next.map((r) => [r.id, r]));

  for (const [id, rule] of after) {
    const old = before.get(id);
    if (!old) {
      changes.push({ field: `rule · ${id}`, from: "(not present)", to: `${rule.name} added` });
      continue;
    }
    for (const f of DIFF_FIELDS) {
      const from = display(old, f);
      const to = display(rule, f);
      if (from !== to) changes.push({ field: `${rule.name} · ${f}`, from, to });
    }
  }
  for (const [id, rule] of before) {
    if (!after.has(id)) changes.push({ field: `rule · ${id}`, from: `${rule.name} removed`, to: "(not present)" });
  }
  return changes;
}

/* ------------------------------------------------------------------ */
/* Mutations (audited)                                                 */
/* ------------------------------------------------------------------ */

export function publishRuleVersion(input: PublishRuleVersionInput): RuleVersion {
  const sorted = getRuleVersions();
  const prev = sorted[0] ?? null;
  const version: RuleVersion = {
    id: `rules-v${(prev?.version ?? 0) + 1}-${Date.now().toString(36)}`,
    version: (prev?.version ?? 0) + 1,
    programScope: input.programScope.length ? input.programScope : ["*"],
    effectiveAt: new Date().toISOString(),
    changes: diffVersions(prev, input.rules),
    notes: input.notes.trim() || "(Demo) — no change notes supplied.",
    publishedBy: "Risk Operations",
    rules: input.rules.map((r) => ({ ...r })),
  };

  state.versions = [...state.versions, version];
  persist();
  notify();

  recordAudit({
    action: "Published rule version",
    entity: "rules",
    entityId: version.id,
    summary: `Rules v${version.version} published to ${version.programScope.join(", ")} — ${version.changes.length} change(s). ${version.notes}`,
    severity: version.changes.length ? "warning" : "info",
    module: "risk",
  });

  emitLifecycle({
    entity: { kind: "rules", id: version.id },
    name: "rules.version-published",
    actor: "prop-admin",
    key: `published:${version.id}`,
    payload: {
      versionId: version.id,
      version: version.version,
      programScope: version.programScope,
      effectiveAt: version.effectiveAt,
      notes: version.notes,
      changes: version.changes,
      // Trader-facing shape (the trader app cannot import this bundle).
      rules: version.rules.map((r) => ({
        id: r.id,
        name: r.name,
        metric: r.metric,
        operator: r.operator,
        threshold: r.threshold,
        severity: r.severity,
        enabled: r.enabled,
      })),
    },
  });

  return version;
}

/** Operator re-pin — moves one account onto another version, with a reason. */
export function repinAccount(accountId: string, versionId: string, reason: string): void {
  const pin = state.pins[accountId];
  const target = getRuleVersion(versionId);
  if (!pin || !target) return;
  const from = getRuleVersion(pin.ruleVersionId);
  state.pins = {
    ...state.pins,
    [accountId]: { ...pin, ruleVersionId: versionId, pinnedAt: new Date().toISOString(), repinnedBy: "Risk Operations" },
  };
  persist();
  notify();
  recordAudit({
    action: "Re-pinned account rules",
    entity: "rules",
    entityId: accountId,
    summary: `${pin.login ?? accountId} moved from Rules v${from?.version ?? "?"} to v${target.version}. Reason: ${reason || "not supplied"}`,
    severity: "warning",
    module: "risk",
  });
}

export function useRulesVersionsVersion(): number {
  const [v, setV] = useState(0);
  useEffect(
    () =>
      subscribe(() => {
        setV((n) => n + 1);
      }),
    [],
  );
  return v;
}
