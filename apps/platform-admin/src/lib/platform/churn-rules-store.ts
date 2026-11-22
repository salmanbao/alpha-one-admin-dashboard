"use client";

/**
 * R13 P1-1 — Churn Prevention rules store.
 *
 * The four intervention rules on the churn screen rendered a hardcoded
 * "active" badge over a pause button that only fired a toast, so the rule
 * state reset on reload and the pause had no effect. Rule status now
 * persists and every toggle writes an audit row.
 *
 * Pattern: singleton state + listener set + version hook, persisted to
 * localStorage under a single key.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";

export interface ChurnRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  triggered30d: number;
  saved30d: number;
  status: "active" | "paused";
}

const STORAGE_KEY = "pfaas:platform-admin:churn-rules";

const SEED: ChurnRule[] = [
  { id: "rule-failed-payment", name: "Failed payment escalation", trigger: "2+ failed charges", action: "Dunning email → 7d → account pause warning", triggered30d: 34, saved30d: 48200, status: "active" },
  { id: "rule-usage-decline", name: "Usage decline", trigger: "Usage −50% MoM", action: "Check-in email + success-manager task", triggered30d: 18, saved30d: 21400, status: "active" },
  { id: "rule-inactivity", name: "Inactivity window", trigger: "No login 30d", action: "Win-back series (3 emails over 14d)", triggered30d: 52, saved30d: 15900, status: "active" },
  { id: "rule-downgrade-intent", name: "Downgrade intent", trigger: "Pricing/downgrade page ×3", action: "Retention offer (10% off 3 months)", triggered30d: 9, saved30d: 8600, status: "active" },
];

function load(): ChurnRule[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChurnRule[]) : SEED;
  } catch {
    return SEED;
  }
}

function persist(next: ChurnRule[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

let rules: ChurnRule[] = load();

export function listChurnRules(): ChurnRule[] {
  return rules;
}

function commit(next: ChurnRule[]) {
  rules = next;
  persist(rules);
  emit();
}

/** Toggle a rule between active and paused (persists + audits). */
export function toggleChurnRule(id: string, actor = "operator"): ChurnRule | undefined {
  const target = rules.find((r) => r.id === id);
  if (!target) return undefined;
  const next: ChurnRule = { ...target, status: target.status === "active" ? "paused" : "active" };
  commit(rules.map((r) => (r.id === id ? next : r)));
  recordAudit({
    actor,
    action: `churn.rule_${next.status === "active" ? "resume" : "pause"}`,
    target: id,
    detail: `Rule "${target.name}" ${next.status === "active" ? "resumed" : "paused"}`,
    severity: next.status === "active" ? "info" : "warning",
  });
  return next;
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe the calling component to churn-rule mutations. */
export function useChurnRulesVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}
