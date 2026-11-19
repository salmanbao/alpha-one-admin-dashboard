"use client";

/**
 * Proration engine — P1-3.
 *
 * Replaces the hardcoded "day 12 of 30" fixture with a real billing-cycle
 * anchor read from the tenant store (`billingCycleAnchor` / `billingCycle`,
 * defaulting to `createdAt` / "monthly").
 *
 * All results are computed deterministically from inputs — no Math.random,
 * no hardcoded cycle day. Persisted across reloads via the tenant store.
 *
 * Acceptance test: given a tenant whose cycle anchor is N days old,
 * proration from plan A → plan B computes credit = remaining days on A
 * minus charge = remaining days on B, pro-rated daily.
 */

export type BillingCycle = "weekly" | "monthly" | "quarterly" | "annually";

/** Days per cycle by billing frequency. */
export const BILLING_CYCLE_DAYS: Record<BillingCycle, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  annually: 365,
};

/** Result of proration computation. */
export interface ProrationResult {
  cycle: BillingCycle;
  cycleDays: number; // days in a full cycle
  cycleStart: string; // ISO start of current cycle
  cycleEnd: string; // ISO end of current cycle
  cycleDay: number; // 1-indexed day within the cycle
  daysRemaining: number; // days left until cycle rolls over
  dailyFrom: number; // plan A daily rate
  dailyTo: number; // plan B daily rate
  creditUnused: number; // money back on old plan (dailyFrom * daysRemaining)
  chargeRemaining: number; // money owed on new plan (dailyTo * daysRemaining)
  netProration: number; // charge − credit (>0 = tenant owes)
}

/** Compute what day-of-cycle `now` falls on given an anchor date. */
function cyclePosition(
  anchor: Date,
  cycleDays: number,
  now: Date,
): { start: Date; end: Date; day: number; daysRemaining: number } {
  const anchorMs = anchor.getTime();
  const nowMs = now.getTime();
  const elapsedDays = Math.floor((nowMs - anchorMs) / 86_400_000);
  const cyclesElapsed = Math.floor(elapsedDays / cycleDays);
  const cycleStartMs = anchorMs + cyclesElapsed * cycleDays * 86_400_000;
  const cycleEndMs = cycleStartMs + cycleDays * 86_400_000;
  const day = Math.min(cycleDays, nowMs - cycleStartMs + 1); // 1-indexed, clamped
  const daysRemaining = cycleDays - day;
  return {
    start: new Date(cycleStartMs),
    end: new Date(cycleEndMs - 1),
    day: Math.max(1, day),
    daysRemaining,
  };
}

/**
 * Compute proration for an immediate plan change.
 *
 * - `fromPrice`, `toPrice`: monthly prices of current / target plan
 * - `anchorIso`: ISO date string for the cycle anchor (defaults to tenant createdAt)
 * - `cycle`: billing frequency (defaults to "monthly")
 * - `now`: current moment (defaults to Date.now())
 */
export function computeProration({
  fromPrice,
  toPrice,
  anchorIso,
  cycle,
  now: nowOpt,
}: {
  fromPrice: number;
  toPrice: number;
  anchorIso?: string;
  cycle?: BillingCycle;
  now?: Date;
}): ProrationResult {
  const cycleKey: BillingCycle = cycle ?? "monthly";
  const cycleDays = BILLING_CYCLE_DAYS[cycleKey];
  const now = nowOpt ?? new Date();
  const anchor = anchorIso ? new Date(anchorIso) : now;
  const pos = cyclePosition(anchor, cycleDays, now);
  const dailyFrom = fromPrice / cycleDays;
  const dailyTo = toPrice / cycleDays;
  const creditUnused = dailyFrom * pos.daysRemaining;
  const chargeRemaining = dailyTo * pos.daysRemaining;
  const netProration = chargeRemaining - creditUnused;
  return {
    cycle: cycleKey,
    cycleDays,
    cycleStart: pos.start.toISOString(),
    cycleEnd: pos.end.toISOString(),
    cycleDay: pos.day,
    daysRemaining: pos.daysRemaining,
    dailyFrom,
    dailyTo,
    creditUnused,
    chargeRemaining,
    netProration,
  };
}

/** Return the ISO string of the next billing cycle start after `now`. */
export function nextBillingCycleStart(
  anchorIso: string,
  cycle: BillingCycle,
  now?: Date,
): string {
  const cycleDays = BILLING_CYCLE_DAYS[cycle];
  const anchor = new Date(anchorIso);
  const target = now ?? new Date();
  const pos = cyclePosition(anchor, cycleDays, target);
  // If `target` is exactly at cycle start, the anchor is current; otherwise move to next cycle.
  return new Date(pos.end.getTime() + 1).toISOString();
}

/**
 * Default cycle anchor for a tenant: `billingCycleAnchor` if set,
 * otherwise `createdAt`.
 */
export function defaultAnchor(tenant: { billingCycleAnchor?: string; createdAt: string }): string {
  return tenant.billingCycleAnchor ?? tenant.createdAt;
}

/**
 * Default billing cycle for a tenant: `billingCycle` if set, otherwise "monthly".
 */
export function defaultCycle(tenant: { billingCycle?: BillingCycle }): BillingCycle {
  return tenant.billingCycle ?? "monthly";
}
