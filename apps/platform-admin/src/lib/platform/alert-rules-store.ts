"use client";

/**
 * R13 P1-5 — Alert Rules store.
 *
 * Threshold-based alert configuration persisted to localStorage.
 * Every mutation (toggle, threshold change) writes an audit row.
 * Pattern: singleton state + listener set + version hook, persisted to
 * localStorage under a single key.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";
import { Inbox, Activity, Gauge, ShieldAlert } from "lucide-react";

const STORAGE_KEY = "pfaas:platform:alertRules";

/** Alert rule identifiers — match those in NotificationsPage. */
export type AlertRuleId = "queueBacklog" | "apiUsage" | "tenantHealth" | "slaBreach";

export interface AlertRule {
  id: AlertRuleId;
  label: string;
  description: string;
  unit: string;
  threshold: number;
  enabled: boolean;
  icon: typeof Inbox;
  currentValue: number;
  higherIsWorse: boolean;
  linkHref: string;
}

/** Persisted subset of rule config (threshold + enabled only). */
interface PersistedRuleConfig {
  threshold: number;
  enabled: boolean;
}

interface AlertRulesState {
  rules: AlertRule[];
}

/** Default rule configuration (mirrors NotificationsPage DEFAULT_ALERT_RULES). */
const DEFAULT_RULES: AlertRule[] = [
  {
    id: "queueBacklog",
    label: "Queue backlog",
    description: "Alert when total pending KYC + payouts + tickets exceeds the threshold.",
    unit: "items",
    threshold: 25,
    enabled: true,
    icon: Inbox,
    currentValue: 18,
    higherIsWorse: true,
    linkHref: "cross-tenant-queues",
  },
  {
    id: "apiUsage",
    label: "API usage anomaly",
    description: "Alert when any tenant's daily API calls exceed the threshold.",
    unit: "calls/day",
    threshold: 50000,
    enabled: true,
    icon: Activity,
    currentValue: 42000,
    higherIsWorse: true,
    linkHref: "tenant-api-usage",
  },
  {
    id: "tenantHealth",
    label: "Tenant health score",
    description: "Alert when a tenant's health score drops below the threshold.",
    unit: "score",
    threshold: 60,
    enabled: false,
    icon: Gauge,
    currentValue: 72,
    higherIsWorse: false,
    linkHref: "tenant-health",
  },
  {
    id: "slaBreach",
    label: "SLA breach risk",
    description: "Alert when projected SLA breach probability exceeds the threshold.",
    unit: "%",
    threshold: 70,
    enabled: true,
    icon: ShieldAlert,
    currentValue: 82,
    higherIsWorse: true,
    linkHref: "sla-monitoring",
  },
];

function load(): AlertRulesState {
  if (typeof window === "undefined") {
    return { rules: DEFAULT_RULES };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { rules: DEFAULT_RULES };
    }
    const parsed = JSON.parse(raw) as Partial<Record<AlertRuleId, PersistedRuleConfig>>;
    const rules = DEFAULT_RULES.map((rule) => {
      const override = parsed[rule.id];
      return override ? { ...rule, threshold: override.threshold, enabled: override.enabled } : rule;
    });
    return { rules };
  } catch {
    return { rules: DEFAULT_RULES };
  }
}

function persist(next: AlertRulesState) {
  if (typeof window === "undefined") return;
  try {
    const payload: Partial<Record<AlertRuleId, PersistedRuleConfig>> = {};
    next.rules.forEach((r) => {
      payload[r.id] = { threshold: r.threshold, enabled: r.enabled };
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

let state: AlertRulesState = load();

function commit(next: AlertRulesState) {
  state = next;
  persist(state);
  emit();
}

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe the calling component to alert-rules mutations. */
export function useAlertRulesVersion(): number {
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

export function readAlertRules(): AlertRule[] {
  return state.rules;
}

/** Toggle an alert rule's enabled state. Persists + audits. */
export function toggleAlertRule(
  id: AlertRuleId,
  actor = "operator",
): AlertRule[] {
  const next = state.rules.map((rule) =>
    rule.id === id ? { ...rule, enabled: !rule.enabled } : rule,
  );
  const changed = next.find((r) => r.id === id)!;
  commit({ rules: next });
  recordAudit({
    actor,
    action: `alertRule.${changed.enabled ? "enable" : "disable"}`,
    target: "alert-rules",
    detail: `Alert rule "${id}" ${changed.enabled ? "enabled" : "disabled"}`,
    severity: "info",
  });
  return next;
}

/** Update an alert rule's threshold. Persists + audits. */
export function updateAlertRuleThreshold(
  id: AlertRuleId,
  threshold: number,
  actor = "operator",
): AlertRule[] {
  const next = state.rules.map((rule) =>
    rule.id === id ? { ...rule, threshold } : rule,
  );
  commit({ rules: next });
  recordAudit({
    actor,
    action: "alertRule.threshold_update",
    target: "alert-rules",
    detail: `Alert rule "${id}" threshold updated to ${threshold}`,
    severity: "info",
  });
  return next;
}

/** Reset all alert rules to defaults. Persists + audits. */
export function resetAlertRules(actor = "operator"): AlertRule[] {
  state = { rules: DEFAULT_RULES };
  persist(state);
  recordAudit({
    actor,
    action: "alertRules.reset",
    target: "alert-rules",
    detail: "Alert rules reset to defaults",
    severity: "warning",
  });
  emit();
  return DEFAULT_RULES;
}