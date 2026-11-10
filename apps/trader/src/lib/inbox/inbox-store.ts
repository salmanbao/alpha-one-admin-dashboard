"use client";

import { useCallback, useEffect, useState } from "react";

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

/** Messages pushed at runtime (risk warnings, payout events, …). Item 7
 *  wires `pushInboxMessage` to the lifecycle bus so the inbox becomes a
 *  projection of it; until then the risk-warning journey (item 5) pushes
 *  `risk.warning` messages directly. */
let pushedMessages: InboxMessage[] = [];
const listeners = new Set<(messages: InboxMessage[]) => void>();

function notify() {
  const snapshot = [...inboxSeedMessages, ...pushedMessages];
  listeners.forEach((l) => l(snapshot));
}

/** Append a message once (deduped by id) and notify subscribers. */
export function pushInboxMessage(message: InboxMessage): void {
  if (pushedMessages.some((m) => m.id === message.id)) return;
  pushedMessages = [...pushedMessages, message];
  notify();
}

export function readInboxMessages(): InboxMessage[] {
  return [...inboxSeedMessages, ...pushedMessages];
}

export function useInboxMessages(): InboxMessage[] {
  // useState initializer already snapshots module state (which includes any
  // messages pushed before mount); the effect only subscribes to live pushes.
  const [messages, setMessages] = useState(() => readInboxMessages());
  useEffect(() => {
    const unsub = subscribe(setMessages);
    return unsub;
  }, []);
  return messages;
}

function subscribe(cb: (messages: InboxMessage[]) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
