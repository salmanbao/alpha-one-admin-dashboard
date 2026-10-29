/**
 * PFaaS Platform — Demo-session persistence (localStorage)
 *
 * Gap analysis quick-win #12: mock decisions (payout/KYC/evaluation
 * reviews, breach resolutions, risk cases, CRM edits, announcements,
 * ticket actions, trader status changes) used to die with the tab, so a
 * demo couldn't survive F5. Every session-scoped store now mirrors its
 * mutation state into localStorage under the `pfaas:demo:` prefix —
 * clearly labelled demo data, never read outside these stores — and
 * rehydrates from it at module load.
 *
 * Payloads validate through zod schemas (lib/platform/validation.ts):
 * corrupt or hand-edited storage degrades to the seeded mock data
 * instead of crashing a store. Writes are best-effort (storage full /
 * private mode just means no persistence).
 *
 * `resetDemoState()` (topbar → Switch user (demo) → "Reset demo
 * session") clears every demo key plus the session audit trail and
 * reloads, restoring the pristine seed state.
 *
 * SSR-safe: both load and save are no-ops without a `window`, so module
 * init on the server keeps the seeded fallback (the boot screen is the
 * only server-rendered surface anyway).
 */

import type { ZodType } from "zod";

const PREFIX = "pfaas:demo:";

/** Store ids → localStorage suffix. Keep in sync with the wired stores. */
const DEMO_STORES = [
  "traders",
  "crm",
  "kyc",
  "payouts",
  "breaches",
  "risk-cases",
  "announcements",
  "tickets",
  "evaluations",
] as const;

/**
 * Read + validate a persisted demo payload. Any failure (no storage,
 * bad JSON, schema mismatch) returns `fallback` — the seeded state.
 */
export function loadDemoState<T>(store: string, schema: ZodType<T>, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + store);
    if (!raw) return fallback;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

/** Persist a demo payload (best-effort). Called from each store's emit(). */
export function saveDemoState(store: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + store, JSON.stringify(value));
  } catch {
    /* storage full / private mode — demo persistence is best-effort */
  }
}

/**
 * Clear every demo-store payload plus the session audit trail (it
 * records the very decisions being reset) and reload the app so all
 * stores rehydrate from the pristine seed data.
 */
export function resetDemoState(): void {
  if (typeof window === "undefined") return;
  try {
    for (const s of DEMO_STORES) window.localStorage.removeItem(PREFIX + s);
    window.localStorage.removeItem("pfaas:auditSession");
  } catch {
    /* ignore */
  }
  window.location.reload();
}
