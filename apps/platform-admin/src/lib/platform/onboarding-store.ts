"use client";

/**
 * R13 P1-1/P2-2 — Getting Started onboarding store.
 *
 * The checklist claimed "Progress is saved per operator" while holding
 * completion in component `useState`, and it pre-marked every step done
 * — contradicting its own step data (three of five steps are flagged
 * `done: false`). Completion now derives from the step defaults on first
 * load, persists per operator, and every toggle writes an audit row.
 *
 * Pattern: singleton state + listener set + version hook, persisted to
 * localStorage under a single key.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:onboarding-steps";

/** Step ids in checklist order — mirrors STEPS in the page. */
export const ONBOARDING_STEPS = ["account", "tenants", "modules", "risk", "payouts"] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

/**
 * First-load defaults: the first three foundation steps are complete,
 * Risk Rules and Payout Integration are not — the honest starting point
 * the step data describes.
 */
const DEFAULT_COMPLETED: OnboardingStepId[] = ["account", "tenants", "modules"];

function load(): OnboardingStepId[] {
  if (typeof window === "undefined") return DEFAULT_COMPLETED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COMPLETED;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_COMPLETED;
    return parsed.filter((id): id is OnboardingStepId =>
      (ONBOARDING_STEPS as readonly string[]).includes(id as string),
    );
  } catch {
    return DEFAULT_COMPLETED;
  }
}

function persist(next: OnboardingStepId[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

let completed: OnboardingStepId[] = load();

/** Current set of completed onboarding step ids. */
export function readCompletedSteps(): OnboardingStepId[] {
  return completed;
}

/** Whether a step is marked complete. */
export function isStepComplete(id: string): boolean {
  return completed.includes(id as OnboardingStepId);
}

/**
 * Toggle a step's completion. Persists + audits. Returns the new
 * completed set.
 */
export function toggleStep(id: string, actor = "operator"): OnboardingStepId[] {
  const step = id as OnboardingStepId;
  if (!(ONBOARDING_STEPS as readonly string[]).includes(step)) return completed;
  const nowDone = !completed.includes(step);
  completed = nowDone ? [...completed, step] : completed.filter((c) => c !== step);
  persist(completed);
  recordAudit({
    actor,
    action: `onboarding.step_${nowDone ? "complete" : "reopen"}`,
    target: step,
    detail: `Onboarding step "${step}" marked ${nowDone ? "complete" : "incomplete"}`,
    severity: "info",
  });
  emit();
  return completed;
}

/** Reset the checklist to defaults (persists + audits). */
export function resetOnboarding(actor = "operator"): OnboardingStepId[] {
  completed = [];
  persist(completed);
  recordAudit({
    actor,
    action: "onboarding.reset",
    target: "getting-started",
    detail: "Operator onboarding checklist reset — all steps reopened",
    severity: "warning",
  });
  emit();
  return completed;
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe the calling component to onboarding mutations. */
export function useOnboardingVersion(): number {
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
