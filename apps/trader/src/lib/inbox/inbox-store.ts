"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

export type InboxCategory = "Payouts" | "Challenges" | "Trading" | "Marketing" | "Support";

export interface InboxMessage {
  id: string;
  subject: string;
  body: string;
  category: InboxCategory;
  sender: string;
  at: string; // ISO
  read: boolean;
  /** Only known action types render an action button; anything else shows
   *  the body without actions rather than a broken link. */
  actionType?: "payout" | "challenge" | "promo";
}

/** Seed messages for the inbox (notification-center-page renders these). */
export const inboxSeedMessages: InboxMessage[] = [
  {
    id: "msg-1",
    subject: "Payout approved — funds on the way",
    body:
      "Your payout request PO-2187 for $4,850.00 has been approved and is being processed.\n\nFunds will arrive within 1–2 business days to the withdrawal method ending ••4417. No further action is needed — we'll notify you again once the transfer settles.\n\nThank you for trading with TerraTrader.",
    category: "Payouts",
    sender: "Payouts Team",
    at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    read: false,
    actionType: "payout",
  },
  {
    id: "msg-2",
    subject: "Challenge passed — funded account ready",
    body:
      "Congratulations! You've completed every phase of the Terra Pro $100K challenge.\n\nYour funded account is ready to trade with the standard 5% daily loss limit. Review your challenge details to activate it and schedule your first payout cycle.",
    category: "Challenges",
    sender: "Challenge Team",
    at: new Date(Date.now() - 6 * 3_600_000).toISOString(),
    read: false,
    actionType: "challenge",
  },
  {
    id: "msg-3",
    subject: "New campaign offer: WELCOME25 — 25% off your next challenge",
    body:
      "You've been selected for the WELCOME25 campaign.\n\nUse the code at checkout for 25% off any challenge fee of $25K and above. The offer is live in your Promo Wallet and valid until December 31, 2026.\n\nOpen the promo wallet to reveal your code and check eligibility.",
    category: "Marketing",
    sender: "Marketing Team",
    at: new Date(Date.now() - 20 * 3_600_000).toISOString(),
    read: false,
    actionType: "promo",
  },
  {
    id: "msg-4",
    subject: "Risk alert: daily loss limit approaching",
    body:
      "Your daily loss is approaching the 5% limit on your Terra Flash $25K account.\n\nReduce position sizes or pause trading to avoid a breach. Breaches are permanent for the account, so act before the limit is hit.",
    category: "Trading",
    sender: "Risk Team",
    at: new Date(Date.now() - 29 * 3_600_000).toISOString(),
    read: true,
  },
  {
    id: "msg-5",
    subject: "Scheduled maintenance — Sunday 02:00 UTC",
    body:
      "TerraMarkets-Live02 will undergo scheduled maintenance on Sunday at 02:00 UTC for approximately 30 minutes.\n\nOpen positions are unaffected. The web terminal will show a maintenance banner during the window.",
    category: "Support",
    sender: "System",
    at: new Date(Date.now() - 50 * 3_600_000).toISOString(),
    read: true,
  },
  {
    id: "msg-6",
    subject: "Deposit received — $5,000 credited",
    body:
      "Your deposit of $5,000.00 has been credited to wallet balance.\n\nPromo eligibility has been re-evaluated against your active offers. Any conditions you were missing may now be unlocked.",
    category: "Payouts",
    sender: "Payments Team",
    at: new Date(Date.now() - 74 * 3_600_000).toISOString(),
    read: true,
  },
  {
    id: "msg-7",
    subject: "Ticket #4412 replied — VPN verification question",
    body:
      "A support agent replied to your ticket about trading over a VPN.\n\nShort answer: yes, from an allowed region, as long as the session country matches your KYC profile. Open the ticket to read the full reply.",
    category: "Support",
    sender: "Support Desk",
    at: new Date(Date.now() - 96 * 3_600_000).toISOString(),
    read: true,
  },
  {
    id: "msg-8",
    subject: "Leaderboard: you're #14 this week",
    body:
      "You're ranked 14th on the weekly leaderboard with a +6.2% return.\n\nThe top 10 finish the week with a bonus promo code. Keep your risk profile steady — a single breach resets the run.",
    category: "Marketing",
    sender: "Community Team",
    at: new Date(Date.now() - 120 * 3_600_000).toISOString(),
    read: true,
  },
];

/** Messages pushed at runtime (risk warnings, payout events, …).
 *  Projected onto the inbox from the lifecycle bus by the bridge; risk
 *  warnings (item 5) push their own messages directly via
 *  pushInboxMessage(). R4-08 persists pushes so they survive reload even
 *  when nothing re-derives them. */
let pushedMessages: InboxMessage[] = [];
const listeners = new Set<(messages: InboxMessage[]) => void>();

/* ------------------------------------------------------------------ */
/* Persistence (R4-08 / AUDIT-R4 §2.7)                                 */
/*                                                                     */
/* One object, one write path: read flags and soft-deletes live here,  */
/* not in page-local state. State persists to localStorage so reloads  */
/* keep it:                                                             */
/*   • pushed messages (bridge + risk warnings + payout receipts)      */
/*   • read overrides applied over seed/pushed `read` flags            */
/*   • deleted (soft) ids — filtered out of every snapshot             */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "terra-inbox-state";

