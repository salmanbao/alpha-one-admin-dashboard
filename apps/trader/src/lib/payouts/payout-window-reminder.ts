"use client";

/**
 * Payout-window reminder — R12 GAP-T1.
 *
 * The request path now blocks submissions outside the rolling payout
 * window (see payoutWindow() in payout-summary-strip), so the trader
 * needs the other half of that contract: a reminder of WHEN the next
 * window opens. This is a small opt-in persisted flag:
 *
 *   • "Remind me when it opens" (request page banner / eligibility) sets
 *     the flag for the next window.
 *   • `runWindowReminderCheck()` — called by the summary strip on mount
 *     and every minute — pushes ONE inbox receipt when the rolling
 *     window opens, then records which window fired so neither the
 *     reminder nor a second strip instance can double-send.
 *
 * Storage: `pfaas:trader:payoutWindowReminder` (localStorage, same
 * persistence family as the other trader payout stores).
 */

import { pushInboxMessage } from "@/lib/inbox/inbox-store";
import { payoutWindow } from "@/lib/payouts/payout-window";

const STORAGE_KEY = "pfaas:trader:payoutWindowReminder";

type ReminderState = {
  /** Trader opted in to a "window is open" receipt. */
  optedIn: boolean;
  /** `opensAt` ISO of the last window a receipt was fired for. */
  firedFor?: string;
};

function read(): ReminderState {
  if (typeof window === "undefined") return { optedIn: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ReminderState) : null;
    return parsed && typeof parsed === "object" ? { optedIn: !!parsed.optedIn, firedFor: parsed.firedFor } : { optedIn: false };
  } catch {
    return { optedIn: false };
  }
}

function write(state: ReminderState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — reminder works in-session only */
  }
}

/** Is the "remind me" opt-in currently set? */
export function readWindowReminder(): ReminderState {
  return read();
}

/** Toggle the opt-in (clearing it also forgets the fired marker). */
export function setWindowReminder(optedIn: boolean): void {
  write({ optedIn, firedFor: read().firedFor });
}

/**
 * Fire the reminder once per window when the opt-in is set. Safe to call
 * from any number of strip instances: the `firedFor` marker dedupes by
 * the window's opensAt timestamp.
 */
export function runWindowReminderCheck(now: number = Date.now()): void {
  const state = read();
  if (!state.optedIn) return;
  const win = payoutWindow(now);
  if (!win.open) return;
  const opensAt = win.opensAt.toISOString();
  if (state.firedFor === opensAt) return;
  write({ optedIn: true, firedFor: opensAt });
  pushInboxMessage({
    id: `inbox-window-open-${opensAt}`,
    subject: "Payout window is open — requests accepted now",
    body: `Your payout window opened just now and closes ${win.closesAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}. Submit your request before the cutoff (${new Date(win.closesAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} UTC) to be processed in this cycle.`,
    category: "Payouts",
    sender: "Payouts Team",
    at: new Date(now).toISOString(),
    read: false,
    actionType: "payout",
    actionHref: "/payout-request",
  });
}
