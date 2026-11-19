"use client";
import { useMemo, useSyncExternalStore } from "react";

/**
 * Risk Engine rules/thresholds store — P0-4.
 * Engine rule toggles + breach thresholds persist under
 * pfaas:platform-admin:risk-rules and pfaas:platform-admin:risk-thresholds.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { recordAudit } from "@/lib/platform/console-store";

const RULES_KEY = "pfaas:platform-admin:risk-rules";
const THRESHOLDS_KEY = "pfaas:platform-admin:risk-thresholds";

export interface EngineRule {
  id: string;
  name: string;
  description: string;
  scope: "Global" | "Per-tenant" | "Beta";
  enabled: boolean;
  critical: boolean;
}

export interface Thresholds {
  nearMiss: string;
  equityDrop: string;
  criticalDd: string;
  rapid: string;
}

const ENGINE_RULES: EngineRule[] = [
  { id: "intraday-dd", name: "Intraday drawdown enforcement", description: "Breaches the daily loss limit while the session is still open.", scope: "Global", enabled: true, critical: true },
  { id: "consistency", name: "Consistency rule (30%)", description: "No single trading day may contribute more than 30% of total profit.", scope: "Global", enabled: true, critical: false },
  { id: "news-guard", name: "News-event position check", description: "Blocks new entries within ±2 minutes of tier-1 releases.", scope: "Global", enabled: true, critical: false },
  { id: "copy-detect", name: "Copy-trade detection", description: "Flags mirror execution across account clusters for review.", scope: "Global", enabled: true, critical: true },
  { id: "weekend-hold", name: "Weekend holding guard", description: "Restricts overnight and weekend exposure on challenge accounts.", scope: "Per-tenant", enabled: false, critical: false },
  { id: "ai-anomaly", name: "AI anomaly surveillance", description: "Scores tick-level anomalies and routes them to manual review.", scope: "Beta", enabled: false, critical: false },
];

const DEFAULT_THRESHOLDS: Thresholds = {
  nearMiss: "80",
  equityDrop: "3",
  criticalDd: "90",
  rapid: "1.5",
};

function readRulesRaw(): EngineRule[] {
  if (typeof window === "undefined") return ENGINE_RULES;
  try {
    const stored = window.localStorage.getItem(RULES_KEY);
    if (!stored) return ENGINE_RULES;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Merge with seed to handle any new rules added since last persist
      const byId = new Map(parsed.map((r: any) => [r.id, r]));
      return ENGINE_RULES.map((seed) => byId.get(seed.id) ?? seed);
    }
  } catch {
    /* fall through */
  }
  return ENGINE_RULES;
}

function writeRulesRaw(next: EngineRule[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RULES_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  notify();
}

function readThresholdsRaw(): Thresholds {
  if (typeof window === "undefined") return DEFAULT_THRESHOLDS;
  try {
    const stored = window.localStorage.getItem(THRESHOLDS_KEY);
    if (!stored) return DEFAULT_THRESHOLDS;
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed.nearMiss === "string" && typeof parsed.equityDrop === "string" && typeof parsed.criticalDd === "string" && typeof parsed.rapid === "string") {
      return parsed as Thresholds;
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_THRESHOLDS;
}

function writeThresholdsRaw(next: Thresholds): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  notify();
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function readRules(): EngineRule[] {
  return readRulesRaw().map((r) => ({ ...r }));
}

export function useRuleToggles(): EngineRule[] {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRulesRaw()),
    () => JSON.stringify(ENGINE_RULES),
  );
  return useMemo(() => {
    try {
      return (JSON.parse(snapshot) as EngineRule[]).map((r) => ({ ...r }));
    } catch {
      return ENGINE_RULES.map((r) => ({ ...r }));
    }
  }, [snapshot]);
}

export function toggleRule(rule: EngineRule, enabled: boolean): void {
  const rules = readRules();
  const updated = rules.map((r) => (r.id === rule.id ? { ...r, enabled } : r));
  writeRulesRaw(updated);
  recordAudit({
    actor: "Console operator",
    action: enabled ? "risk.rule_enabled" : "risk.rule_disabled",
    target: rule.name,
    severity: rule.critical && !enabled ? "warning" : "info",
    detail: `${rule.scope} scope · applies from the next evaluation cycle`,
  });
}

export function readThresholds(): Thresholds {
  return { ...readThresholdsRaw() };
}

export function useThresholds(): Thresholds {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readThresholdsRaw()),
    () => JSON.stringify(DEFAULT_THRESHOLDS),
  );
  return useMemo(() => {
    try {
      return JSON.parse(snapshot) as Thresholds;
    } catch {
      return DEFAULT_THRESHOLDS;
    }
  }, [snapshot]);
}

export function applyThresholds(patched: Thresholds): { title: string; description: string } {
  writeThresholdsRaw(patched);
  recordAudit({
    actor: "Console operator",
    action: "risk.thresholds_applied",
    target: "breach thresholds",
    severity: "info",
    detail: `near-miss ${patched.nearMiss}% · equity drop ${patched.equityDrop}% · critical DD ${patched.criticalDd}% · rapid ${patched.rapid}%`,
  });
  return {
    title: "Thresholds applied",
    description: `Near-miss ${patched.nearMiss}% · equity drop ${patched.equityDrop}% · critical DD ${patched.criticalDd}% · rapid ${patched.rapid}%.`,
  };
}