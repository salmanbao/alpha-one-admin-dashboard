"use client";

/**
 * R7 I4 — payout automation rules engine (P3/P6).
 *
 * Extends the old single auto-approve rule (`auto-approve-store.ts`, one
 * threshold + a toast) into the rules engine prop CRMs advertise:
 * "automate payout calculations and disbursements based on predefined
 * rules".
 *
 *   • Rule model: priority-ordered conditions → action
 *     (`auto-approve` | `auto-reject` | `escalate`), CRUD + enable
 *     toggles, persisted to `pfaas:demo:payout-rules` (R10).
 *   • Evaluator: `usePayoutRulesEvaluator` is mounted in the app shell so
 *     it runs on EVERY incoming `payout.requested` (cross-app intake),
 *     regardless of the view the operator is on. First matching enabled
 *     rule by priority decides; the outcome is stamped on the request
 *     (`automated: true, ruleId`). No match → the row stays in the manual
 *     queue exactly as before.
 *   • Every auto-decision goes through `applyPayoutDecision` (the audit +
 *     `payout.*` lifecycle chokepoint), then additionally emits
 *     `payout.auto-decided` (consumer: trader inbox bridge receipt —
 *     "Payout approved automatically under rule X — review window 24h
 *     (Demo)") and records an evaluator run (last 20 shown on the rules
 *     page).
 *   • AML veto is absolute (R3-F02): a held payout never auto-decides,
 *     even if a rule matches.
 */

import { useEffect, useSyncExternalStore } from "react";
import { emitLifecycle, useLifecycleLog } from "@pfaas/lifecycle";
import { z } from "zod";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { recordAudit } from "@/lib/audit";
import { getTenantPayouts, getTenantTraders, type Payout } from "@/lib/platform/mock-data";
import { worstPayoutRisk } from "@/lib/platform/payout-risk";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { getEvaluations } from "@/modules/trading/evaluation-store";
import { applyPayoutDecision, effectivePayoutStatus, payoutAmlBlock } from "@/modules/payouts/payout-store";

/** Bare demo-store id — `saveDemoState` prefixes it (`pfaas:demo:`). */
const SLOT = "payout-rules";
/** Rules page shows the last 20 evaluator runs. */
const MAX_RUNS = 20;
/** `consistencyOk: true` passes when the consistency score reaches this. */
const CONSISTENCY_OK_MIN = 50;

/* ------------------------------------------------------------------ */
/* Schema + types                                                      */
/* ------------------------------------------------------------------ */

const ruleSchema = z.object({
  id: z.string(),
  name: z.string(),
  priority: z.number().int(),
  enabled: z.boolean(),
  conditions: z.object({
    /** Account age (days since joinedAt) must be >= this. */
    minAccountAgeDays: z.number().optional(),
    /** Evaluation `daysTraded` must be >= this. */
    minTradingDays: z.number().optional(),
    /** Max-drawdown usage (%) must be <= this (a ceiling, not a trigger). */
    maxDrawdownUsagePct: z.number().optional(),
    /** Consistency score must reach CONSISTENCY_OK_MIN. */
    consistencyOk: z.boolean().optional(),
    /** Payout must not sit behind an AML hold (R3-F02). */
    amlCleared: z.boolean().optional(),
    /** Requested amount must be below this (USD). */
    amountBelowUsd: z.number().optional(),
  }),
  action: z.enum(["auto-approve", "auto-reject", "escalate"]),
  splitPct: z.number().optional(),
});

const runSchema = z.object({
  id: z.string(),
  at: z.string(),
  reference: z.string(),
  traderName: z.string(),
  amount: z.number(),
  currency: z.string(),
  ruleId: z.string().nullable(),
  ruleName: z.string().nullable(),
  action: z.enum(["auto-approve", "auto-reject", "escalate", "manual"]),
  reason: z.string(),
});

const evaluationSchema = z.object({
  automated: z.boolean(),
  ruleId: z.string().nullable(),
  ruleName: z.string().nullable(),
  action: z.enum(["auto-approve", "auto-reject", "escalate", "manual"]),
  at: z.string(),
});

const stateSchema = z.object({
  rules: z.array(ruleSchema),
  runs: z.array(runSchema),
  stamps: z.record(z.string(), evaluationSchema),
});

export type PayoutRule = z.infer<typeof ruleSchema>;
export type PayoutRuleAction = PayoutRule["action"];
export type PayoutRuleConditions = PayoutRule["conditions"];
export type PayoutRuleRun = z.infer<typeof runSchema>;
export type PayoutEvaluation = z.infer<typeof evaluationSchema>;
export type PayoutRulesState = z.infer<typeof stateSchema>;

