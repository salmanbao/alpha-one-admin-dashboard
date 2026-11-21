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
 *   payout.failed      → "Payout failed — action needed" (R12 GAP-T4)
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
 *   rules.version-published   → "Rules v4 published — here is what changed
 *                        (Demo)" (R9 W1; the body states that the account
 *                        keeps its signed-up rules — grandfathering)
 *   appeal.claim-submitted   → own-claim receipt / "Breach dispute opened
 *                        from your support ticket" (R9 W1)
 *   appeal.accepted          → "Appeal accepted — verdict + reason" (R9 W1)
 *   appeal.rejected          → "Appeal rejected — verdict + reason" (R9 W1)
 *   breach.reversed          → "Breach reversed — appeal accepted" (R9 W1,
 *                        emitted by prop-admin reverseBreach())
 *   payout.fraud-cleared     → "Payout PO-x — compliance flag cleared"
 *                        (R9 W2; prop-admin payout-fraud-store verdict)
 *   payout.fraud-blocked     → "Payout PO-x — paused for compliance
 *                        review" (R9 W2 — names the signal, honest about
 *                        why money stopped)
 *   payout.fraud-escalated   → "Payout PO-x — escalated to senior review"
 *                        (R9 W2)
 *   purchase.fee-refunded    → "Challenge fee refunded with payout PO-x"
 *                        (R9 W2; own write — purchases-store fee flip)
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
    // R12 GAP-T4 — the rail outcome (bounced transfer / PSP decline)
    // emitted by prop-admin's exception queue; the trader needs the
    // reason + a CTA to retry.
    case "payout.failed":
      return {
        id: `inbox:${e.id}:payout-failed`,
        subject: "Payout failed — action needed",
        body:
          `Your payout request ${ref} could not be completed. ${typeof e.payload?.reason === "string" && e.payload.reason ? `Reason: ${e.payload.reason}. ` : ""}You can retry with the same method or choose a different one.`,
        category: "Payouts",
        sender: "Payouts Team",
        at: e.at,
        read: false,
        actionType: "payout",
        actionHref: "/payouts",
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
    case "promo.retry-discount-issued": {
      // R9 W5 UC-T8 — own write (the compliance evaluator issued the
      // rewards-store grant); receipt tells the trader it's in the wallet.
      const pct = Number(e.payload?.discountPct ?? 0);
      const code = String(e.payload?.code ?? "");
      const login = String(e.payload?.login ?? "");
      const breach = String(e.payload?.breachType ?? "breach").replace(/-/g, " ");
      return {
        id: `inbox:${e.id}:retry-discount`,
        subject: "Your retry discount is ready",
        body: `A ${pct}% retry discount (${code}) was added to your promo wallet after the ${breach} on account #${login}.\n\nApply it at the next challenge checkout — one live code per breach type (Demo policy).`,
        category: "Challenges",
        sender: "Rewards",
        at: e.at,
        read: false,
        actionType: "promo",
        actionHref: "/rewards",
      };
    }
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
    case "risk.ladder-moved": {
      // R9 W4 — graduated enforcement rung move (UC-O7). The trader sees
      // which rung they moved to and what the next step is.
      const rung = Number(e.payload?.rung);
      const rungName = String(e.payload?.rungName ?? "warn");
      const ruleName = String(e.payload?.ruleName ?? "Risk rule");
      const detail = typeof e.payload?.detail === "string" ? e.payload.detail : "";
      const rungLabel =
        rungName === "warn" ? "Warning" :
        rungName === "size-cap" ? "Size cap" :
        rungName === "suspend" ? "Suspension" : "Breach";
      const nextStep =
        rungName === "warn" ? "next step: size cap" :
        rungName === "size-cap" ? "next step: suspension" :
        rungName === "suspend" ? "next step: breach" : "account breach";
      return {
        id: `inbox:${e.id}:ladder-moved`,
        subject: `Risk enforcement — ${rungLabel} (rung ${rung})`,
        body: `Your account has been moved to the ${rungLabel} rung (${nextStep}) after a repeat violation of ${ruleName}. ${detail} Rule: ${ruleName}. Contact support if you believe this is an error.`,
        category: "Trading",
        sender: "Risk Team",
        at: e.at,
        read: false,
        actionType: "risk",
        actionHref: "/risk-dashboard",
      };
    }
    case "rules.version-published": {
      // R9 W1 — the trader's copy of an operator publish (UC-T2). Lists the
      // actual from → to diffs and states the grandfathering promise
      // plainly: this account keeps the rules it signed up under.
      const version = Number(e.payload?.version);
      const rawChanges = Array.isArray(e.payload?.changes) ? e.payload.changes : [];
      const lines = rawChanges.slice(0, 3).map((c) => {
        const ch = (c ?? {}) as Record<string, unknown>;
        return `• ${String(ch.field ?? "rule")}: ${String(ch.from ?? "—")} → ${String(ch.to ?? "—")}`;
      });
      const more = rawChanges.length > 3 ? `\n• …and ${rawChanges.length - 3} more change(s)` : "";
      const notes = String(e.payload?.notes ?? "");
      return {
        id: `inbox:${e.id}:rules-version`,
        subject: `Rules v${version} published — here is what changed (Demo)`,
        body:
          `The firm published Rules v${version}${notes ? `: ${notes}` : "."}\n\n` +
          (lines.length ? `${lines.join("\n")}${more}\n\n` : "No field-level changes were recorded.\n\n") +
          "Your account keeps the rules it signed up under — a newer version does not apply to you retroactively.",
        category: "Trading",
        sender: "Risk Team",
        at: e.at,
        read: false,
        actionType: "risk",
        actionHref: "/rules",
      };
    }
    case "appeal.claim-submitted": {
      // R9 W1 — two flavors of one event: the trader's own filing (actor
      // "trader") gets a receipt; a prop-admin support escalation tells
      // them a breach dispute was opened on their behalf.
      const id = String(e.payload?.claimId ?? e.entity?.id ?? "");
      const escalated = e.actor === "prop-admin";
      const refs = Array.isArray(e.payload?.tradeRefs) ? e.payload.tradeRefs.length : 0;
      return {
        id: `inbox:${e.id}:appeal-submitted`,
        subject: escalated
          ? "Breach dispute opened from your support ticket (Demo)"
          : `Outage claim ${id} submitted (Demo)`,
        body: escalated
          ? `${String(e.payload?.notes ?? "The firm opened a breach dispute from your support ticket.")}\n\nTrack it on the claims page — the verdict arrives here with the reason.`
          : `Your claim ${id} is in the firm's appeals queue with ${refs} trade(s) attached as evidence.\n\n(Demo) — a review agent will assess this claim; the verdict arrives here with the reason.`,
        category: "Support",
        sender: "Appeals Review",
        at: e.at,
        read: false,
        actionType: "risk",
        actionHref: "/outage-claim",
      };
    }
    case "appeal.accepted": {
      // R9 W1 — verdict receipt (UC-O1). The reason is the operator's,
      // verbatim; acceptance also reversed the disputed breach.
      const id = String(e.payload?.appealId ?? e.entity?.id ?? "");
      const reason = String(e.payload?.verdictReason ?? "");
      return {
        id: `inbox:${e.id}:appeal-accepted`,
        subject: `Appeal accepted — ${id} (Demo)`,
        body: `Your appeal ${id} was accepted.${reason ? `\n\nReason: ${reason}` : ""}\n\nAny breach disputed in this appeal has been reversed and its risk case closed.`,
        category: "Support",
        sender: "Appeals Review",
        at: e.at,
        read: false,
        actionType: "risk",
        actionHref: "/outage-claim",
      };
    }
    case "appeal.rejected": {
      const id = String(e.payload?.appealId ?? e.entity?.id ?? "");
      const reason = String(e.payload?.verdictReason ?? "");
      return {
        id: `inbox:${e.id}:appeal-rejected`,
        subject: `Appeal rejected — ${id} (Demo)`,
        body: `Your appeal ${id} was not accepted.${reason ? `\n\nReason: ${reason}` : ""}\n\nThe original breach (if any) stands. Reply via support if you have new evidence.`,
        category: "Support",
        sender: "Appeals Review",
        at: e.at,
        read: false,
        actionType: "risk",
        actionHref: "/outage-claim",
      };
    }
    case "breach.reversed": {
      // R9 W1 — emitted by prop-admin reverseBreach() when an appeal is
      // accepted; confirms the breach record was cleared.
      const rule = String(e.payload?.ruleName ?? e.payload?.ruleId ?? "your breach");
      const reason = String(e.payload?.reason ?? "");
      return {
        id: `inbox:${e.id}:breach-reversed`,
        subject: "Breach reversed — appeal accepted (Demo)",
        body: `${rule} on ${String(e.payload?.accountLogin ?? "your account")} was reversed.${reason ? `\n\nReason: ${reason}` : ""}\n\nThe alert is cleared and the linked risk case dismissed — your standing no longer cites it.`,
        category: "Trading",
        sender: "Risk Team",
        at: e.at,
        read: false,
        actionType: "risk",
        actionHref: "/risk-dashboard",
      };
    }
    case "payout.fraud-cleared": {
      // R9 W2 UC-O5 — prop-admin verdict receipt: the hold is gone and
      // money-moving decisions are available again.
      const ref = String(e.payload?.reference ?? e.payload?.payoutReference ?? e.entity.id);
      return {
        id: `inbox:${e.id}:payout-fraud-cleared`,
        subject: `Payout ${ref} — compliance flag cleared (Demo)`,
        body: `The review on your payout ${ref} found nothing blocking. The request is back in the normal approval flow.\n\nFlagged signal: ${String(e.payload?.signal ?? "—")}.`,
        category: "Support",
        sender: "Compliance Review",
        at: e.at,
        read: false,
        actionType: "payout",
        actionHref: "/payouts",
      };
    }
    case "payout.fraud-blocked": {
      // R9 W2 UC-O5 — blocked receipt: honest about WHY money stopped.
      const ref = String(e.payload?.reference ?? e.payload?.payoutReference ?? e.entity.id);
      const signal = String(e.payload?.signal ?? "a payout-abuse signal");
      const detail = String(e.payload?.detail ?? "");
      return {
        id: `inbox:${e.id}:payout-fraud-blocked`,
        subject: `Payout ${ref} — paused for compliance review (Demo)`,
        body: `Your payout ${ref} was paused: ${signal}${detail ? ` (${detail})` : ""}.\n\nNo money moves while the flag stands. Reply via support with context and the firm can clear it — the verdict arrives here.`,
        category: "Support",
        sender: "Compliance Review",
        at: e.at,
        read: false,
        actionType: "payout",
        actionHref: "/payouts",
      };
    }
    case "payout.fraud-escalated": {
      const ref = String(e.payload?.reference ?? e.payload?.payoutReference ?? e.entity.id);
      return {
        id: `inbox:${e.id}:payout-fraud-escalated`,
        subject: `Payout ${ref} — escalated to senior review (Demo)`,
        body: `Your payout ${ref} was escalated for a second look (${String(e.payload?.signal ?? "payout-abuse signal")}).\n\nProcessing continues under senior review; the outcome arrives here.`,
        category: "Support",
        sender: "Compliance Review",
        at: e.at,
        read: false,
        actionType: "payout",
        actionHref: "/payouts",
      };
    }
    case "purchase.fee-refunded": {
      // R9 W2 UC-T6 — own write (trader store flips it); receipt confirms
      // the fee-back promise landed with the payout.
      const ref = String(e.payload?.payoutReference ?? "");
      return {
        id: `inbox:${e.id}:purchase-fee-refunded`,
        subject: `Challenge fee refunded with payout ${ref} (Demo)`,
        body: `Your ${String(e.payload?.program ?? "challenge")} fee (${money(e.payload?.amount)}) was refunded with payout ${ref} — the fee-back promise on funded accounts.\n\nSee the ledger line on the purchase history page.`,
        category: "Support",
        sender: "Billing",
        at: e.at,
        read: false,
        actionType: "challenge",
        actionHref: "/purchase-history",
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
      // writes — they map below. Trader-filed appeals (R9 W1) are also
      // own writes (the submit receipt); everything else is prop-admin.
      const own =
        e.name.startsWith("trade.") ||
        e.name.startsWith("compliance.") ||
        // R9 W5 — the retry-discount grant is this app's own write
        // (compliance evaluator → rewards wallet).
        e.name === "promo.retry-discount-issued" ||
        (e.name.startsWith("appeal.") && e.actor === "trader") ||
        // R9 W2 — trader-store fee flip (purchase.fee-refunded) is an own
        // write; payout.fraud-* verdicts arrive from prop-admin.
        e.name === "purchase.fee-refunded";
      if (e.actor !== "prop-admin" && !own) continue;
      const msg = mapEvent(e);
      if (!msg) continue;
      pushInboxMessage(msg);
    }
  }, [events]);
}