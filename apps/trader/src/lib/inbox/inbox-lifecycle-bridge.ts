"use client";

/**
 * Inbox → lifecycle bus projection (R3-07 / AUDIT-R3 §6 item 7).
 *
 * The trader inbox was a static array with no writers. This module makes it
 * a projection of the shared lifecycle bus so prop-admin decisions land as
 * real messages:
 *
 *   payout.approved   → "Payout approved — funds on the way"
 *   payout.rejected   → "Payout rejected — revised request"
 *   payout.paid       → "Payout paid — settled"
 *   payout.escalated  → "Payout escalated — second signature required"
 *   kyc.approved      → "KYC approved — your account is verified for payouts"
 *   kyc.rejected      → "KYC rejected — update documents and retry"
 *   challenge.funded  → "Challenge funded — account ready to trade"
 *
 * Prop-admin publishes these events into the shared `pfaas:demo:lifecycle-log`
 * under the demo gateway; this bridge reads that same log and converts the
 * trader-actor-relevant events into inbox messages. Risk warnings (item 5)
 * push their own messages directly via pushInboxMessage().
 */

import { useEffect } from "react";
import { useLifecycleLog, type LifecycleEvent, type LifecycleEventName } from "@pfaas/lifecycle";
import { pushInboxMessage, type InboxMessage } from "./inbox-store";

function money(amount: unknown): string {
  const n = typeof amount === "number" ? amount : 0;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function mapEvent(e: LifecycleEvent): InboxMessage | null {
  const ref = String(e.payload?.reference ?? e.id);
  switch (e.name as LifecycleEventName) {
    case "payout.approved":
      return {
        id: `inbox:${e.id}:payout-approved`,
        subject: "Payout approved — funds on the way",
        body: `Your payout request ${ref} for ${money(e.payload?.amount)} has been approved and is being processed.\n\nFunds will arrive within 1–2 business days. No further action is needed.`,
        category: "Payouts",
        sender: "Payouts Team",
        at: e.at,
        read: false,
        actionType: "payout",
      };
    case "payout.rejected":
      return {
        id: `inbox:${e.id}:payout-rejected`,
        subject: "Payout rejected — revised request",
        body: `Your payout request ${ref} was not approved. Update your payment details and submit again.`,
        category: "Payouts",
        sender: "Payouts Team",
        at: e.at,
        read: false,
        actionType: "payout",
      };
    case "payout.paid":
      return {
        id: `inbox:${e.id}:payout-paid`,
        subject: "Payout paid — settled",
        body: `Your payout request ${ref} of ${money(e.payload?.amount)} has been paid.`,
        category: "Payouts",
        sender: "Payouts Team",
        at: e.at,
        read: false,
        actionType: "payout",
      };
    case "payout.escalated":
      return {
        id: `inbox:${e.id}:payout-escalated`,
        subject: "Payout escalated — second signature required",
        body: `Your payout request ${ref} requires a second operator signature before it can proceed.`,
        category: "Payouts",
        sender: "Payouts Team",
        at: e.at,
        read: false,
        actionType: "payout",
      };
    case "kyc.approved":
      return {
        id: `inbox:${e.id}:kyc-approved`,
        subject: "KYC approved — your account is verified",
        body: "Your identity verification has been approved. Your account is now fully verified for payouts.",
        category: "Payouts",
        sender: "Payouts Team",
        at: e.at,
        read: false,
        actionType: "payout",
      };
    case "kyc.rejected":
      return {
        id: `inbox:${e.id}:kyc-rejected`,
        subject: "KYC rejected — update documents and retry",
        body: "Your identity verification was not approved. Please update your KYC documents and retry.",
        category: "Payouts",
        sender: "Payouts Team",
        at: e.at,
        read: false,
        actionType: "payout",
      };
    case "challenge.funded":
      return {
        id: `inbox:${e.id}:challenge-funded`,
        subject: "Challenge funded — your account is ready",
        body: "A challenge payout was funded for you. Your funded account is ready to trade with the standard risk limits.",
        category: "Payouts",
        sender: "Trading Team",
        at: e.at,
        read: false,
        actionType: "payout",
      };
    default:
      return null;
  }
}

export function useInboxLifecycleBridge(): void {
  const events = useLifecycleLog();
  useEffect(() => {
    for (const e of events) {
      if (e.actor !== "prop-admin") continue;
      const msg = mapEvent(e);
      if (!msg) continue;
      pushInboxMessage(msg);
    }
  }, [events]);
}