interface PersistedInboxState {
  pushed: InboxMessage[];
  read: Record<string, boolean>;
  deleted: string[];
}

const readOverrides = new Map<string, boolean>();
let deletedIds = new Set<string>();
/** Hydration is deferred to the client: SSR and the first client render
 *  both see defaults (no hydration mismatch), then useInboxMessages()
 *  hydrates in its effect. Mutators hydrate first too, so a write before
 *  the first hook mounts can never clobber persisted state. */
let hydrated = false;

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<PersistedInboxState>;
    if (Array.isArray(parsed.pushed)) pushedMessages = parsed.pushed;
    if (parsed.read && typeof parsed.read === "object") {
      for (const [id, v] of Object.entries(parsed.read)) readOverrides.set(id, Boolean(v));
    }
    if (Array.isArray(parsed.deleted)) {
      deletedIds = new Set(parsed.deleted.filter((x): x is string => typeof x === "string"));
    }
  } catch {
    // Corrupted/unreadable state — start from defaults.
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    const state: PersistedInboxState = {
      pushed: pushedMessages,
      read: Object.fromEntries(readOverrides),
      deleted: [...deletedIds],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode / quota) — in-memory only.
  }
}

/** Effective read flag: override wins over the message's own flag. */
function effectiveRead(id: string): boolean | undefined {
  if (readOverrides.has(id)) return readOverrides.get(id);
  return (
    inboxSeedMessages.find((m) => m.id === id)?.read ??
    pushedMessages.find((m) => m.id === id)?.read
  );
}

/** Seed + pushes, minus deleted, with read overrides applied. */
function snapshot(): InboxMessage[] {
  return [...inboxSeedMessages, ...pushedMessages]
    .filter((m) => !deletedIds.has(m.id))
    .map((m) => {
      const override = readOverrides.get(m.id);
      return override === undefined ? m : { ...m, read: override };
    });
}

function notify() {
  const snap = snapshot();
  listeners.forEach((l) => l(snap));
}

/** Append a message once (deduped by id) and notify subscribers.
 *  Deleted ids never resurrect — the bridge re-projects the whole
 *  lifecycle log on every mount, so without this guard a reload would
 *  bring back messages the user deleted. */
export function pushInboxMessage(message: InboxMessage): void {
  hydrate();
  if (deletedIds.has(message.id)) return;
  if (pushedMessages.some((m) => m.id === message.id)) return;
  pushedMessages = [...pushedMessages, message];
  persist();
  notify();
}

/** Mark one message read (no-op when already read). */
export function markRead(id: string): void {
  hydrate();
  if (effectiveRead(id) === true) return;
  readOverrides.set(id, true);
  persist();
  notify();
}

/** Mark one message unread (no-op when already unread). */
export function markUnread(id: string): void {
  hydrate();
  if (effectiveRead(id) === false) return;
  readOverrides.set(id, false);
  persist();
  notify();
}

/** Mark every live message read; selection untouched (Table 150). */
export function markAllRead(): void {
  hydrate();
  let changed = false;
  for (const m of [...inboxSeedMessages, ...pushedMessages]) {
    if (deletedIds.has(m.id)) continue;
    if (effectiveRead(m.id) === true) continue;
    readOverrides.set(m.id, true);
    changed = true;
  }
  if (!changed) return;
  persist();
  notify();
}

/** Soft-delete a message: filtered from every snapshot, persisted so it
 *  stays gone across reloads. Kept until a real TTL exists (demo copy
 *  in the notification center). */
export function remove(id: string): void {
  hydrate();
  if (deletedIds.has(id)) return;
  deletedIds.add(id);
  persist();
  notify();
}

export function readInboxMessages(): InboxMessage[] {
  // Deliberately does not hydrate: SSR and the first client render must
  // match; useInboxMessages() hydrates in its effect after mount.
  return snapshot();
}

function getSnapshot(): string {
  return JSON.stringify(snapshot());
}

function getServerSnapshot(): string {
  // SSR and the hydration render both see defaults (no mismatch);
  // persisted state lands in the mount effect below.
  return JSON.stringify([...inboxSeedMessages]);
}

export function useInboxMessages(): InboxMessage[] {
  // Hydrate after mount — localStorage is client-only, and calling setState
  // synchronously in an effect is banned; notify() instead re-reads the
  // store through useSyncExternalStore's subscription. Mutators hydrate
  // first too, so a write before any hook mounts never clobbers storage.
  useEffect(() => {
    const wasHydrated = hydrated;
    hydrate();
    if (!wasHydrated) notify();
  }, []);
  const raw = useSyncExternalStore(
    (onChange) => subscribe(() => onChange()),
    getSnapshot,
    getServerSnapshot,
  );
  return useMemo(() => JSON.parse(raw) as InboxMessage[], [raw]);
}

function subscribe(cb: (messages: InboxMessage[]) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
