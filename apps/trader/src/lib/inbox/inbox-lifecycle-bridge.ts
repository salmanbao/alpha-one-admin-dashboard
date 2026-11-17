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
 *   payout.auto-decided → "Payout approved automatically under rule X —
 *                        review window 24h (Demo)" (R7 I4; the generic
 *                        approved/rejected/escalated receipts above are
 *                        suppressed when the payload says automated)
 *   kyc.approved      → "KYC approved — your account is verified for payouts"
 *   kyc.rejected      → "KYC rejected — update documents and retry"
 *   challenge.funded  → "Challenge funded — account ready to trade"
 *   trade.opened      → "Position opened" / "Order placed" (R7 I1)
 *   trade.closed      → "Position closed — realized $X"
 *   trade.modified    → "Stop/limit updated" / breakeven / partial / cancel
 *   compliance.violation      → "Rule violated" (R7 I2)
 *   compliance.buffer-warning → "Buffer running low"
 *
 * Prop-admin publishes the first seven into the shared
 * `pfaas:demo:lifecycle-log` under the demo gateway; this bridge reads
 * that same log and converts them into inbox messages. The trade.* and
 * compliance.* events are the trader's OWN writes (lib/trading,
 * lib/compliance) — they land as receipts and are the named consumer for
 * those emissions. Risk warnings (item 5) push their own messages
 * directly via pushInboxMessage().
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
    case "payout.auto-decided": {
      // R7 I4 — receipt for an automated decision. One message per
      // auto-decision: the generic approved/rejected/escalated receipts
      // return null below when `payload.automated` is set.
      const ruleName = String(e.payload?.ruleName ?? "a payout rule");
      const action = String(e.payload?.action ?? "auto-approve");
      if (action === "auto-reject") {
        return {
          id: `inbox:${e.id}:payout-auto-decided`,
          subject: `Payout rejected automatically under rule ${ruleName} — review window 24h (Demo)`,
          body: `Your payout request ${ref} for ${money(e.payload?.amount)} did not meet the automation rules and was rejected automatically. An operator reviews every automated decision within 24h (Demo).`,
          category: "Payouts",
          sender: "Payouts Team",
          at: e.at,
          read: false,
          actionType: "payout",
        };
      }
      if (action === "escalate") {
        return {
          id: `inbox:${e.id}:payout-auto-decided`,
          subject: `Payout escalated automatically under rule ${ruleName} — second signature (Demo)`,
          body: `Your payout request ${ref} for ${money(e.payload?.amount)} was routed for a second operator signature under "${ruleName}". No action needed — review window 24h (Demo).`,
          category: "Payouts",
          sender: "Payouts Team",
          at: e.at,
          read: false,
          actionType: "payout",
        };
      }
      return {
        id: `inbox:${e.id}:payout-auto-decided`,
        subject: `Payout approved automatically under rule ${ruleName} — review window 24h (Demo)`,
        body: `Your payout request ${ref} for ${money(e.payload?.amount)} matched "${ruleName}" and was approved automatically. Review window 24h — an operator can still reverse it before processing (Demo).`,
        category: "Payouts",
        sender: "Payouts Team",
        at: e.at,
        read: false,
        actionType: "payout",
      };
    }
    case "payout.approved":
      // Automated decisions ship the payout.auto-decided receipt instead.
      if (e.payload?.automated) return null;
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
      if (e.payload?.automated) return null;
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
      if (e.payload?.automated) return null;
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
    case "purchase.refunded": {
      const ref = String(e.payload?.orderId ?? e.entity.id);
      return {
        id: `inbox:${e.id}:purchase-refunded`,
        subject: `Refund issued — order #${ref}`,
        body: `Your order #${ref} for ${money(e.payload?.amount)} has been refunded to your original payment method.${typeof e.payload?.reason === "string" ? `\n\nReason: ${e.payload.reason}` : ""}`,
        category: "Challenges",
        sender: "Billing Team",
        at: e.at,
        read: false,
        actionType: "challenge",
      };
    }
    case "payout-method.rejected": {
      const methodId = String(e.payload?.method ?? e.entity.id);
      return {
        id: `inbox:${e.id}:method-rejected`,
        subject: `Payout method rejected — ${methodId}`,
        body: `Your payout method ${methodId} has been rejected.${typeof e.payload?.reason === "string" ? `\n\nReason: ${e.payload.reason}` : ""} Update your withdrawal method and retry.`,
        category: "Payouts",
        sender: "Payouts Team",
        at: e.at,
        read: false,
        actionType: "payout-method",
      };
    }
    case "payout-method.unverified": {
      const methodId = String(e.payload?.method ?? e.entity.id);
      return {
        id: `inbox:${e.id}:method-unverified`,
        subject: `Payout method unverified — ${methodId}`,
        body: `Your payout method ${methodId} is unverified. Requests may fail until the method is verified.`,
        category: "Payouts",
        sender: "Payouts Team",
        at: e.at,
        read: false,
        actionType: "payout-method",
      };
    }
    case "payout-method.updated": {
      if (e.payload?.verification !== "verified") return null;
      const methodId = String(e.payload?.method ?? e.entity.id);
      return {
        id: `inbox:${e.id}:method-verified`,
        subject: `Payout method verified — ${methodId}`,
        body: `Your payout method ${methodId} has been verified and is ready to use for payouts.`,
        category: "Payouts",
        sender: "Payouts Team",
        at: e.at,
        read: false,
        actionType: "payout-method",
      };
    }
    case "provisioning.failed": {
      const ref = String(e.payload?.orderId ?? e.entity.id);
      return {
        id: `inbox:${e.id}:provisioning-failed`,
        subject: `Provisioning failed — order #${ref}`,
        body: `Account provisioning for order #${ref} has failed.${typeof e.payload?.reason === "string" ? `\n\nReason: ${e.payload.reason}` : ""} Please contact support or retry.`,
        category: "Support",
        sender: "Provisioning Team",
        at: e.at,
        read: false,
        actionType: "provisioning",
      };
    }
    case "provisioning.retry": {
      const ref = String(e.payload?.orderId ?? e.entity.id);
      return {
        id: `inbox:${e.id}:provisioning-retry`,
        subject: `Provisioning retry — order #${ref}`,
        body: `Provisioning for order #${ref} has been retried. You will be notified when it completes.`,
        category: "Support",
        sender: "Provisioning Team",
        at: e.at,
        read: false,
        actionType: "provisioning",
      };
    }
    case "comms.message-sent":
      // R4-09 / rule R6 — prop-admin "Contact trader" lands here.
      return {
        id: `inbox:${e.id}:comms`,
        subject: String(e.payload?.subject ?? "Message from your firm"),
        body: String(e.payload?.body ?? ""),
        category: "Support",
        sender:
          typeof e.payload?.sender === "string"
            ? e.payload.sender
            : "Support Team",
        at: e.at,
        read: false,
      };
    case "trade.opened": {
      // R7 I1 — receipts for the trader's own trading-store writes.
      const lots = typeof e.payload?.lots === "number" ? e.payload.lots : 0;
      const symbol = String(e.payload?.symbol ?? "");
      const pending = e.payload?.mode === "pending-order";
      return {
        id: `inbox:${e.id}:trade-opened`,
        subject: pending ? "Order placed" : "Position opened",
        body: pending
          ? `${String(e.payload?.orderType ?? "Order")} ${lots.toFixed(2)} ${symbol} @ ${e.payload?.price} · ticket #${e.payload?.ticket}`
          : `${e.payload?.side === "long" ? "Bought" : "Sold"} ${lots.toFixed(2)} lots ${symbol} @ ${e.payload?.entry} · ticket #${e.payload?.ticket}`,
        category: "Trading",
        sender: "Terra Markets",
        at: e.at,
        read: false,
      };
    }
    case "trade.closed":
      return {
        id: `inbox:${e.id}:trade-closed`,
        subject: "Position closed",
        body: `${String(e.payload?.symbol ?? "")} ${String(e.payload?.side ?? "")} ${typeof e.payload?.lots === "number" ? e.payload.lots.toFixed(2) : ""} lots closed @ ${e.payload?.exit} · realized ${money(e.payload?.pnl)} (ticket #${e.payload?.ticket})`,
        category: "Trading",
        sender: "Terra Markets",
        at: e.at,
        read: false,
      };
    case "trade.modified": {
      const action = String(e.payload?.action ?? "");
      const symbol = String(e.payload?.symbol ?? "");
      const subject =
        action === "breakeven"
          ? "Stop moved to breakeven"
          : action === "partial-close"
            ? "Position partially closed"
            : action === "order-cancelled"
              ? "Order cancelled"
              : "Stop/limit updated";
      const body =
        action === "breakeven"
          ? `${symbol} stop loss moved to entry ${e.payload?.sl}.`
          : action === "partial-close"
            ? `${String(e.payload?.closedLots ?? "")} lots of ${symbol} closed · realized ${money(e.payload?.pnl)}.`
            : action === "order-cancelled"
              ? `${String(e.payload?.orderType ?? "Order")} ${symbol} @ ${e.payload?.price} was cancelled.`
              : `${symbol} SL ${e.payload?.sl ?? "—"} • TP ${e.payload?.tp ?? "—"}.`;
      return {
        id: `inbox:${e.id}:trade-modified`,
        subject,
        body,
        category: "Trading",
        sender: "Terra Markets",
        at: e.at,
        read: false,
      };
    }
    case "compliance.violation":
      // R7 I2 — computed rule break from lib/compliance/compliance-store.
      return {
        id: `inbox:${e.id}:compliance-violation`,
        subject: "Rule violated",
        body: `${String(e.payload?.detail ?? "A trading rule was breached.")}\n\nOpen the Risk Dashboard for the full standing.`,
        category: "Trading",
        sender: "Risk Team",
        at: e.at,
        read: false,
        actionType: "challenge",
        actionHref: "/risk-dashboard",
      };
    case "compliance.buffer-warning":
      // Final 20% of a buffer — the same threshold the gauge turns red.
      return {
        id: `inbox:${e.id}:compliance-buffer-warning`,
        subject: "Buffer running low",
        body: `Your ${String(e.payload?.metric ?? "allowance")} is ${Math.round(Number(e.payload?.usedPct ?? 0))}% used — only ${money(e.payload?.remaining)} left of the ${money(e.payload?.limit)} allowance on account #${String(e.payload?.login ?? "")}.`,
        category: "Trading",
        sender: "Risk Team",
        at: e.at,
        read: false,
        actionType: "challenge",
        actionHref: "/risk-dashboard",
      };
    case "risk.alert.raised": {
      const pct = Number(e.payload?.pct);
      const metric = String(e.payload?.metric ?? "risk");
      const ruleName = String(e.payload?.ruleName ?? "Risk rule");
      const detail = typeof e.payload?.detail === "string" ? e.payload.detail : "";
      const subjectPct = Number.isFinite(pct) ? `${pct}%` : "";
      return {
        id: `inbox:${e.id}:risk-alert`,
        subject: `Risk alert — ${ruleName}${subjectPct ? ` (${subjectPct})` : ""}`,
        body: `Warning: you used ${subjectPct || "part"} of your ${metric} limit (Demo). ${detail} Rule: ${ruleName}.`,
        category: "Trading",
        sender: "Risk Team",
        at: e.at,
        read: false,
        actionType: "risk",
        actionHref: "/risk-dashboard",
      };
    }
    default:
      return null;
  }
}

export function useInboxLifecycleBridge(): void {
  const events = useLifecycleLog();
  useEffect(() => {
    for (const e of events) {
      // Trade + compliance receipts (actor "trader") are this app's own
      // writes — they map below. Everything else comes from prop-admin.
      const own = e.name.startsWith("trade.") || e.name.startsWith("compliance.");
      if (e.actor !== "prop-admin" && !own) continue;
      const msg = mapEvent(e);
      if (!msg) continue;
      pushInboxMessage(msg);
    }
  }, [events]);
}