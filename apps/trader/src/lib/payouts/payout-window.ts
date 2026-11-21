/**
 * Rolling payout window — R12 GAP-T1.
 *
 * The window is a schedule computed from a fixed epoch anchor, not a
 * fixture value: every `payoutSchedule.cycleDays` (14) days the window
 * opens at the anchor's time-of-day (midnight UTC) and stays open for
 * 3 days, forever. The old implementation read
 * `windowOpensAt/windowClosesAt` from the fixture, which were
 * `daysFromNow(4/7)` evaluated ONCE at module load — the window never
 * rolled and was never open on a fresh load, so the displayed schedule
 * could never match real time (and nothing enforced it either; the
 * enforcement lives in buildPayoutCriteria).
 *
 * Lives in lib/payouts (not the strip component) so consumers like the
 * window-reminder store can read it without importing a component.
 */

import { payoutSchedule } from "@/lib/fixtures/terra-fixtures";

/** Fixed schedule anchor — 2026-01-02 00:00 UTC. */
const WINDOW_EPOCH_MS = Date.UTC(2026, 0, 2);
/** Each window stays open for 3 days of its 14-day cycle. */
const WINDOW_DURATION_MS = 3 * 86_400_000;

export type PayoutWindow = {
  /** true while submissions are accepted (window open). */
  open: boolean;
  /** Days until the window opens — 0 while open. */
  daysToOpen: number;
  /** Open: the CURRENT window's start. Closed: the NEXT window's start. */
  opensAt: Date;
  /** Corresponding close instant of that window. */
  closesAt: Date;
};

export function payoutWindow(now: number = Date.now()): PayoutWindow {
  const cycleMs = Math.max(1, payoutSchedule.cycleDays) * 86_400_000;
  const since = now - WINDOW_EPOCH_MS;
  // Position within the current cycle (always >= 0, even pre-epoch).
  const inCycle = ((since % cycleMs) + cycleMs) % cycleMs;
  const open = inCycle < WINDOW_DURATION_MS;
  const cycleStart = now - inCycle;
  // Open → the current window; closed → the next one (rolls forever).
  const base = open ? cycleStart : cycleStart + cycleMs;
  const opensAt = new Date(base);
  const closesAt = new Date(base + WINDOW_DURATION_MS);
  const daysToOpen = open ? 0 : Math.max(1, Math.ceil((base - now) / 86_400_000));
  return { open, daysToOpen, opensAt, closesAt };
}

/** "Nov 25" window-date formatter shared by criteria and pages. */
export function fmtWindowDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
