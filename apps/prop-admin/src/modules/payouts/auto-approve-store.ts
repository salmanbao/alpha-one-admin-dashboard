"use client";

import { useSyncExternalStore } from "react";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { autoApproveRuleSchema, type AutoApproveRule } from "@/lib/platform/validation";
const SLOT = "auto-approve-rule";
const DEFAULT_RULE: AutoApproveRule = { enabled: false, threshold: 70, excludeOpenBreaches: true };

function readRaw(): AutoApproveRule {
  const persisted = loadDemoState(SLOT, autoApproveRuleSchema, DEFAULT_RULE);
  try {
    return autoApproveRuleSchema.parse(persisted);
  } catch {
    return DEFAULT_RULE;
  }
}

const listeners = new Set<() => void>();
let state: AutoApproveRule = readRaw();
function notify() {
  listeners.forEach((l) => l());
  try {
    saveDemoState(SLOT, state);
  } catch {
    /* ignore */
  }
}

export function readAutoApproveRule(): AutoApproveRule {
  return { ...state };
}

export function updateAutoApproveRule(patch: Partial<AutoApproveRule>): void {
  state = { ...state, ...patch };
  try {
    state = autoApproveRuleSchema.parse(state);
  } catch {
    state = { ...DEFAULT_RULE, ...patch } as AutoApproveRule;
  }
  notify();
}

export function useAutoApproveRule(): AutoApproveRule {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => JSON.stringify(state),
    () => JSON.stringify(DEFAULT_RULE),
  );
  return JSON.parse(raw) as AutoApproveRule;
}

// Shared evaluation path (R2-W2-02): one function used by single + batch.
export function evaluateAutoApproval(
  payout: { traderId: string; reference: string },
  rule: AutoApproveRule,
  ctx: { riskScore: number; openBreaches: number; amlBlocked: boolean },
): { auto: boolean; reason: string } {
  if (!rule.enabled) return { auto: false, reason: "rule disabled" };
  if (ctx.riskScore < rule.threshold) return { auto: false, reason: `risk ${ctx.riskScore} < ${rule.threshold}` };
  if (rule.excludeOpenBreaches && ctx.openBreaches > 0) return { auto: false, reason: `${ctx.openBreaches} open breach(es)` };
  if (ctx.amlBlocked) return { auto: false, reason: "AML hold" };
  return { auto: true, reason: "auto-approved by rule" };
}
