"use client";

/**
 * Risk defaults store (R2-W3-04).
 *
 * Per-tenant risk parameter defaults — daily loss limit, max drawdown,
 * profit target, minimum trading days. Persisted to localStorage (try/catch
 * JSON; platform-admin has no zod) so the Risk Engine page and the
 * go-live wizard's "Risk defaults" step read and write the SAME values:
 * a parameter applied on either surface shows up on the other and
 * survives F5.
 *
 * Absence of an entry means "platform defaults" (the Risk Engine's
 * `isCustom` distinction) — `setRiskParams` is the only way an entry
 * appears.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "pfaas:platform-admin:risk-params";

export interface TenantRiskParams {
  dailyLoss: string;
  maxDd: string;
  profitTarget: string;
  minDays: string;
}

/** Platform default parameters every tenant starts from. */
export const DEFAULT_RISK_PARAMS: TenantRiskParams = {
  dailyLoss: "5",
  maxDd: "10",
  profitTarget: "8",
  minDays: "3",
};

type RiskParamMap = Record<string, TenantRiskParams>;

function readRaw(): RiskParamMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as RiskParamMap;
  } catch {
    return {};
  }
}

function writeRaw(next: RiskParamMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* best-effort: storage full / private mode */
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
function getSnapshot(): string {
  return JSON.stringify(readRaw());
}
function getServerSnapshot(): string {
  return "{}";
}

export function readRiskParams(): RiskParamMap {
  return readRaw();
}

/** Applied params for one tenant, or undefined when still platform defaults. */
export function getRiskParams(tenantId: string): TenantRiskParams | undefined {
  return readRaw()[tenantId];
}

export function setRiskParams(tenantId: string, params: TenantRiskParams): void {
  const next = { ...readRaw(), [tenantId]: params };
  writeRaw(next);
}

export function useRiskParams(): RiskParamMap {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as RiskParamMap;
}