/** Everything the evaluator knows about one pending payout (R7 I4). */
export interface PayoutRuleContext {
  accountAgeDays: number;
  tradingDays: number;
  drawdownUsagePct: number;
  consistencyScore: number;
  amlCleared: boolean;
  amountUsd: number;
}

/**
 * Seed rules — the demo starts with a working engine:
 *   1. micro-floor (disabled): operator can turn on sub-$100 rejection.
 *   2. fast-track (enabled): small, AML-clear requests auto-approve — the
 *      acceptance path for "a payout satisfying a rule auto-decides".
 *   3. drawdown-guard (disabled): healthy-trader auto-approve band.
 *   4. senior-review (enabled): established traders' larger requests
 *      escalate for a second signature; unknown traders (cross-app rows
 *      with no resolvable profile) fall through to the manual queue.
 */
const SEED_RULES: PayoutRule[] = [
  {
    id: "rule-micro-floor",
    name: "Micro-payout reject floor",
    priority: 1,
    enabled: false,
    conditions: { amountBelowUsd: 100, amlCleared: true },
    action: "auto-reject",
    splitPct: 80,
  },
  {
    id: "rule-fast-track",
    name: "Small payout fast-track",
    priority: 2,
    enabled: true,
    conditions: { amountBelowUsd: 2500, amlCleared: true },
    action: "auto-approve",
    splitPct: 80,
  },
  {
    id: "rule-drawdown-guard",
    name: "Healthy-trader auto-approve",
    priority: 3,
    enabled: false,
    conditions: {
      amountBelowUsd: 10000,
      minAccountAgeDays: 30,
      minTradingDays: 5,
      maxDrawdownUsagePct: 65,
      consistencyOk: true,
      amlCleared: true,
    },
    action: "auto-approve",
    splitPct: 85,
  },
  {
    id: "rule-senior-review",
    name: "Established trader senior review",
    priority: 4,
    enabled: true,
    conditions: { amountBelowUsd: 10000, minAccountAgeDays: 30, amlCleared: true },
    action: "escalate",
    splitPct: 80,
  },
];

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();

let state: PayoutRulesState = loadDemoState(SLOT, stateSchema, {
  rules: SEED_RULES,
  runs: [],
  stamps: {},
});

