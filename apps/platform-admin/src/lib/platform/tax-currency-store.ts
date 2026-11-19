"use client";
import { useMemo, useSyncExternalStore } from "react";

/**
 * Tax & Currency store — P0-4: wire fake write-path to store + audit.
 * Exchange rate saves, currency enable/disable, tax-rule edits persist under
 * pfaas:platform-admin:tax-currency.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:tax-currency";

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  enabled: boolean;
  isDefault: boolean;
  precision: number;
}

export interface TaxRule {
  id: string;
  region: string;
  type: string;
  rate: number;
  inclusive: boolean;
  appliesTo: string;
  status: "active" | "disabled";
}

const SEED_CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$", rate: 1.0, enabled: true, isDefault: true, precision: 2 },
  { code: "EUR", name: "Euro", symbol: "€", rate: 0.92, enabled: true, isDefault: false, precision: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", rate: 0.79, enabled: true, isDefault: false, precision: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", rate: 3.67, enabled: true, isDefault: false, precision: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", rate: 1.52, enabled: false, isDefault: false, precision: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", rate: 151.4, enabled: false, isDefault: false, precision: 0 },
];

const SEED_TAX_RULES: TaxRule[] = [
  { id: "tax-001", region: "European Union", type: "VAT", rate: 21, inclusive: true, appliesTo: "All subscription plans", status: "active" },
  { id: "tax-002", region: "United Kingdom", type: "VAT", rate: 20, inclusive: true, appliesTo: "All subscription plans", status: "active" },
  { id: "tax-003", region: "United States (CA)", type: "Sales Tax", rate: 8.5, inclusive: false, appliesTo: "All subscription plans", status: "active" },
  { id: "tax-004", region: "United States (NY)", type: "Sales Tax", rate: 8.0, inclusive: false, appliesTo: "All subscription plans", status: "active" },
  { id: "tax-005", region: "UAE", type: "VAT", rate: 5, inclusive: true, appliesTo: "All subscription plans", status: "active" },
  { id: "tax-006", region: "Australia", type: "GST", rate: 10, inclusive: true, appliesTo: "All subscription plans", status: "disabled" },
];

function readRaw(): { currencies: Currency[]; taxRules: TaxRule[] } {
  if (typeof window === "undefined") return { currencies: SEED_CURRENCIES, taxRules: SEED_TAX_RULES };
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { currencies: SEED_CURRENCIES, taxRules: SEED_TAX_RULES };
    const parsed = JSON.parse(stored);
    if (parsed && Array.isArray(parsed.currencies) && Array.isArray(parsed.taxRules)) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return { currencies: SEED_CURRENCIES, taxRules: SEED_TAX_RULES };
}

function writeRaw(next: { currencies: Currency[]; taxRules: TaxRule[] }): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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

export function readTaxCurrency() {
  return readRaw();
}

export function useTaxCurrency() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRaw()),
    () => JSON.stringify({ currencies: SEED_CURRENCIES, taxRules: SEED_TAX_RULES }),
  );
  return useMemo(() => {
    try {
      return JSON.parse(snapshot) as { currencies: Currency[]; taxRules: TaxRule[] };
    } catch {
      return { currencies: SEED_CURRENCIES, taxRules: SEED_TAX_RULES };
    }
  }, [snapshot]);
}

// Mutations
export function saveExchangeRate(code: string, rate: number): { title: string; description: string } {
  const state = readRaw();
  const idx = state.currencies.findIndex((c) => c.code === code);
  if (idx < 0) {
    return { title: "(Demo)", description: `Exchange rate saved (${code} → ${rate}). Rate refresh scheduled.` };
  }
  const updated = { ...state.currencies[idx], rate };
  const currencies = [...state.currencies.slice(0, idx), updated, ...state.currencies.slice(idx + 1)];
  writeRaw({ currencies, taxRules: state.taxRules });
  recordAudit({
    actor: "Console operator",
    action: "tax.exchange_rate_saved",
    target: code,
    severity: "info",
    detail: `${code} rate updated to ${rate}. Rate refresh scheduled.`,
  });
  return { title: "Exchange rate saved", description: `${code} rate updated to ${rate}. Rate refresh scheduled.` };
}

export function toggleCurrency(code: string, enabled: boolean): { title: string; description: string } {
  const state = readRaw();
  const idx = state.currencies.findIndex((c) => c.code === code);
  if (idx < 0) {
    return { title: "(Demo)", description: `${code} ${enabled ? "enabled" : "disabled"}.` };
  }
  const updated = { ...state.currencies[idx], enabled };
  const currencies = [...state.currencies.slice(0, idx), updated, ...state.currencies.slice(idx + 1)];
  writeRaw({ currencies, taxRules: state.taxRules });
  recordAudit({
    actor: "Console operator",
    action: enabled ? "tax.currency_enabled" : "tax.currency_disabled",
    target: code,
    severity: enabled ? "info" : "warning",
    detail: `${code} ${enabled ? "enabled" : "disabled"}.`,
  });
  return {
    title: enabled ? "Currency enabled" : "Currency disabled",
    description: `${code} ${enabled ? "enabled" : "disabled"}.`,
  };
}

export function saveTaxRule(rule: TaxRule): { title: string; description: string } {
  const state = readRaw();
  const idx = state.taxRules.findIndex((r) => r.id === rule.id);
  if (idx < 0) {
    return { title: "(Demo)", description: `Tax rule saved for ${rule.region}.` };
  }
  const updated = { ...rule, updatedAt: new Date().toISOString() };
  const taxRules = [...state.taxRules.slice(0, idx), updated, ...state.taxRules.slice(idx + 1)];
  writeRaw({ currencies: state.currencies, taxRules });
  recordAudit({
    actor: "Console operator",
    action: "tax.rule_saved",
    target: rule.id,
    severity: "warning",
    detail: `${rule.region} ${rule.type}: ${rule.rate}% ${rule.inclusive ? "inclusive" : "exclusive"}.`,
  });
  return { title: "Tax rule saved", description: `${rule.region} ${rule.type} updated to ${rule.rate}%.` };
}

export function toggleTaxRule(ruleId: string, status: "active" | "disabled"): { title: string; description: string } {
  const state = readRaw();
  const idx = state.taxRules.findIndex((r) => r.id === ruleId);
  if (idx < 0) {
    return { title: "(Demo)", description: `Tax rule ${status}.` };
  }
  const updated = { ...state.taxRules[idx], status };
  const taxRules = [...state.taxRules.slice(0, idx), updated, ...state.taxRules.slice(idx + 1)];
  writeRaw({ currencies: state.currencies, taxRules });
  recordAudit({
    actor: "Console operator",
    action: status === "active" ? "tax.rule_enabled" : "tax.rule_disabled",
    target: ruleId,
    severity: status === "active" ? "info" : "warning",
    detail: `${updated.region} ${updated.type} ${status}.`,
  });
  return {
    title: status === "active" ? "Tax rule enabled" : "Tax rule disabled",
    description: `${updated.region} ${updated.type} ${status}.`,
  };
}
