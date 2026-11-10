"use client";

/**
 * Platform plan catalog — R3-04 (AUDIT-R3 §6 item 4).
 *
 * The pricing tiers lived in `useState` on the plans page, so every
 * operator edit died on reload — and the Plan Transition workflow kept a
 * second, independently hardcoded copy of the same fixtures, validating
 * a migration against limits the plans page no longer showed. The
 * catalog now lives here once: seeded from DEFAULT_PLANS, persisted
 * under `pfaas:platform-admin:plans`, read through a reactive hook by
 * both workflow pages.
 */

import { useSyncExternalStore } from "react";

export type PlanId = "starter" | "growth" | "scale" | "enterprise";

export interface PlanLimits {
  traders: number;
  apiCallsPerDay: number;
  storageGb: number;
  eventsPerDay: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthly: number; // platform charges the tenant this /mo
  trialDays: number; // 0 = no trial
  limits: PlanLimits;
  features: string[];
}

export const DEFAULT_PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "New prop firms validating their first challenge program.",
    priceMonthly: 890,
    trialDays: 14,
    limits: { traders: 1_000, apiCallsPerDay: 100_000, storageGb: 50, eventsPerDay: 10_000 },
    features: ["Challenges & payouts", "Risk monitoring (basic)", "Email support"],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Scaling firms with active marketing and affiliate programs.",
    priceMonthly: 1_900,
    trialDays: 14,
    limits: { traders: 5_000, apiCallsPerDay: 1_000_000, storageGb: 250, eventsPerDay: 100_000 },
    features: [
      "Everything in Starter",
      "Affiliates & marketing",
      "Advanced risk analytics",
      "White-label branding",
      "Priority support",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "High-volume operations with API and SIEM integrations.",
    priceMonthly: 4_900,
    trialDays: 30,
    limits: { traders: 20_000, apiCallsPerDay: 5_000_000, storageGb: 1_000, eventsPerDay: 500_000 },
    features: [
      "Everything in Growth",
      "Full API access",
      "SIEM / audit exports",
      "Custom contracts",
      "Dedicated CSM",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Bespoke contracts, SSO, and unlimited scale.",
    priceMonthly: 12_000,
    trialDays: 30,
    limits: { traders: 50_000, apiCallsPerDay: 10_000_000, storageGb: 2_000, eventsPerDay: 1_000_000 },
    features: [
      "Everything in Scale",
      "SAML / OIDC SSO",
      "Unlimited branding seats",
      "99.9% SLA + named engineer",
      "Custom data residency",
    ],
  },
];

const STORAGE_KEY = "pfaas:platform-admin:plans";

/** Shape check — a persisted entry must be renderable as a plan card. */
function isPlan(v: unknown): v is Plan {
  const p = v as Plan | null;
  return (
    !!p &&
    typeof p === "object" &&
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.priceMonthly === "number" &&
    typeof p.trialDays === "number" &&
    !!p.limits &&
    typeof p.limits === "object" &&
    Array.isArray(p.features)
  );
}

/**
 * Stored catalog → usable catalog: the four canonical tiers always
 * exist (a stored copy overrides its default per id), any extra
 * operator-created tiers are kept when their shape is sound, and
 * unparseable storage falls back to the pristine defaults.
 */
function normalize(raw: unknown): Plan[] {
  if (!Array.isArray(raw)) return DEFAULT_PLANS;
  const stored = new Map<string, Plan>();
  for (const p of raw) if (isPlan(p)) stored.set(p.id, p);
  const out: Plan[] = [];
  for (const d of DEFAULT_PLANS) {
    const s = stored.get(d.id);
    out.push(s ? { ...d, ...s } : d);
    stored.delete(d.id);
  }
  for (const p of stored.values()) out.push(p);
  return out;
}

function readRaw(): Plan[] {
  if (typeof window === "undefined") return DEFAULT_PLANS;
  try {
    return normalize(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return DEFAULT_PLANS;
  }
}

function writeRaw(next: Plan[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
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
  return JSON.stringify(DEFAULT_PLANS);
}

export function readPlans(): Plan[] {
  return readRaw();
}

/** Persist one plan (create or replace) — the plans page's save. */
export function updatePlan(plan: Plan): void {
  const next = readRaw();
  const i = next.findIndex((p) => p.id === plan.id);
  if (i >= 0) next[i] = plan;
  else next.push(plan);
  writeRaw(next);
}

export function usePlans(): Plan[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as Plan[];
}