function persist(): void {
  try {
    saveDemoState(SLOT, state);
  } catch {
    /* storage unavailable — state stays in memory for this session */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Non-reactive read of the whole rules state. */
export function readPayoutRules(): PayoutRulesState {
  return state;
}

/** Reactive read — rules page, queue card and previews re-render on change. */
export function usePayoutRules(): PayoutRulesState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Automation stamp for one request, or null when it is manual. */
export function payoutAutomationStamp(reference: string): PayoutEvaluation | null {
  const s = state.stamps[reference];
  return s && s.automated ? s : null;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Human one-liner for a rule's condition set (empty → matches all). */
export function describeConditions(c: PayoutRuleConditions): string[] {
  const out: string[] = [];
  if (c.amountBelowUsd !== undefined) out.push(`amount < $${c.amountBelowUsd.toLocaleString("en-US")}`);
  if (c.minAccountAgeDays !== undefined) out.push(`account age ≥ ${c.minAccountAgeDays}d`);
  if (c.minTradingDays !== undefined) out.push(`trading days ≥ ${c.minTradingDays}`);
  if (c.maxDrawdownUsagePct !== undefined) out.push(`max drawdown usage ≤ ${c.maxDrawdownUsagePct}%`);
  if (c.consistencyOk) out.push(`consistency ≥ ${CONSISTENCY_OK_MIN}`);
  if (c.amlCleared) out.push("AML clear");
  return out;
}

/** Create or update a rule (id present → update). Audited (§5 rule 2). */
export function savePayoutRule(input: Omit<PayoutRule, "id"> & { id?: string }): PayoutRule {
  const rule: PayoutRule = { ...input, id: input.id ?? newId("rule") };
  const existing = state.rules.some((r) => r.id === rule.id);
  state = {
    ...state,
    rules: existing ? state.rules.map((r) => (r.id === rule.id ? rule : r)) : [...state.rules, rule],
  };
  recordAudit({
    action: existing ? "Updated payout rule" : "Created payout rule",
    entity: "payout-rule",
    entityId: rule.id,
    summary: `${rule.name} — ${rule.action} · ${
      describeConditions(rule.conditions).join(", ") || "matches every request"
    } · priority ${rule.priority}${rule.enabled ? "" : " (disabled)"}`,
    module: "payout",
  });
  persist();
  return rule;
}

/** Delete a rule. Audited (§5 rule 2). */
export function deletePayoutRule(id: string): void {
  const rule = state.rules.find((r) => r.id === id);
  if (!rule) return;
  state = { ...state, rules: state.rules.filter((r) => r.id !== id) };
  recordAudit({
    action: "Deleted payout rule",
    entity: "payout-rule",
    entityId: id,
    summary: `${rule.name} (${rule.action}) — incoming payout requests no longer evaluated against it`,
    severity: "warning",
    module: "payout",
  });
  persist();
}

/** Enable/disable a rule. Audited (§5 rule 2). */
export function setPayoutRuleEnabled(id: string, enabled: boolean): void {
  const rule = state.rules.find((r) => r.id === id);
  if (!rule || rule.enabled === enabled) return;
  state = { ...state, rules: state.rules.map((r) => (r.id === id ? { ...r, enabled } : r)) };
  recordAudit({
    action: enabled ? "Enabled payout rule" : "Disabled payout rule",
    entity: "payout-rule",
    entityId: id,
    summary: `${rule.name} — incoming payout requests ${enabled ? "will" : "will no longer"} be decided automatically`,
    module: "payout",
  });
  persist();
}

/* ------------------------------------------------------------------ */
/* Context + matcher                                                   */
/* ------------------------------------------------------------------ */

const daysSince = (iso: string): number => {
  const ms = Date.now() - Date.parse(iso);
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86_400_000)) : 0;
};

/**
 * Everything one rule can look at for one pending payout. Unknown values
 * resolve conservatively (0 / no match), so a rule that needs a resolvable
 * profile fails toward the manual queue instead of guessing.
 */
export function buildPayoutRuleContext(tid: string, p: Payout): PayoutRuleContext {
  const trader = getTenantTraders(tid).find(
    (t) => t.id === p.traderId || (!!p.traderName && t.name === p.traderName),
  );
  const evaluation = getEvaluations().find(
    (e) => e.traderName === p.traderName || (!!trader && e.traderEmail === trader.email),
  );
  const risk = trader ? worstPayoutRisk(tid, [trader.id]) : undefined;
  return {
    accountAgeDays: trader ? daysSince(trader.joinedAt) : 0,
    tradingDays: evaluation?.daysTraded ?? 0,
    drawdownUsagePct: risk?.accountHealth.maxDrawdownUsed ?? 0,
    consistencyScore: risk?.accountHealth.consistencyScore ?? 0,
    amlCleared: !payoutAmlBlock(p.reference),
    amountUsd: p.amount,
  };
}

/** Why one rule does NOT match this context, or null when it matches. */
export function ruleMismatch(rule: PayoutRule, ctx: PayoutRuleContext): string | null {
  const c = rule.conditions;
  if (c.amlCleared && !ctx.amlCleared) return "AML hold";
  if (c.amountBelowUsd !== undefined && !(ctx.amountUsd < c.amountBelowUsd)) {
    return `amount $${ctx.amountUsd.toLocaleString("en-US")} ≥ $${c.amountBelowUsd.toLocaleString("en-US")}`;
  }
  if (c.minAccountAgeDays !== undefined && !(ctx.accountAgeDays >= c.minAccountAgeDays)) {
    return `account age ${ctx.accountAgeDays}d < ${c.minAccountAgeDays}d`;
  }
  if (c.minTradingDays !== undefined && !(ctx.tradingDays >= c.minTradingDays)) {
    return `trading days ${ctx.tradingDays} < ${c.minTradingDays}`;
  }
  if (c.maxDrawdownUsagePct !== undefined && !(ctx.drawdownUsagePct <= c.maxDrawdownUsagePct)) {
    return `drawdown usage ${ctx.drawdownUsagePct}% > ${c.maxDrawdownUsagePct}%`;
  }
  if (c.consistencyOk && !(ctx.consistencyScore >= CONSISTENCY_OK_MIN)) {
    return `consistency ${ctx.consistencyScore} < ${CONSISTENCY_OK_MIN}`;
  }
  return null;
}

/**
 * First matching rule by priority. `enabledOnly` (default) is what the
 * evaluator and the queue gate use; previews pass `false` to also show
 * what a disabled rule *would* decide.
 */
export function firstMatchingRule(
  rules: PayoutRule[],
  ctx: PayoutRuleContext,
  opts?: { enabledOnly?: boolean },
): PayoutRule | null {
  const enabledOnly = opts?.enabledOnly ?? true;
  const ordered = [...rules]
    .filter((r) => !enabledOnly || r.enabled)
    .sort((a, b) => a.priority - b.priority);
  for (const rule of ordered) {
    if (!ruleMismatch(rule, ctx)) return rule;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Evaluator                                                           */
/* ------------------------------------------------------------------ */

function recordRun(
  p: Payout,
  rule: PayoutRule | null,
  action: PayoutRuleRun["action"],
  reason: string,
): void {
  const run: PayoutRuleRun = {
    id: newId("run"),
    at: new Date().toISOString(),
    reference: p.reference,
    traderName: p.traderName,
    amount: p.amount,
    currency: p.currency,
    ruleId: rule?.id ?? null,
    ruleName: rule?.name ?? null,
    action,
    reason,
  };
  state = { ...state, runs: [run, ...state.runs].slice(0, MAX_RUNS) };
}

function stamp(
  reference: string,
  automated: boolean,
  rule: PayoutRule | null,
  action: PayoutEvaluation["action"],
): void {
  state = {
    ...state,
    stamps: {
      ...state.stamps,
      [reference]: {
        automated,
        ruleId: rule?.id ?? null,
        ruleName: rule?.name ?? null,
        action,
        at: new Date().toISOString(),
      },
    },
  };
}

/**
 * Evaluate ONE pending payout against the enabled rules and record the
 * outcome (run row + stamp, persisted). Called only for incoming
 * `payout.requested` references that have not been evaluated yet.
 */
function evaluatePayout(tid: string, p: Payout): void {
  const ctx = buildPayoutRuleContext(tid, p);

  // R3-F02 veto — an AML-held payout never auto-decides, whatever the
  // rules say; it is stamped manual so it never loops back here.
  if (!ctx.amlCleared) {
    recordRun(p, null, "manual", "AML hold — manual review");
    stamp(p.reference, false, null, "manual");
    persist();
    return;
  }

  const rule = firstMatchingRule(state.rules, ctx);
  if (!rule) {
    recordRun(p, null, "manual", "No enabled rule matched — manual queue");
    stamp(p.reference, false, null, "manual");
    persist();
    return;
  }

  const decision =
    rule.action === "auto-approve" ? "approved" : rule.action === "auto-reject" ? "rejected" : "escalated";
  // Audit + `payout.*` lifecycle chokepoint — the same path every manual
  // decision surface uses, so the trail reads identically.
  const result = applyPayoutDecision(p.reference, decision, {
    reason: `Automated by rule "${rule.name}"`,
    automated: true,
    ruleId: rule.id,
  });
  if (!result.ok) {
    recordRun(p, rule, "manual", `Blocked — ${result.reason}`);
    stamp(p.reference, false, null, "manual");
    persist();
    return;
  }

  // Named consumer: trader inbox bridge receipt
  // ("Payout approved automatically under rule X — review window 24h (Demo)").
  emitLifecycle({
    entity: { kind: "payout", id: p.reference },
    name: "payout.auto-decided",
    actor: "prop-admin",
    key: `${p.reference}:auto`,
    payload: {
      reference: p.reference,
      trader: p.traderName,
      amount: p.amount,
      currency: p.currency,
      ruleId: rule.id,
      ruleName: rule.name,
      action: rule.action,
      splitPct: rule.splitPct ?? null,
      automated: true,
    },
  });
  recordRun(p, rule, rule.action, `Decided ${rule.action} under "${rule.name}"`);
  stamp(p.reference, true, rule, rule.action);
  persist();
}

/**
 * Mounted once in the app shell: reacts to the shared lifecycle log and
 * evaluates every incoming `payout.requested` — cross-app intake rows
 * only resolve inside the tenant queue they belong to, and each request
 * is evaluated exactly once (stamp dedupe). Guarded by the same
 * permission the Approve buttons use, so automation never out-runs the
 * role; without it nothing is stamped, so a privileged session picks the
 * request up later.
 */
export function usePayoutRulesEvaluator(tid: string): void {
  const events = useLifecycleLog();
  const { user } = usePlatform();
  const canDecide = hasPermission(user, "payout.approve");
  useEffect(() => {
    if (!canDecide) return;
    for (const e of events) {
      if (e.name !== "payout.requested" || e.entity.kind !== "payout") continue;
      const ref = String(e.payload?.reference ?? "");
      if (!ref || state.stamps[ref]) continue;
      const p = getTenantPayouts(tid).find((x) => x.reference === ref);
      // Not in this tenant's queue (other tenant / not intake-visible).
      if (!p) continue;
      // Already decided manually (or by a previous session) — nothing to do.
      if (effectivePayoutStatus(p) !== "pending") continue;
      evaluatePayout(tid, p);
    }
  }, [events, tid, canDecide]);
}
